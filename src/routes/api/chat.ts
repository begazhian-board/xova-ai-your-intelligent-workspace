import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, type ModelMessage } from "ai";
import { buildSystemPrompt } from "@/lib/xova-prompt.server";
import { createGeminiProvider, GEMINI_MODEL } from "@/lib/gemini.server";
import { chatProviderErrorCode, searchNoticeCode, shouldTryChatFallback } from "@/lib/chat-contract";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { ModeId } from "@/lib/xova";

interface WireAttachment {
  name: string;
  mime: string;
  kind: string;
  dataUrl?: string;
  text?: string;
}

interface WireMessage {
  role: "user" | "assistant";
  content: string;
  attachments?: WireAttachment[];
}

interface WireBody {
  messages?: WireMessage[];
  mode?: ModeId;
  personality?: string;
  customPersonality?: string | null;
  responseStyle?: string;
  language?: string;
}

/** Sentinel line used to hand real search sources to the client before the text stream. */
const SOURCES_PREFIX = "\u241E SOURCES ";
/** Sentinel that ends the text stream with final sources + error code. */
const TRAILER_PREFIX = "\u241F";

function providerStatus(error: unknown) {
  const value = error as {
    statusCode?: number;
    status?: number;
    lastError?: { statusCode?: number; status?: number };
  };
  return value?.statusCode ?? value?.status ?? value?.lastError?.statusCode ?? value?.lastError?.status;
}

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function toModelMessages(messages: WireMessage[]): ModelMessage[] {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return { role: "assistant", content: message.content } satisfies ModelMessage;
    }

    const images = (message.attachments ?? []).filter(
      (a) => a.kind === "image" && typeof a.dataUrl === "string",
    );
    const texts = (message.attachments ?? []).filter((a) => typeof a.text === "string" && a.text);

    let text = message.content;
    for (const file of texts) {
      text += `\n\n--- Attached file: ${file.name} (${file.mime || "text"}) ---\n${file.text!.slice(0, 120_000)}\n--- end of ${file.name} ---`;
    }

    if (images.length === 0) {
      return { role: "user", content: text } satisfies ModelMessage;
    }

    return {
      role: "user",
      content: [
        { type: "text", text: text || "Describe this image." },
        ...images.map((image) => ({ type: "image" as const, image: image.dataUrl! })),
      ],
    } satisfies ModelMessage;
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await authenticate(request);
        if (!user) {
          return Response.json({ error: "err.auth" }, { status: 401 });
        }

        const geminiKey = process.env["GEMINI_API_KEY"];

        let body: WireBody;
        try {
          body = (await request.json()) as WireBody;
        } catch {
          return Response.json({ error: "err.generic" }, { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        if (messages.length === 0) {
          return Response.json({ error: "err.generic" }, { status: 400 });
        }

        const mode: ModeId = body.mode ?? "instant";
        const modelMessages = toModelMessages(messages);

        const system = buildSystemPrompt({
          mode,
          personality: body.personality ?? "friendly",
          customPersonality: body.customPersonality ?? null,
          responseStyle: body.responseStyle ?? "balanced",
          language: body.language ?? "en",
          searchAvailable: true,
        });

        try {
          const encoder = new TextEncoder();
          const prelude = `${SOURCES_PREFIX}[]\n`;
          const collected: Array<{ title: string; url: string; snippet: string }> = [];

          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(encoder.encode(prelude));
              let errorCode: string | null = null;
              let noticeCode: string | null = null;
              let wroteText = false;
              const local = new AbortController();
              const onAbort = () => local.abort();
              request.signal.addEventListener("abort", onAbort);

              const pump = async (
                result: ReturnType<typeof streamText>,
                includeGroundingSources: boolean,
              ) => {
                for await (const part of result.fullStream) {
                  if (part.type === "text-delta") {
                    if (part.text) {
                      wroteText = true;
                      controller.enqueue(encoder.encode(part.text));
                    }
                  } else if (
                    includeGroundingSources &&
                    part.type === "source" &&
                    part.sourceType === "url"
                  ) {
                    if (!collected.some((source) => source.url === part.url)) {
                      let title = part.title?.trim() || "";
                      try {
                        title ||= new URL(part.url).hostname;
                      } catch {
                        /* Ignore malformed provider titles; preserve the returned URL. */
                      }
                      collected.push({ title, url: part.url, snippet: "" });
                    }
                  } else if (part.type === "error") {
                    throw part.error;
                  }
                }
              };

              try {
                let geminiError: unknown;
                if (geminiKey) {
                  try {
                    const google = createGeminiProvider(geminiKey);
                    const gemini = google(GEMINI_MODEL);
                    await pump(
                      streamText({
                        model: gemini as never,
                        system,
                        messages: modelMessages,
                        abortSignal: local.signal,
                        maxRetries: 0,
                        tools: { google_search: google.tools.googleSearch({}) as never },
                      }),
                      true,
                    );
                    if (!wroteText) throw new Error("Gemini returned no visible answer");
                  } catch (error) {
                    if (request.signal.aborted) {
                      controller.close();
                      return;
                    }
                    geminiError = error;
                    console.error("XOVA Gemini stream error", providerStatus(error) ?? "", error);
                  }
                }

                let fallbackUsed = false;
                if (shouldTryChatFallback(wroteText)) {
                  fallbackUsed = true;
                  // These URLs ground Gemini's answer only; never attach them to a different provider's reply.
                  collected.length = 0;
                  if (mode === "reasoning" || mode === "research") {
                    noticeCode = "err.searchFallbackUnavailable";
                  }

                  const gatewayKey = process.env["LOVABLE_API_KEY"];
                  if (!gatewayKey) {
                    errorCode = geminiError
                      ? chatProviderErrorCode("gemini", providerStatus(geminiError))
                      : "err.unavailable";
                  } else {
                    try {
                      const gateway = createLovableAiGatewayProvider(gatewayKey);
                      await pump(
                        streamText({
                          model: gateway("google/gemini-3.8-flash"),
                          system,
                          messages: modelMessages,
                          abortSignal: local.signal,
                          maxRetries: 0,
                        }),
                        false,
                      );
                      if (!wroteText) throw new Error("Gateway returned no visible answer");
                    } catch (error) {
                      if (request.signal.aborted) {
                        controller.close();
                        return;
                      }
                      console.error("XOVA Gateway stream error", providerStatus(error) ?? "", error);
                      errorCode = chatProviderErrorCode("gateway", providerStatus(error));
                    }
                  }
                }

                if (!wroteText && !errorCode) {
                  errorCode = geminiError
                    ? chatProviderErrorCode("gemini", providerStatus(geminiError))
                    : "err.unavailable";
                }
                if (!fallbackUsed && wroteText && collected.length === 0) {
                  noticeCode = searchNoticeCode(mode, collected.length, false);
                }
              } finally {
                request.signal.removeEventListener("abort", onAbort);
              }
              controller.enqueue(
                encoder.encode(
                  `${TRAILER_PREFIX}${JSON.stringify({ sources: collected, error: errorCode, notice: noticeCode })}`,
                ),
              );
              controller.close();
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Xova-Search": geminiKey ? "live" : "unavailable",
            },
          });
        } catch (error) {
          const status = providerStatus(error);
          console.error("XOVA chat failure", status ?? "", error);
          return Response.json(
            { error: chatProviderErrorCode("gemini", status) },
            { status: 502 },
          );
        }
      },
    },
  },
});

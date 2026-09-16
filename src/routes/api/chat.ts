import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, type ModelMessage } from "ai";
import { createLovableAiGatewayProvider, getLovableAiGatewayRunId } from "@/lib/ai-gateway.server";
import { buildSystemPrompt, routeModel } from "@/lib/xova-prompt.server";
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

/** Real web search — only runs when a search provider key is configured. */
async function searchWeb(query: string) {
  const key = process.env["TAVILY_API_KEY"];
  if (!key) return null;
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      max_results: 6,
      search_depth: "advanced",
      include_answer: false,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };
  return (json.results ?? [])
    .filter((r) => typeof r.url === "string")
    .map((r) => ({
      title: r.title?.trim() || new URL(r.url!).hostname,
      url: r.url!,
      snippet: r.content?.slice(0, 400) ?? "",
    }));
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

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "err.unavailable" }, { status: 500 });
        }

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
        const last = messages[messages.length - 1]!;
        const hasImage = (last.attachments ?? []).some((a) => a.kind === "image");

        let sources: Array<{ title: string; url: string; snippet: string }> | null = null;
        if (mode === "research") {
          try {
            sources = await searchWeb(last.content.slice(0, 400));
          } catch {
            sources = null;
          }
        }

        const modelMessages = toModelMessages(messages);
        if (sources && sources.length > 0) {
          modelMessages.splice(modelMessages.length - 1, 0, {
            role: "system",
            content: `Live web search results for the user's request. Use only these as sources and cite them by title where relevant:\n${sources
              .map((s, i) => `[${i + 1}] ${s.title} — ${s.url}\n${s.snippet}`)
              .join("\n\n")}`,
          });
        }

        const system = buildSystemPrompt({
          mode,
          personality: body.personality ?? "friendly",
          customPersonality: body.customPersonality ?? null,
          responseStyle: body.responseStyle ?? "balanced",
          language: body.language ?? "en",
          searchAvailable: Boolean(sources && sources.length > 0),
        });

        const gateway = createLovableAiGatewayProvider(apiKey, getLovableAiGatewayRunId(request));

        try {
          const result = streamText({
            model: gateway(routeModel(mode, hasImage)),
            system,
            messages: modelMessages,
            abortSignal: request.signal,
          });

          const textStream = result.textStream;
          const encoder = new TextEncoder();
          const prelude =
            sources && sources.length > 0
              ? `${SOURCES_PREFIX}${JSON.stringify(sources)}\n`
              : `${SOURCES_PREFIX}[]\n`;

          const stream = new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(encoder.encode(prelude));
              try {
                for await (const chunk of textStream) {
                  controller.enqueue(encoder.encode(chunk));
                }
                controller.close();
              } catch (error) {
                console.error("XOVA stream error", error);
                controller.close();
              }
            },
          });

          return new Response(stream, {
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
              "X-Xova-Search": sources && sources.length > 0 ? "live" : "unavailable",
            },
          });
        } catch (error) {
          const status = (error as { statusCode?: number })?.statusCode;
          console.error("XOVA chat failure", status ?? "", error);
          return Response.json(
            { error: status === 429 ? "err.rate" : "err.unavailable" },
            { status: 502 },
          );
        }
      },
    },
  },
});

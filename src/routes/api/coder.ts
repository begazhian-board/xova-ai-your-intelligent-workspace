import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText, type ModelMessage } from "ai";
import { createGeminiProvider, GEMINI_MODEL } from "@/lib/gemini.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

interface WireFile {
  path: string;
  content: string;
}
interface WireBody {
  prompt?: string;
  files?: WireFile[];
  history?: Array<{ role: "user" | "assistant"; text: string }>;
}

const SYSTEM = `You are XOVA Coder, an expert front-end engineer. You build complete, working static websites with plain HTML, CSS and JavaScript (no build step, no frameworks, no external JS libraries; Google Fonts links are allowed).

The user may write in Arabic, English or a mix. Understand them fully. Write the site's visible text in the user's language (Arabic sites use <html lang="ar" dir="rtl">).

Requirements:
- Organize files: index.html, styles.css, script.js (add more .html pages only when asked). Link them with relative paths: <link rel="stylesheet" href="styles.css"> and <script src="script.js" defer></script>.
- Mobile-first and responsive with @media queries, <meta name="viewport" content="width=device-width, initial-scale=1">, a real <title>, semantic HTML, alt text on images.
- Polished modern design: a coherent color palette via CSS variables, good typography and spacing, hover/focus states.
- Every link must point to an existing section id or file; every button and form must actually work in script.js. Every element used by getElementById must exist.
- Images: use https://picsum.photos/seed/<word>/800/600 or inline SVG, never local image files.

OUTPUT FORMAT — strictly follow it, nothing outside these blocks:
<<<FILE path>>>
(full file content, no markdown fences)
<<<END>>>
…one block per file…
<<<SUMMARY>>>
(1–3 short sentences in the user's language describing what you built or changed)

When CURRENT FILES are provided this is an edit: return only the files you changed, each in full.`;

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

function statusOf(error: unknown): number | undefined {
  const e = error as { statusCode?: number; status?: number; lastError?: { statusCode?: number } };
  return e?.statusCode ?? e?.status ?? e?.lastError?.statusCode;
}

function errorCode(status: number | undefined) {
  if (status === 429) return "coder.err.busy";
  if (status === 402) return "coder.err.credits";
  if (status === 401 || status === 403) return "coder.err.config";
  return "coder.err.provider";
}

export const Route = createFileRoute("/api/coder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await authenticate(request);
        if (!user) return Response.json({ error: "coder.err.auth" }, { status: 401 });

        let body: WireBody;
        try {
          body = (await request.json()) as WireBody;
        } catch {
          return Response.json({ error: "coder.err.input" }, { status: 400 });
        }
        const prompt = body.prompt?.trim() ?? "";
        if (!prompt || prompt.length > 4000) return Response.json({ error: "coder.err.input" }, { status: 400 });
        const files = (body.files ?? []).filter((f) => typeof f.path === "string" && typeof f.content === "string").slice(0, 20);
        const total = files.reduce((n, f) => n + f.content.length, 0);
        if (total > 300_000) return Response.json({ error: "coder.err.tooLarge" }, { status: 413 });

        const geminiKey = process.env["GEMINI_API_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];
        if (!geminiKey && !lovableKey) return Response.json({ error: "coder.err.config" }, { status: 500 });

        const history = (body.history ?? []).slice(-6).map(
          (h): ModelMessage => ({ role: h.role, content: h.text.slice(0, 2000) }),
        );
        const current = files.length
          ? `CURRENT FILES:\n${files.map((f) => `<<<FILE ${f.path}>>>\n${f.content}\n<<<END>>>`).join("\n")}\n\nEDIT REQUEST:\n${prompt}`
          : `BUILD THIS WEBSITE:\n${prompt}`;
        const messages: ModelMessage[] = [...history, { role: "user", content: current }];

        const attempts: Array<() => ReturnType<typeof streamText>> = [];
        if (geminiKey) {
          attempts.push(() =>
            streamText({
              model: createGeminiProvider(geminiKey)(GEMINI_MODEL),
              system: SYSTEM,
              messages,
              maxRetries: 0,
              abortSignal: request.signal,
            }),
          );
        }
        if (lovableKey) {
          attempts.push(() =>
            streamText({
              model: createLovableAiGatewayProvider(lovableKey)("google/gemini-3.8-flash"),
              system: SYSTEM,
              messages,
              maxRetries: 0,
              abortSignal: request.signal,
            }),
          );
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            let lastStatus: number | undefined;
            for (const attempt of attempts) {
              let emitted = false;
              try {
                const result = attempt();
                for await (const part of result.fullStream) {
                  if (part.type === "text-delta" && part.text) {
                    emitted = true;
                    controller.enqueue(encoder.encode(part.text));
                  } else if (part.type === "error") {
                    throw part.error;
                  }
                }
                if (emitted) {
                  controller.close();
                  return;
                }
              } catch (error) {
                if (request.signal.aborted) {
                  controller.close();
                  return;
                }
                lastStatus = statusOf(error);
                console.error("XOVA coder provider", lastStatus, String(error).slice(0, 300));
                if (emitted) {
                  controller.enqueue(encoder.encode(`\n<<<XOVA_ERROR:coder.err.interrupted>>>`));
                  controller.close();
                  return;
                }
              }
            }
            controller.enqueue(encoder.encode(`<<<XOVA_ERROR:${errorCode(lastStatus)}>>>`));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
        });
      },
    },
  },
});

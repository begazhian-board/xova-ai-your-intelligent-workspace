import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { aiProviderErrorCode, getAIProviderConfig } from "@/lib/ai-provider.server";

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

export const Route = createFileRoute("/api/diagnostics")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await authenticate(request);
        if (!user) {
          return Response.json({ ok: false, error: "err.auth" }, { status: 401 });
        }

        const provider = getAIProviderConfig("chat");
        if (!provider) {
          return Response.json({ ok: false, error: "err.aiConfig" }, { status: 503 });
        }

        try {
          const response = await fetch(provider.endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + provider.apiKey,
            },
            body: JSON.stringify({
              model: provider.model,
              max_tokens: 12,
              stream: false,
              messages: [
                { role: "system", content: "You are XOVA. Reply briefly." },
                { role: "user", content: "Reply with OK only." },
              ],
            }),
            signal: AbortSignal.timeout(15_000),
          });

          if (!response.ok) {
            const detail = (await response.text().catch(() => "")).slice(0, 800);
            console.error("XOVA AI provider diagnostic failed", response.status, detail);
            return Response.json(
              { ok: false, error: aiProviderErrorCode(response.status, detail) },
              { status: 502 },
            );
          }

          const payload = (await response.json()) as {
            choices?: Array<{ message?: { content?: unknown } }>;
          };
          const content = payload.choices?.[0]?.message?.content;
          const hasText =
            (typeof content === "string" && content.trim().length > 0) ||
            (Array.isArray(content) &&
              content.some(
                (part) =>
                  Boolean(part) &&
                  typeof part === "object" &&
                  typeof (part as { text?: unknown }).text === "string" &&
                  Boolean((part as { text: string }).text.trim()),
              ));

          if (!hasText) {
            return Response.json({ ok: false, error: "err.aiNetwork" }, { status: 502 });
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("XOVA AI provider diagnostic network error", error);
          return Response.json(
            {
              ok: false,
              error:
                error instanceof Error && error.name === "TimeoutError"
                  ? "err.aiBusy"
                  : "err.aiNetwork",
            },
            { status: 502 },
          );
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { GEMINI_MODEL } from "@/lib/gemini.server";

function classify(status: number, message: string) {
  const lower = message.toLowerCase();
  if (status === 401 || status === 403 || /api key not valid|api_key_invalid|invalid api key/.test(lower)) {
    return "err.geminiConfig";
  }
  if (status === 404) return "err.geminiModel";
  if (status === 429 || /quota|rate limit|resource exhausted/.test(lower)) return "err.rate";
  if (status === 400) return "err.geminiRequest";
  if (status >= 500 || status === 408) return "err.geminiBusy";
  return "err.geminiNetwork";
}

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
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
        if (!user) return Response.json({ ok: false, error: "err.auth" }, { status: 401 });

        const apiKey = process.env["GEMINI_API_KEY"];
        if (!apiKey) return Response.json({ ok: false, error: "err.geminiConfig" });

        try {
          const response = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
              },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: "Reply with OK only." }] }],
                generationConfig: { maxOutputTokens: 8 },
              }),
              signal: AbortSignal.timeout(12_000),
            },
          );

          if (!response.ok) {
            const detail = (await response.text().catch(() => "")).slice(0, 800);
            console.error("XOVA Gemini diagnostic failed", response.status, detail);
            return Response.json({ ok: false, error: classify(response.status, detail) });
          }

          const payload = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
          if (!answer) {
            console.error("XOVA Gemini diagnostic returned no text", JSON.stringify(payload).slice(0, 500));
            return Response.json({ ok: false, error: "err.geminiPayload" });
          }
          return Response.json({ ok: true });
        } catch (error) {
          console.error("XOVA Gemini diagnostic network error", error);
          return Response.json({
            ok: false,
            error: error instanceof Error && error.name === "TimeoutError"
              ? "err.geminiBusy"
              : "err.geminiNetwork",
          });
        }
      },
    },
  },
});

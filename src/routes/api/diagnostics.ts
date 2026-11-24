import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL } from "@/lib/gemini.server";

async function probeGeminiStream(apiKey: string, model: string) {
  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":streamGenerateContent?alt=sse",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: "You are XOVA. Reply briefly." }] },
          contents: [{ role: "user", parts: [{ text: "Reply with OK only." }] }],
          generationConfig: { maxOutputTokens: 8 },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );

    if (!response.ok) {
      return { ok: false, status: response.status, detail: (await response.text().catch(() => "")).slice(0, 800) };
    }
    if (!response.body) return { ok: false, status: 502, detail: "Gemini returned no stream body" };

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const streamState: {
      hasText: boolean;
      error: { code?: number; message?: string; status?: string } | null;
    } = { hasText: false, error: null };

    const consumeLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") return;
      try {
        const chunk = JSON.parse(payload) as {
          error?: { code?: number; message?: string; status?: string };
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        if (chunk.error) {
          streamState.error = chunk.error;
          return;
        }
        if ((chunk.candidates?.[0]?.content?.parts ?? []).some((part) => typeof part.text === "string" && part.text.trim())) {
          streamState.hasText = true;
        }
      } catch {
        streamState.error = { code: 502, message: "Gemini returned an unreadable stream chunk" };
      }
    };

    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        buffer += decoder.decode(item.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) consumeLine(line);
        if (streamState.error) break;
        if (streamState.hasText) break;
      }
      if (!streamState.hasText && !streamState.error) {
        buffer += decoder.decode();
        if (buffer.trim()) consumeLine(buffer);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }

    if (streamState.error) {
      return {
        ok: false,
        status: streamState.error.code ?? 502,
        detail: streamState.error.message ?? streamState.error.status ?? "Gemini stream error",
      };
    }
    if (!streamState.hasText) return { ok: false, status: 502, detail: "Gemini stream returned no text" };
    return { ok: true, status: 200, detail: "" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const status = error instanceof Error && error.name === "TimeoutError" ? 504 : 0;
    console.error("XOVA Gemini streaming diagnostic network error", detail);
    return { ok: false, status, detail };
  }
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
        if (!apiKey) return Response.json({ ok: false, error: "err.generic" });

        let result = await probeGeminiStream(apiKey, GEMINI_MODEL);
        if (
          !result.ok &&
          (result.status === 0 || [500, 502, 503, 504].includes(result.status))
        ) {
          console.warn("XOVA Gemini streaming diagnostic retrying with fallback model", result.status);
          result = await probeGeminiStream(apiKey, GEMINI_FALLBACK_MODEL);
        }

        if (!result.ok) {
          console.error("XOVA Gemini streaming diagnostic failed", result.status, result.detail);
          return Response.json({ ok: false, error: "err.generic" });
        }
        return Response.json({ ok: true });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createGeminiProvider, GEMINI_MODEL } from "@/lib/gemini.server";

interface TitleMessage {
  role: "user" | "assistant";
  content: string;
}

interface TitleBody {
  messages?: TitleMessage[];
}

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
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

export const Route = createFileRoute("/api/title")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await authenticate(request);
        if (!user) return Response.json({ error: "err.auth" }, { status: 401 });

        const apiKey = process.env["GEMINI_API_KEY"];
        if (!apiKey) return Response.json({ title: null });

        let body: TitleBody;
        try {
          body = (await request.json()) as TitleBody;
        } catch {
          return Response.json({ title: null }, { status: 400 });
        }

        const messages = Array.isArray(body.messages) ? body.messages.slice(0, 8) : [];
        const context: string[] = [];
        let userCount = 0;
        for (const message of messages) {
          if (!message || (message.role !== "user" && message.role !== "assistant")) continue;
          const content = typeof message.content === "string" ? message.content.trim().slice(0, 700) : "";
          if (content) context.push(`${message.role === "user" ? "User" : "XOVA"}: ${content}`);
          if (message.role === "user") {
            userCount += 1;
            if (userCount === 3) break;
          }
        }
        if (userCount < 3 || context.length === 0) return Response.json({ title: null });

        try {
          const google = createGeminiProvider(apiKey);
          const result = await generateText({
            model: google(GEMINI_MODEL),
            system:
              "Create a short, clear conversation title based on the first three user messages and preceding replies. " +
              "Return only the title, in the user's language, 2 to 6 words, without quotation marks.",
            prompt: context.join("\n\n"),
            maxOutputTokens: 24,
            temperature: 0.2,
            maxRetries: 0,
          });
          const title = result.text
            .trim()
            .replace(/^["'“”]+|["'“”]+$/g, "")
            .replace(/[.!؟?]+$/g, "")
            .replace(/\\s+/g, " ")
            .slice(0, 60);
          return Response.json({ title: title || null });
        } catch (error) {
          console.error("XOVA conversation title generation failed", error);
          return Response.json({ title: null });
        }
      },
    },
  },
});

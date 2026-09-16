import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface WireBody {
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
  quality?: "standard" | "premium";
}

const SIZES: Record<string, string> = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

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

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await authenticate(request);
        if (!user) return Response.json({ error: "err.auth" }, { status: 401 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "err.unavailable" }, { status: 500 });

        let body: WireBody;
        try {
          body = (await request.json()) as WireBody;
        } catch {
          return Response.json({ error: "err.generic" }, { status: 400 });
        }

        const prompt = body.prompt?.trim();
        if (!prompt) return Response.json({ error: "err.generic" }, { status: 400 });

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: body.quality === "premium" ? "lovable/image-premium" : "lovable/image-standard",
              prompt,
              size: SIZES[body.aspect ?? "1:1"] ?? SIZES["1:1"],
              n: 1,
            }),
          });

          if (!res.ok) {
            const detail = await res.text();
            console.error("XOVA image failure", res.status, detail.slice(0, 400));
            return Response.json(
              { error: res.status === 429 ? "err.rate" : "err.imageFailed" },
              { status: 502 },
            );
          }

          const json = (await res.json()) as {
            data?: Array<{ b64_json?: string; url?: string }>;
          };
          const first = json.data?.[0];
          const image = first?.b64_json
            ? `data:image/png;base64,${first.b64_json}`
            : (first?.url ?? null);
          if (!image) return Response.json({ error: "err.imageFailed" }, { status: 502 });

          return Response.json({ image });
        } catch (error) {
          console.error("XOVA image error", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
    },
  },
});

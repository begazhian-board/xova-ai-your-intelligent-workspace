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

/** Generations allowed per user per rolling hour. */
const RATE_LIMIT = 15;
/** One year — the bucket is private, the signed token is the only way in. */
const SIGNED_URL_TTL = 60 * 60 * 24 * 365;

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

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
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
        if (prompt.length > 2000) return Response.json({ error: "err.generic" }, { status: 400 });

        const aspect = body.aspect && SIZES[body.aspect] ? body.aspect : "1:1";
        const quality = body.quality === "premium" ? "premium" : "standard";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Rate limit per user, rolling hour.
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count } = await supabaseAdmin
          .from("generated_images")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", since);
        if ((count ?? 0) >= RATE_LIMIT) {
          return Response.json({ error: "err.imageRate" }, { status: 429 });
        }

        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              // Current-generation OpenAI image models (2026 line-up).
              model:
                quality === "premium"
                  ? "openai/gpt-image-2.5-sunburst"
                  : "openai/gpt-image-2.5-flare",
              prompt,
              size: SIZES[aspect],
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

          let bytes: Uint8Array | null = null;
          if (first?.b64_json) {
            bytes = base64ToBytes(first.b64_json);
          } else if (first?.url) {
            const downloaded = await fetch(first.url);
            if (downloaded.ok) bytes = new Uint8Array(await downloaded.arrayBuffer());
          }
          if (!bytes) return Response.json({ error: "err.imageFailed" }, { status: 502 });

          const path = `${user.id}/${crypto.randomUUID()}.png`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from("xova-images")
            .upload(path, bytes, { contentType: "image/png", upsert: false });
          if (uploadError) {
            console.error("XOVA image upload", uploadError.message);
            return Response.json({ error: "err.imageFailed" }, { status: 502 });
          }

          const { data: signed, error: signError } = await supabaseAdmin.storage
            .from("xova-images")
            .createSignedUrl(path, SIGNED_URL_TTL);
          if (signError || !signed?.signedUrl) {
            console.error("XOVA image sign", signError?.message);
            return Response.json({ error: "err.imageFailed" }, { status: 502 });
          }

          const { data: row, error: insertError } = await supabaseAdmin
            .from("generated_images")
            .insert({
              user_id: user.id,
              prompt,
              aspect,
              quality,
              storage_path: path,
              image_url: signed.signedUrl,
            })
            .select("id, created_at")
            .single();
          if (insertError) {
            console.error("XOVA image record", insertError.message);
            return Response.json({ error: "err.imageFailed" }, { status: 502 });
          }

          return Response.json({
            image: signed.signedUrl,
            id: row.id,
            createdAt: row.created_at,
            aspect,
            quality,
          });
        } catch (error) {
          console.error("XOVA image error", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
    },
  },
});

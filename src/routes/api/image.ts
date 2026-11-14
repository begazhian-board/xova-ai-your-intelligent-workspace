import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface WireBody {
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
  quality?: "standard" | "premium";
}

const ASPECTS = new Set(["1:1", "3:2", "2:3"]);

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

/** Free, keyless translation to English; returns the original text on any failure. */
async function translateToEnglish(text: string) {
  if (!/[^\x00-\x7F]/.test(text)) return text;
  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`,
    );
    if (!res.ok) return text;
    const json = (await res.json()) as Array<Array<[string]>>;
    const out = (json[0] ?? []).map((seg) => seg[0]).join("").trim();
    return out || text;
  } catch {
    return text;
  }
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

        const cloudflareAccountId = process.env["CLOUDFLARE_ACCOUNT_ID"]?.trim();
        const cloudflareApiToken = process.env["CLOUDFLARE_API_TOKEN"]?.trim();
        if (!cloudflareAccountId || !cloudflareApiToken) {
          return Response.json({ error: "err.unavailable" }, { status: 500 });
        }

        let body: WireBody;
        try {
          body = (await request.json()) as WireBody;
        } catch {
          return Response.json({ error: "err.generic" }, { status: 400 });
        }

        const prompt = body.prompt?.trim();
        if (!prompt) return Response.json({ error: "err.generic" }, { status: 400 });
        if (prompt.length > 2000) return Response.json({ error: "err.generic" }, { status: 400 });

        const aspect = body.aspect && ASPECTS.has(body.aspect) ? body.aspect : "1:1";
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
          let bytes: Uint8Array | null = null;
          let lastStatus: number | undefined;
          // Faithful English translation of the user's own words — nothing added.
          const english = await translateToEnglish(prompt);

          // Cloudflare Workers AI: FLUX.2 [klein] 4B.
          // Keep the account token server-side; never expose it to the browser.
          const [width, height] =
            aspect === "3:2" ? [1344, 896] : aspect === "2:3" ? [896, 1344] : [1024, 1024];
          const form = new FormData();
          form.set("prompt", english);
          form.set("width", String(width));
          form.set("height", String(height));
          form.set("guidance", quality === "premium" ? "5" : "4");

          try {
            const res = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cloudflareAccountId)}/ai/run/@cf/black-forest-labs/flux-2-klein-4b`,
              {
                method: "POST",
                headers: { Authorization: `Bearer ${cloudflareApiToken}` },
                body: form,
              },
            );

            if (!res.ok) {
              lastStatus = res.status;
              console.error(
                "XOVA Cloudflare image error",
                res.status,
                (await res.text()).slice(0, 500),
              );
            } else {
              const contentType = res.headers.get("content-type") ?? "";
              if (contentType.startsWith("image/")) {
                bytes = new Uint8Array(await res.arrayBuffer());
              } else {
                const payload = (await res.json()) as {
                  result?: { image?: string };
                  success?: boolean;
                  errors?: Array<{ message?: string }>;
                };
                const base64 = payload.result?.image;
                if (payload.success !== false && typeof base64 === "string" && base64.length > 0) {
                  bytes = base64ToBytes(base64.replace(/^data:[^;]+;base64,/, ""));
                } else {
                  console.error(
                    "XOVA Cloudflare image response missing image data",
                    JSON.stringify(payload.errors ?? []).slice(0, 500),
                  );
                }
              }
            }
          } catch (error) {
            console.error("XOVA Cloudflare image request failed", error);
          }

          if (!bytes) {
            return Response.json(
              { error: lastStatus === 429 ? "err.rate" : "err.imageFailed" },
              { status: 502 },
            );
          }

          const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
          const path = `${user.id}/${crypto.randomUUID()}.${isJpeg ? "jpg" : "png"}`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from("xova-images")
            .upload(path, bytes, { contentType: isJpeg ? "image/jpeg" : "image/png", upsert: false });
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

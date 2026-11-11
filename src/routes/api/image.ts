import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { streamText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

interface WireBody {
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
  quality?: "standard" | "premium";
}

/** Lovable-hosted deployment of this same app — the only runtime holding the managed AI key. */
const MANAGED_BACKEND_URL = "https://xova-flow-ai.lovable.app/api/image";
const PROXY_MARKER = "X-Xova-Proxied";
const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";
const SIZES = { "1:1": "1024x1024", "3:2": "1536x1024", "2:3": "1024x1536" } as const;

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

const TRANSLATE_INSTRUCTION =
  "You are a translation engine. Translate the user's image prompt faithfully into natural English. " +
  "Preserve every detail, name, quantity, style term and the exact intent. Add nothing, remove nothing, " +
  "do not explain or comment. If the text is already English, return it unchanged. Output only the translation.";

/** Translates via Lovable AI Gateway. Returns null on any failure so the caller stops the request. */
async function translateToEnglish(text: string, apiKey: string): Promise<string | null> {
  if (!/[^\x00-\x7F]/.test(text)) return text;
  try {
    const gateway = createLovableAiGatewayProvider(apiKey);
    const result = streamText({
      model: gateway("google/gemini-3.8-flash"),
      system: TRANSLATE_INSTRUCTION,
      prompt: text,
      maxRetries: 0,
    });
    const out = (await result.text).trim();
    return out || null;
  } catch (error) {
    console.error("XOVA image translate error", error);
    return null;
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

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          // External host (e.g. Cloudflare Pages): the managed key only exists in the
          // Lovable-hosted backend, so forward the already-authenticated request there.
          if (request.headers.get(PROXY_MARKER)) {
            return Response.json({ error: "err.imageConfig" }, { status: 500 });
          }
          try {
            const upstream = await fetch(MANAGED_BACKEND_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: request.headers.get("authorization") ?? "",
                [PROXY_MARKER]: "1",
              },
              body: await request.text(),
            });
            return new Response(upstream.body, {
              status: upstream.status,
              headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
            });
          } catch (error) {
            console.error("XOVA image proxy error", error);
            return Response.json({ error: "err.imageFailed" }, { status: 502 });
          }
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

        const aspect: keyof typeof SIZES = body.aspect && ASPECTS.has(body.aspect) ? body.aspect : "1:1";
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
          const english = await translateToEnglish(prompt, apiKey);
          if (!english) {
            return Response.json({ error: "err.imageTranslate" }, { status: 502 });
          }

          // Lovable AI Gateway only.
          try {
            const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Lovable-API-Key": apiKey,
                "X-Lovable-AIG-SDK": "fetch",
              },
              body: JSON.stringify({
                model: IMAGE_MODEL,
                prompt: english,
                size: SIZES[aspect],
                quality: quality === "premium" ? "high" : "low",
                n: 1,
              }),
            });
            if (!res.ok) {
              lastStatus = res.status;
              console.error("XOVA image gateway", res.status, (await res.text()).slice(0, 300));
            } else {
              const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
              const item = json.data?.[0];
              if (item?.b64_json) {
                bytes = base64ToBytes(item.b64_json);
              } else if (item?.url) {
                const downloaded = await fetch(item.url);
                if (downloaded.ok) bytes = new Uint8Array(await downloaded.arrayBuffer());
              }
            }
          } catch (error) {
            console.error("XOVA image gateway error", error);
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

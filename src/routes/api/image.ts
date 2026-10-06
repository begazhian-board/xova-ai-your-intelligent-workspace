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
          let gatewayStatus: number | undefined;

          // 0) Always-free path: Pollinations (no key, no credit).
          try {
            const [width, height] =
              aspect === "3:2" ? [1024, 680] : aspect === "2:3" ? [680, 1024] : [1024, 1024];
            const seed = Math.floor(Math.random() * 1000000);
            const res = await fetch(
              `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`,
            );
            const type = res.headers.get("content-type") ?? "";
            if (res.ok && type.startsWith("image/")) {
              const buf = new Uint8Array(await res.arrayBuffer());
              if (buf.length > 1000) bytes = buf;
            } else {
              console.error("XOVA pollinations", res.status, type);
            }
          } catch (error) {
            console.error("XOVA pollinations error", error);
          }

          // 1) Free path: Gemini key directly.
          const geminiKey = process.env["GEMINI_API_KEY"];
          if (!bytes && geminiKey) {
            for (const model of ["gemini-3.1-flash-image", "gemini-2.5-flash-image"]) {
              try {
                const res = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
                    body: JSON.stringify({
                      contents: [{ parts: [{ text: prompt }] }],
                      generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"],
                        imageConfig: { aspectRatio: aspect },
                      },
                    }),
                  },
                );
                if (!res.ok) {
                  console.error("XOVA gemini image", model, res.status, (await res.text()).slice(0, 200));
                  continue;
                }
                const json = (await res.json()) as {
                  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
                };
                const data = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)
                  ?.inlineData?.data;
                if (data) {
                  bytes = base64ToBytes(data);
                  break;
                }
              } catch (error) {
                console.error("XOVA gemini image error", model, error);
              }
            }
          }

          // 2) Fallback: Lovable AI Gateway.
          if (!bytes && apiKey) {
            const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Lovable-API-Key": apiKey as string,
                "X-Lovable-AIG-SDK": "fetch",
              },
              body: JSON.stringify({
                model:
                  quality === "premium"
                    ? "google/gemini-3-pro-image"
                    : "google/gemini-3.1-flash-image",
                messages: [{ role: "user", content: prompt }],
                modalities: ["image", "text"],
                image_config: { aspect_ratio: aspect },
              }),
            });
            if (!res.ok) {
              gatewayStatus = res.status;
              console.error("XOVA image failure", res.status, (await res.text()).slice(0, 400));
            } else {
              const json = (await res.json()) as {
                choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
              };
              const dataUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
              if (dataUrl?.startsWith("data:")) {
                bytes = base64ToBytes(dataUrl.slice(dataUrl.indexOf(",") + 1));
              } else if (dataUrl) {
                const downloaded = await fetch(dataUrl);
                if (downloaded.ok) bytes = new Uint8Array(await downloaded.arrayBuffer());
              }
            }
          }

          if (!bytes) {
            const code =
              gatewayStatus === 402 || gatewayStatus === 403
                ? "err.imageCredits"
                : gatewayStatus === 429
                  ? "err.rate"
                  : "err.imageFailed";
            return Response.json({ error: code }, { status: 502 });
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

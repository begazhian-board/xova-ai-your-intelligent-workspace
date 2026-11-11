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

/** Translate Arabic image prompts while protecting common food names and product names. */
async function translateToEnglish(text: string) {
  // Keep named foods and brands out of machine translation to avoid semantic substitutions.
  const protectedText = text
    .replace(/(?:كيس|باكيت)\s+(?:إندومي|اندومي|اندومى)\s+(?:ب)?(?:الكباب|كباب)\s+المشوي/giu,
      "a packet of Indomie instant noodles served with grilled kebab")
    .replace(/إندومي|اندومي|اندومى/giu, "Indomie instant noodles")
    .replace(/كباب\s+مشوي/giu, "grilled kebab");

  if (!/[^\x00-\x7F]/.test(protectedText)) return protectedText;

  try {
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(protectedText)}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return protectedText;
    const json = (await res.json()) as Array<Array<[string]>>;
    const out = (json[0] ?? []).map((seg) => seg[0]).join("").trim();
    return out || protectedText;
  } catch {
    return protectedText;
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

        const geminiKey = process.env["GEMINI_API_KEY"];
        const hfKey = process.env["HUGGINGFACE_API_KEY"];
        const cloudflareAccountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
        const cloudflareApiToken = process.env["CLOUDFLARE_API_TOKEN"];
        const hasCloudflareImage = Boolean(cloudflareAccountId && cloudflareApiToken);
        if (!hasCloudflareImage && !geminiKey && !hfKey) {
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

        // Lovable Cloud manages the backend and does not expose a project service-role key.
        // Use the verified user's JWT with the publishable key so Storage and table RLS apply per user.
        const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        const supabaseUrl = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
        const publishableKey =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
        if (!accessToken || !supabaseUrl || !publishableKey) {
          return Response.json({ error: "err.auth" }, { status: 401 });
        }
        const supabaseUser = createClient(supabaseUrl, publishableKey, {
          global: { headers: { Authorization: `Bearer ${accessToken}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        // Rate limit per user, rolling hour.
        const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { count, error: countError } = await supabaseUser
          .from("generated_images")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", since);
        if (countError) {
          console.error("XOVA image rate-limit query", countError.message);
          return Response.json({ error: "err.imageStorageAccess" }, { status: 502 });
        }
        if ((count ?? 0) >= RATE_LIMIT) {
          return Response.json({ error: "err.imageRate" }, { status: 429 });
        }

        try {
          let bytes: Uint8Array | null = null;
          let lastStatus: number | undefined;
          let cloudflareStatus: number | undefined;
          let cloudflareReturnedNoImage = false;
          const english = await translateToEnglish(prompt);
          const faithfulImagePrompt =
            `Create an image that faithfully shows this exact requested subject: ${english}. Keep the named objects and their relationship accurate. Do not replace the requested subject with unrelated buildings, places, architecture, or objects.`;


          // Primary: Cloudflare Workers AI (FLUX.1 Schnell).
          // Uses the account's daily free Workers AI allocation; credentials stay server-side.
          if (hasCloudflareImage) {
            try {
              const res = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${cloudflareApiToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ prompt: faithfulImagePrompt.slice(0, 2048), steps: 4 }),
                },
              );
              if (res.ok) {
                const json = (await res.json()) as { result?: { image?: string }; success?: boolean; errors?: unknown[] };
                if (json.result?.image) {
                  bytes = base64ToBytes(json.result.image);
                } else {
                  cloudflareReturnedNoImage = true;
                  console.error("XOVA image Cloudflare: response did not contain result.image", JSON.stringify(json.errors ?? []).slice(0, 300));
                }
              } else {
                cloudflareStatus = res.status;
                lastStatus = res.status;
                console.error("XOVA image Cloudflare", res.status, (await res.text()).slice(0, 300));
              }
            } catch (error) {
              cloudflareReturnedNoImage = true;
              console.error("XOVA image Cloudflare error", error);
            }
          }

          // Secondary: direct Gemini image API, when configured.
          if (!bytes && geminiKey) {
            try {
              const imageModel = quality === "premium" ? "gemini-3-pro-image" : "gemini-3.1-flash-image";
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${imageModel}:generateContent`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: english }] }],
                  generationConfig: { responseModalities: ["IMAGE", "TEXT"], imageConfig: { aspectRatio: aspect } },
                }),
              });
              if (res.ok) {
                const json = (await res.json()) as {
                  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string } }> } }>;
                };
                const data = json.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData?.data;
                if (data) bytes = base64ToBytes(data);
              } else { lastStatus = res.status; console.error("XOVA image Gemini", res.status); }
            } catch (error) { console.error("XOVA image Gemini error", error); }
          }

          // Optional backup: Hugging Face only when its key is configured.
          if (!bytes && hfKey) {
            try {
              const [width, height] = aspect === "3:2" ? [1216, 832] : aspect === "2:3" ? [832, 1216] : [1024, 1024];
              const res = await fetch("https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell", {
                method: "POST",
                headers: { Authorization: `Bearer ${hfKey}`, "Content-Type": "application/json", Accept: "image/png" },
                body: JSON.stringify({ inputs: english, parameters: { width, height } }),
              });
              const type = res.headers.get("content-type") ?? "";
              if (res.ok && type.startsWith("image/")) bytes = new Uint8Array(await res.arrayBuffer());
              else { lastStatus = res.status; console.error("XOVA image Hugging Face", res.status, (await res.text()).slice(0, 200)); }
            } catch (error) { console.error("XOVA image Hugging Face error", error); }
          }

          if (!bytes) {
            const error =
              cloudflareStatus === 401 || cloudflareStatus === 403
                ? "err.imageCloudflareAuth"
                : cloudflareStatus === 429 || lastStatus === 429
                  ? "err.imageProviderRate"
                  : cloudflareStatus === 402
                    ? "err.imageCloudflareBilling"
                    : cloudflareReturnedNoImage
                      ? "err.imageCloudflareResponse"
                      : "err.imageFailed";
            return Response.json({ error }, { status: 502 });
          }

          // The private bucket is provisioned in Lovable Cloud.
          // Upload using the user's own JWT; never depend on an unavailable service-role secret.
          const bucketName = "xova-images";
          const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
          const path = `${user.id}/${crypto.randomUUID()}.${isJpeg ? "jpg" : "png"}`;
          const { error: uploadError } = await supabaseUser.storage
            .from(bucketName)
            .upload(path, bytes, { contentType: isJpeg ? "image/jpeg" : "image/png", upsert: false });
          if (uploadError) {
            console.error("XOVA image upload", uploadError.message);
            const missingBucket = /bucket not found|not found/i.test(uploadError.message);
            return Response.json(
              { error: missingBucket ? "err.imageStorageBucket" : "err.imageStorageUpload" },
              { status: 502 },
            );
          }

          const { data: signed, error: signError } = await supabaseUser.storage
            .from(bucketName)
            .createSignedUrl(path, SIGNED_URL_TTL);
          if (signError || !signed?.signedUrl) {
            console.error("XOVA image sign", signError?.message);
            return Response.json({ error: "err.imageStorageSign" }, { status: 502 });
          }

          const { data: row, error: insertError } = await supabaseUser
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
            return Response.json({ error: "err.imageStorageRecord" }, { status: 502 });
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

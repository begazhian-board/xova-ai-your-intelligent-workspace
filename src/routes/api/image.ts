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

/** Free fallback translation; returns the original text if translation is unavailable. */
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

/** Uses the existing Gemini Flash free-tier text API to preserve the user's exact subject in English. */
async function buildEnglishImagePrompt(text: string, apiKey?: string) {
  if (!/[^\x00-\x7F]/.test(text) || !apiKey) return translateToEnglish(text);

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text:
                "Convert the user's image request into a clear, literal English image-generation prompt. " +
                "Preserve the exact requested subject, product names, food names, quantities, colors, and relationships. " +
                "Do not replace, reinterpret, add, or invent subjects or background objects. " +
                "Keep proper names and brand names unchanged. Return only the English prompt.\n\n" +
                "User request: " + text,
            }],
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 300 },
        }),
      },
    );

    if (res.ok) {
      const json = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const output = json.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();
      if (output) return output.slice(0, 2000);
    } else {
      console.error("XOVA image prompt Gemini", res.status);
    }
  } catch (error) {
    console.error("XOVA image prompt Gemini error", error);
  }

  return translateToEnglish(text);
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
        const cloudflareAccountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
        const cloudflareApiToken = process.env["CLOUDFLARE_API_TOKEN"];
        const hasCloudflareImage = Boolean(cloudflareAccountId && cloudflareApiToken);
        if (!hasCloudflareImage) {
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
          let cloudflareStatus: number | undefined;
          let cloudflareReturnedNoImage = false;
          const english = await buildEnglishImagePrompt(prompt, geminiKey);
          const faithfulImagePrompt =
            `Create an image of exactly this requested subject: ${english}. Preserve every named item, product, food, quantity, and relationship. Do not substitute unrelated subjects or add unrequested objects.`;

          // Primary: Leonardo Phoenix 1.0 through Cloudflare Workers AI.
          // This uses the existing Cloudflare credentials and the account's Workers AI free Neuron allocation.
          if (hasCloudflareImage) {
            try {
              const [width, height] =
                aspect === "3:2" ? [1536, 1024] : aspect === "2:3" ? [1024, 1536] : [1024, 1024];
              const res = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/@cf/leonardo/phoenix-1.0`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${cloudflareApiToken}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    prompt: faithfulImagePrompt.slice(0, 2000),
                    negative_prompt: "unrelated subjects, unintended objects, incorrect product, wrong food, unrelated buildings or architecture",
                    guidance: 7,
                    width,
                    height,
                    num_steps: 25,
                  }),
                },
              );

              if (res.ok) {
                const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
                if (contentType.startsWith("image/") || contentType === "application/octet-stream") {
                  bytes = new Uint8Array(await res.arrayBuffer());
                } else if (contentType.includes("application/json")) {
                  const json = (await res.json()) as {
                    image?: string;
                    result?: { image?: string };
                    errors?: unknown[];
                  };
                  const imageData = json.image ?? json.result?.image;
                  if (imageData) bytes = base64ToBytes(imageData);
                  else {
                    cloudflareReturnedNoImage = true;
                    console.error(
                      "XOVA Phoenix: response did not contain an image",
                      JSON.stringify(json.errors ?? []).slice(0, 300),
                    );
                  }
                } else {
                  cloudflareReturnedNoImage = true;
                  console.error("XOVA Phoenix: unexpected content type", contentType);
                }
              } else {
                cloudflareStatus = res.status;
                console.error("XOVA Phoenix", res.status, (await res.text()).slice(0, 300));
              }
            } catch (error) {
              cloudflareReturnedNoImage = true;
              console.error("XOVA Phoenix error", error);
            }
          }

          // Free fallback: FLUX.1 Schnell, also covered by the Cloudflare Workers AI free allocation.
          if (!bytes && hasCloudflareImage) {
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
                const json = (await res.json()) as {
                  result?: { image?: string };
                  errors?: unknown[];
                };
                if (json.result?.image) {
                  bytes = base64ToBytes(json.result.image);
                } else {
                  cloudflareReturnedNoImage = true;
                  console.error(
                    "XOVA FLUX fallback: response did not contain result.image",
                    JSON.stringify(json.errors ?? []).slice(0, 300),
                  );
                }
              } else {
                cloudflareStatus = res.status;
                console.error("XOVA FLUX fallback", res.status, (await res.text()).slice(0, 300));
              }
            } catch (error) {
              cloudflareReturnedNoImage = true;
              console.error("XOVA FLUX fallback error", error);
            }
          }

          if (!bytes) {
            const error =
              cloudflareStatus === 401 || cloudflareStatus === 403
                ? "err.imageCloudflareAuth"
                : cloudflareStatus === 429
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

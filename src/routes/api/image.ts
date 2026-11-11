import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface WireBody {
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
}

interface CloudflareImageResult {
  result?: {
    image?: string;
  };
  image?: string;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: unknown[];
  success?: boolean;
}

interface GeminiTranslationResult {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const IMAGE_TIMEOUT_MS = 25_000;
const TRANSLATION_TIMEOUT_MS = 3_000;
const HOURLY_LIMIT = 10;
const DAILY_LIMIT = 50;
const SIGNED_URL_TTL = 60 * 60 * 24 * 365;
const ASPECTS = new Set(["1:1", "3:2", "2:3"]);

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

/** Free-tier text translation only. Image generation never calls a paid image model. */
async function translateArabicPrompt(prompt: string): Promise<string> {
  if (!/[^\x00-\x7F]/.test(prompt)) return prompt;

  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return prompt;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{
              text:
                "Translate this Arabic image description into concise English. " +
                "Preserve every object, color, action, and relationship exactly. " +
                "Do not add or remove details. Return only the translation.\\n\\n" +
                prompt,
            }],
          }],
          generationConfig: { maxOutputTokens: 100 },
        }),
      },
    );

    if (!response.ok) {
      console.warn("XOVA image prompt translation unavailable", response.status);
      return prompt;
    }

    const result = (await response.json()) as GeminiTranslationResult;
    const translated = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    return translated && /[a-z]/i.test(translated) ? translated.slice(0, 2048) : prompt;
  } catch (error) {
    console.warn("XOVA image prompt translation timed out or failed", error);
    return prompt;
  }
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function providerError(status: number) {
  if (status === 401 || status === 403) return "err.imageCloudflareAuth";
  if (status === 402) return "err.imageCloudflareBilling";
  if (status === 429) return "err.imageProviderRate";
  if (status === 400) return "err.imageProviderRequest";
  if (status >= 500) return "err.imageProviderBusy";
  return "err.imageFailed";
}

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await authenticate(request);
        if (!user) return Response.json({ error: "err.auth" }, { status: 401 });

        const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
        const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
        if (!accountId || !apiToken) {
          return Response.json({ error: "err.imageCloudflareConfig" }, { status: 503 });
        }

        let body: WireBody;
        try {
          body = (await request.json()) as WireBody;
        } catch {
          return Response.json({ error: "err.generic" }, { status: 400 });
        }

        const prompt = body.prompt?.trim();
        if (!prompt || prompt.length > 2000) {
          return Response.json({ error: "err.generic" }, { status: 400 });
        }

        const aspect = body.aspect && ASPECTS.has(body.aspect) ? body.aspect : "1:1";
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

        // Enforce a per-user hourly and daily ceiling before contacting the image provider.
        const now = new Date();
        const hourStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        const dayStart = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        ).toISOString();

        const [hourCount, dayCount] = await Promise.all([
          supabaseUser
            .from("generated_images")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", hourStart),
          supabaseUser
            .from("generated_images")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", dayStart),
        ]);

        if (hourCount.error || dayCount.error) {
          console.error("XOVA image usage check", hourCount.error?.message, dayCount.error?.message);
          return Response.json({ error: "err.imageStorageAccess" }, { status: 502 });
        }
        if ((hourCount.count ?? 0) >= HOURLY_LIMIT) {
          return Response.json({ error: "err.imageRate" }, { status: 429 });
        }
        if ((dayCount.count ?? 0) >= DAILY_LIMIT) {
          return Response.json({ error: "err.imageDailyLimit" }, { status: 429 });
        }

        try {
          // Translate Arabic with the text-only free tier when available, then call FLUX Schnell.
          const imagePrompt = await translateArabicPrompt(prompt);
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${IMAGE_MODEL}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
              body: JSON.stringify({
                prompt: imagePrompt.slice(0, 2048),
                steps: 4,
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("XOVA free image provider", response.status, errorText.slice(0, 500));
            return Response.json(
              { error: providerError(response.status) },
              { status: response.status === 429 ? 429 : 502 },
            );
          }

          const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
          let bytes: Uint8Array | null = null;
          if (contentType.startsWith("image/") || contentType === "application/octet-stream") {
            bytes = new Uint8Array(await response.arrayBuffer());
          } else {
            const payload = (await response.json()) as CloudflareImageResult;
            const encoded = payload.result?.image ?? payload.image;
            if (encoded) {
              bytes = base64ToBytes(
                encoded.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").replace(/\s/g, ""),
              );
            } else {
              console.error(
                "XOVA FLUX returned no image",
                JSON.stringify(payload.errors ?? payload.messages ?? []).slice(0, 500),
              );
            }
          }

          if (!bytes?.length) {
            return Response.json({ error: "err.imageNoOutput" }, { status: 502 });
          }

          // FLUX Schnell returns JPEG data through Workers AI.
          const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
          const extension = isJpeg ? "jpg" : "png";
          const mimeType = isJpeg ? "image/jpeg" : "image/png";
          const path = `${user.id}/${crypto.randomUUID()}.${extension}`;

          const { error: uploadError } = await supabaseUser.storage
            .from("xova-images")
            .upload(path, bytes, { contentType: mimeType, upsert: false });

          if (uploadError) {
            console.error("XOVA image upload", uploadError.message);
            const missingBucket = /bucket not found|not found/i.test(uploadError.message);
            return Response.json(
              { error: missingBucket ? "err.imageStorageBucket" : "err.imageStorageUpload" },
              { status: 502 },
            );
          }

          const { data: signed, error: signError } = await supabaseUser.storage
            .from("xova-images")
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
              quality: "standard",
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
            quality: "standard",
          });
        } catch (error) {
          const name = error instanceof Error ? error.name : "";
          if (name === "TimeoutError" || name === "AbortError") {
            console.error("XOVA FLUX request timed out", IMAGE_TIMEOUT_MS);
            return Response.json({ error: "err.imageTimeout" }, { status: 504 });
          }
          console.error("XOVA image error", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
    },
  },
});

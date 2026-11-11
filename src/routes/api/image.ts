import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface WireBody {
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
}

interface ZhipuImageResult {
  data?: Array<{ url?: string; file_url?: string }>;
  code?: string;
  message?: string;
}

interface GeminiTranslationResult {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

const IMAGE_MODEL = "cogview-3-flash";
const IMAGE_TIMEOUT_MS = 60_000;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 25_000;
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
async function translateArabicPrompt(prompt: string): Promise<string | null> {
  if (!/[^\x00-\x7F]/.test(prompt)) return prompt;

  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey) return null;

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
          generationConfig: { maxOutputTokens: 300, temperature: 0.1 },
        }),
      },
    );

    if (!response.ok) {
      console.warn("XOVA image prompt translation unavailable", response.status);
      return null;
    }

    const result = (await response.json()) as GeminiTranslationResult;
    const translated = result.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

    return translated && /[a-z]/i.test(translated) ? translated.slice(0, 2048) : null;
  } catch (error) {
    console.warn("XOVA image prompt translation timed out or failed", error);
    return null;
  }
}

function providerError(status: number) {
  if (status === 401 || status === 403) return "err.imageZhipuAuth";
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

        const apiKey = process.env["ZHIPU_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "err.imageZhipuConfig" }, { status: 503 });
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
          // Translate the prompt when needed, then call Zhipu's CogView-3-Flash image API.
          const imagePrompt = await translateArabicPrompt(prompt);
          if (!imagePrompt) {
            return Response.json({ error: "err.imageTranslationUnavailable" }, { status: 503 });
          }
          const size =
            aspect === "3:2" ? "1344x768" :
            aspect === "2:3" ? "768x1344" :
            "1024x1024";
          const response = await fetch(
            "https://open.bigmodel.cn/api/paas/v4/images/generations",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
              body: JSON.stringify({
                model: IMAGE_MODEL,
                prompt: imagePrompt.slice(0, 2048),
                size,
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("XOVA CogView image provider", response.status, errorText.slice(0, 500));
            return Response.json(
              { error: providerError(response.status) },
              { status: response.status === 429 ? 429 : 502 },
            );
          }

          const payload = (await response.json()) as ZhipuImageResult;
          const imageUrl = payload.data?.[0]?.url ?? payload.data?.[0]?.file_url;
          if (!imageUrl || !/^https:\/\//i.test(imageUrl)) {
            console.error("XOVA CogView returned no valid image URL", JSON.stringify(payload).slice(0, 500));
            return Response.json({ error: "err.imageNoOutput" }, { status: 502 });
          }

          // Download the provider's temporary image URL before storing it privately in Supabase.
          const imageResponse = await fetch(imageUrl, {
            signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS),
          });
          if (!imageResponse.ok) {
            console.error("XOVA CogView image download failed", imageResponse.status);
            return Response.json({ error: "err.imageDownload" }, { status: 502 });
          }
          const imageContentType = (imageResponse.headers.get("content-type") ?? "").toLowerCase();
          if (!imageContentType.startsWith("image/")) {
            console.error("XOVA CogView returned a non-image file", imageContentType);
            return Response.json({ error: "err.imageNoOutput" }, { status: 502 });
          }
          const bytes = new Uint8Array(await imageResponse.arrayBuffer());
          if (!bytes.length) {
            return Response.json({ error: "err.imageNoOutput" }, { status: 502 });
          }

          // Detect the actual downloaded image format before uploading it.
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
            console.error("XOVA CogView request or image download timed out");
            return Response.json({ error: "err.imageTimeout" }, { status: 504 });
          }
          console.error("XOVA image error", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
    },
  },
});

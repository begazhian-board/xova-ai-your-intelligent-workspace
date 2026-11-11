import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface WireBody {
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
}

interface GeminiImageResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: {
          data?: string;
          mimeType?: string;
        };
      }>;
    };
    finishReason?: string;
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

const IMAGE_MODEL = "gemini-3.1-flash-lite-image";
const IMAGE_TIMEOUT_MS = 26_000;
const RATE_LIMIT = 10;
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

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function imageErrorForStatus(status: number) {
  if (status === 401) return "err.imageGeminiAuth";
  if (status === 403) return "err.imageModelAccess";
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

        // Paid model use is deliberately opt-in; this prevents accidental API charges.
        if (process.env["XOVA_IMAGE_GENERATION_ENABLED"] !== "true") {
          return Response.json({ error: "err.imageDisabled" }, { status: 503 });
        }

        const geminiKey = process.env["GEMINI_API_KEY"];
        if (!geminiKey) {
          return Response.json({ error: "err.imageKeyMissing" }, { status: 503 });
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
          // One direct Arabic-or-English prompt to the fast native image model.
          // No translator call, Cloudflare Workers AI, FLUX, or Phoenix fallback.
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": geminiKey,
              },
              signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                  responseModalities: ["IMAGE"],
                  imageConfig: {
                    aspectRatio: aspect,
                    imageSize: "1K",
                  },
                },
              }),
            },
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error("XOVA Gemini image API", response.status, errorText.slice(0, 600));
            return Response.json(
              { error: imageErrorForStatus(response.status) },
              { status: response.status === 429 ? 429 : 502 },
            );
          }

          const result = (await response.json()) as GeminiImageResponse;
          const parts = result.candidates?.[0]?.content?.parts ?? [];
          const imagePart = parts.find((part) => part.inlineData?.data);
          const imageData = imagePart?.inlineData?.data;

          if (!imageData) {
            const blocked = Boolean(
              result.promptFeedback?.blockReason ||
              result.candidates?.[0]?.finishReason === "SAFETY",
            );
            console.error(
              "XOVA Gemini returned no image",
              result.promptFeedback?.blockReason ??
                result.candidates?.[0]?.finishReason ??
                "No inline image part",
            );
            return Response.json(
              { error: blocked ? "err.imageBlocked" : "err.imageNoOutput" },
              { status: 502 },
            );
          }

          const bytes = base64ToBytes(imageData);
          const mimeType = imagePart?.inlineData?.mimeType ?? "image/png";
          const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png";
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
            console.error("XOVA Gemini image timed out", IMAGE_TIMEOUT_MS);
            return Response.json({ error: "err.imageTimeout" }, { status: 504 });
          }
          console.error("XOVA image error", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
    },
  },
});

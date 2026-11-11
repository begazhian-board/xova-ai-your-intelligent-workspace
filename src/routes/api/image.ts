import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

interface WireBody {
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
}

interface HordeAsyncResponse {
  id?: string;
  message?: string;
  wait_time?: number;
  queue_position?: number;
}

interface HordeCheckResponse {
  done?: boolean;
  finished?: number;
  faulted?: boolean;
  wait_time?: number;
  queue_position?: number;
  waiting?: number;
  processing?: number;
}

interface HordeStatusResponse {
  done?: boolean;
  faulted?: boolean;
  generations?: Array<{ img?: string; seed?: number; model?: string }>;
}

interface LovableTranslationResult {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

const HORDE_API = "https://aihorde.net/api/v2";
const HORDE_ANONYMOUS_KEY = "0000000000";
const HORDE_CLIENT_AGENT = "XOVA-AI:1.0:begazhian-board";
const IMAGE_SUBMIT_TIMEOUT_MS = 15_000;
const IMAGE_DOWNLOAD_TIMEOUT_MS = 25_000;
const TRANSLATION_TIMEOUT_MS = 12_000;
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

/** Translate Arabic prompts through Lovable AI Gateway using the project's AI credits. */
async function translateArabicPrompt(prompt: string): Promise<string | null> {
  if (!/[\\u0600-\\u06FF]/.test(prompt)) return prompt;

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("err.imageLovableConfig");

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "xova-ai",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(TRANSLATION_TIMEOUT_MS),
      body: JSON.stringify({
        model: "google/gemini-3.7-flash",
        messages: [
          {
            role: "system",
            content:
              "Translate Arabic image descriptions into concise, natural English. " +
              "Preserve every object, color, action, position, and relationship. " +
              "Do not add, omit, reinterpret, or embellish details. " +
              "Return only the English translation.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 300,
        stream: false,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("XOVA Lovable prompt translation failed", response.status, detail.slice(0, 500));
      if (response.status === 402) throw new Error("err.imageLovableCredits");
      if (response.status === 429) throw new Error("err.imageLovableRate");
      if (response.status === 401 || response.status === 403) throw new Error("err.imageLovableAuth");
      throw new Error("err.imageTranslationUnavailable");
    }

    const result = (await response.json()) as LovableTranslationResult;
    const content = result.choices?.[0]?.message?.content;
    const translated = (typeof content === "string"
      ? content
      : content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join(""))
      ?.trim();

    return translated && /[a-z]/i.test(translated) ? translated.slice(0, 2048) : null;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("err.")) throw error;
    console.warn("XOVA Lovable prompt translation timed out or failed", error);
    throw new Error("err.imageTranslationUnavailable");
  }
}

function providerError(status: number) {
  if (status === 401 || status === 403) return "err.imageHordeAuth";
  if (status === 404) return "err.imageQueueExpired";
  if (status === 429) return "err.imageProviderRate";
  if (status === 400) return "err.imageProviderRequest";
  if (status >= 500) return "err.imageProviderBusy";
  return "err.imageFailed";
}

function base64ToBytes(base64: string) {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function hordeHeaders() {
  return {
    apikey: HORDE_ANONYMOUS_KEY,
    "Client-Agent": HORDE_CLIENT_AGENT,
    "Content-Type": "application/json",
  };
}

export const Route = createFileRoute("/api/image")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await authenticate(request);
        if (!user) return Response.json({ error: "err.auth" }, { status: 401 });

        const jobId = new URL(request.url).searchParams.get("jobId");
        if (!jobId || !/^[a-zA-Z0-9-]{8,128}$/.test(jobId)) {
          return Response.json({ error: "err.generic" }, { status: 400 });
        }

        try {
          const checkResponse = await fetch(`${HORDE_API}/generate/check/${encodeURIComponent(jobId)}`, {
            headers: hordeHeaders(),
            signal: AbortSignal.timeout(12_000),
          });
          if (!checkResponse.ok) {
            const detail = await checkResponse.text();
            console.error("XOVA AI Horde check", checkResponse.status, detail.slice(0, 500));
            return Response.json(
              { error: providerError(checkResponse.status) },
              { status: checkResponse.status === 429 ? 429 : 502 },
            );
          }

          const check = (await checkResponse.json()) as HordeCheckResponse;
          if (check.faulted) {
            return Response.json({ error: "err.imageGenerationFailed" }, { status: 502 });
          }

          const isDone = check.done === true || (check.finished ?? 0) >= 1;
          if (!isDone) {
            return Response.json({
              pending: true,
              waitTime: check.wait_time ?? null,
              queuePosition: check.queue_position ?? null,
              waiting: check.waiting ?? null,
              processing: check.processing ?? null,
            });
          }

          const statusResponse = await fetch(`${HORDE_API}/generate/status/${encodeURIComponent(jobId)}`, {
            headers: hordeHeaders(),
            signal: AbortSignal.timeout(12_000),
          });
          if (!statusResponse.ok) {
            const detail = await statusResponse.text();
            console.error("XOVA AI Horde status", statusResponse.status, detail.slice(0, 500));
            return Response.json(
              { error: providerError(statusResponse.status) },
              { status: statusResponse.status === 429 ? 429 : 502 },
            );
          }

          const status = (await statusResponse.json()) as HordeStatusResponse;
          if (status.faulted) {
            return Response.json({ error: "err.imageGenerationFailed" }, { status: 502 });
          }

          const imagePayload = status.generations?.[0]?.img;
          if (!imagePayload) {
            return Response.json({ pending: true, waitTime: 2, queuePosition: null });
          }

          let bytes: Uint8Array;
          let imageContentType = "image/webp";
          if (/^https:\/\//i.test(imagePayload)) {
            const imageResponse = await fetch(imagePayload, {
              signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS),
            });
            if (!imageResponse.ok) {
              console.error("XOVA AI Horde image download failed", imageResponse.status);
              return Response.json({ error: "err.imageDownload" }, { status: 502 });
            }
            imageContentType = (imageResponse.headers.get("content-type") ?? "").toLowerCase();
            if (!["image/png", "image/jpeg", "image/webp"].some((type) => imageContentType.includes(type))) {
              console.error("XOVA AI Horde returned unsupported image content type", imageContentType);
              return Response.json({ error: "err.imageNoOutput" }, { status: 502 });
            }
            bytes = new Uint8Array(await imageResponse.arrayBuffer());
          } else {
            // The API can also return the image as base64-encoded WebP data.
            try {
              const encoded = imagePayload.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
              bytes = base64ToBytes(encoded);
              imageContentType = "image/webp";
            } catch (error) {
              console.error("XOVA AI Horde returned unreadable base64 image data", error);
              return Response.json({ error: "err.imageNoOutput" }, { status: 502 });
            }
          }

          if (!bytes.length) {
            return Response.json({ error: "err.imageNoOutput" }, { status: 502 });
          }

          const isJpeg = imageContentType.includes("jpeg") || (bytes[0] === 0xff && bytes[1] === 0xd8);
          const isWebp = imageContentType.includes("webp") || (
            bytes.length >= 12 &&
            String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
          );
          const extension = isJpeg ? "jpg" : isWebp ? "webp" : "png";
          const mimeType = isJpeg ? "image/jpeg" : isWebp ? "image/webp" : "image/png";

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

          const originalPrompt = new URL(request.url).searchParams.get("prompt")?.slice(0, 2000) ?? "";
          const aspectParam = new URL(request.url).searchParams.get("aspect") ?? "1:1";
          const aspect = ASPECTS.has(aspectParam) ? aspectParam : "1:1";

          const { data: row, error: insertError } = await supabaseUser
            .from("generated_images")
            .insert({
              user_id: user.id,
              prompt: originalPrompt,
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
            pending: false,
            image: signed.signedUrl,
            id: row.id,
            createdAt: row.created_at,
            aspect,
            quality: "standard",
          });
        } catch (error) {
          const name = error instanceof Error ? error.name : "";
          if (name === "TimeoutError" || name === "AbortError") {
            return Response.json({ error: "err.imageTimeout" }, { status: 504 });
          }
          console.error("XOVA AI Horde polling or image storage error", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
      POST: async ({ request }) => {
        const user = await authenticate(request);
        if (!user) return Response.json({ error: "err.auth" }, { status: 401 });

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
          // AI Horde runs image jobs on volunteer GPUs, so submit once and poll separately.
          let imagePrompt: string;
          try {
            const translated = await translateArabicPrompt(prompt);
            if (!translated) throw new Error("err.imageTranslationUnavailable");
            imagePrompt = translated;
          } catch (error) {
            const code =
              error instanceof Error && error.message.startsWith("err.")
                ? error.message
                : "err.imageTranslationUnavailable";
            const status = code === "err.imageLovableCredits" ? 402 : code === "err.imageLovableRate" ? 429 : 503;
            return Response.json({ error: code }, { status });
          }

          const width = aspect === "3:2" ? 768 : 512;
          const height = aspect === "2:3" ? 768 : 512;
          const response = await fetch(`${HORDE_API}/generate/async`, {
            method: "POST",
            headers: hordeHeaders(),
            signal: AbortSignal.timeout(IMAGE_SUBMIT_TIMEOUT_MS),
            body: JSON.stringify({
              prompt: imagePrompt.slice(0, 2048),
              params: {
                width,
                height,
                steps: 28,
                cfg_scale: 7,
                sampler_name: "k_euler",
                karras: true,
                n: 1,
              },
              nsfw: false,
              censor_nsfw: true,
              trusted_workers: true,
              validated_backends: true,
              slow_workers: true,
              extra_slow_workers: true,
              r2: false,
              shared: true,
              replacement_filter: true,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error("XOVA AI Horde submit", response.status, errorText.slice(0, 500));
            return Response.json(
              { error: providerError(response.status) },
              { status: response.status === 429 ? 429 : 502 },
            );
          }

          const submitted = (await response.json()) as HordeAsyncResponse;
          if (!submitted.id) {
            console.error("XOVA AI Horde returned no request ID", JSON.stringify(submitted).slice(0, 500));
            return Response.json({ error: "err.imageNoOutput" }, { status: 502 });
          }

          return Response.json(
            {
              jobId: submitted.id,
              pending: true,
              waitTime: submitted.wait_time ?? null,
              queuePosition: submitted.queue_position ?? null,
            },
            { status: 202 },
          );
        } catch (error) {
          const name = error instanceof Error ? error.name : "";
          if (name === "TimeoutError" || name === "AbortError") {
            console.error("XOVA AI Horde submit request timed out");
            return Response.json({ error: "err.imageSubmitTimeout" }, { status: 504 });
          }
          console.error("XOVA image error", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
    },
  },
});

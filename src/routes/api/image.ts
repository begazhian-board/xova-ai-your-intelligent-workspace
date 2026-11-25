import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { aiProviderErrorCode } from "@/lib/ai-provider.server";

interface WireBody {
  operation?: "generate" | "save-overlay";
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
  quality?: "standard" | "premium";
  overlayText?: string;
  imageId?: string;
  compositeDataUrl?: string;
}

const ASPECTS = new Set(["1:1", "3:2", "2:3"]);

/** Generations allowed per user per rolling hour. */
const RATE_LIMIT = 15;
/** Keep XOVA image generation below Cloudflare's 10,000-Neuron free daily allowance. */
const DAILY_NEURON_BUDGET = 9_000;
/** Conservative estimates include a margin above the published model rates. */
const STANDARD_NEURONS: Record<"1:1" | "3:2" | "2:3", number> = {
  "1:1": 110,
  "3:2": 170,
  "2:3": 170,
};
const PREMIUM_NEURONS = 1_450;
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

        let body: WireBody;
        try {
          body = (await request.json()) as WireBody;
        } catch {
          return Response.json({ error: "err.generic" }, { status: 400 });
        }

        // Saving browser-rendered text is a storage-only operation: no AI request or Neurons.
        if (body.operation === "save-overlay") {
          const imageId = body.imageId?.trim();
          const dataUrl = body.compositeDataUrl ?? "";
          const match = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
          if (!imageId || !match || dataUrl.length > 12_000_000) {
            return Response.json({ error: "err.imageOverlaySave" }, { status: 400 });
          }

          let compositeBytes: Uint8Array;
          try {
            compositeBytes = base64ToBytes(match[1]);
          } catch {
            return Response.json({ error: "err.imageOverlaySave" }, { status: 400 });
          }
          if (
            compositeBytes.length < 16 ||
            compositeBytes.length > 8 * 1024 * 1024 ||
            compositeBytes[0] !== 0x89 ||
            compositeBytes[1] !== 0x50 ||
            compositeBytes[2] !== 0x4e ||
            compositeBytes[3] !== 0x47
          ) {
            return Response.json({ error: "err.imageOverlaySave" }, { status: 400 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: imageRow, error: rowError } = await supabaseAdmin
            .from("generated_images")
            .select("storage_path")
            .eq("id", imageId)
            .eq("user_id", user.id)
            .single();
          if (rowError || !imageRow?.storage_path) {
            return Response.json({ error: "err.imageOverlaySave" }, { status: 404 });
          }

          const finalStoragePath = imageRow.storage_path.replace(/\.[^.]+$/, ".png");
          const { error: uploadError } = await supabaseAdmin.storage
            .from("xova-images")
            .upload(finalStoragePath, compositeBytes, {
              contentType: "image/png",
              upsert: true,
              cacheControl: "0",
            });
          if (uploadError) {
            console.error("XOVA text overlay save failed", uploadError.message);
            return Response.json({ error: "err.imageOverlaySave" }, { status: 502 });
          }

          const { data: signed, error: signError } = await supabaseAdmin.storage
            .from("xova-images")
            .createSignedUrl(finalStoragePath, SIGNED_URL_TTL);
          if (signError || !signed?.signedUrl) {
            return Response.json({ error: "err.imageOverlaySave" }, { status: 502 });
          }

          await supabaseAdmin
            .from("generated_images")
            .update({ storage_path: finalStoragePath, image_url: signed.signedUrl })
            .eq("id", imageId)
            .eq("user_id", user.id);

          if (finalStoragePath !== imageRow.storage_path) {
            await supabaseAdmin.storage.from("xova-images").remove([imageRow.storage_path]);
          }

          return Response.json({ image: signed.signedUrl });
        }

        const prompt = body.prompt?.trim();
        if (!prompt) return Response.json({ error: "err.generic" }, { status: 400 });
        if (prompt.length > 2000) return Response.json({ error: "err.generic" }, { status: 400 });

        const overlayText = body.overlayText?.trim().slice(0, 500) ?? "";
        const aspect = body.aspect && ASPECTS.has(body.aspect) ? body.aspect : "1:1";
        // Accurate text is composited locally; use the economical 4B model for text-bearing images.
        const quality = overlayText ? "standard" : body.quality === "premium" ? "premium" : "standard";

        const cloudflareAccountId = process.env["CLOUDFLARE_ACCOUNT_ID"]?.trim();
        const cloudflareApiToken = process.env["CLOUDFLARE_API_TOKEN"]?.trim();
        if (!cloudflareAccountId || !cloudflareApiToken) {
          return Response.json({ error: "err.unavailable" }, { status: 500 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Track all XOVA image generations for the current UTC day across users.
        // Fail closed if usage cannot be checked so a misconfiguration cannot create surprise charges.
        const utcDayStart = new Date();
        utcDayStart.setUTCHours(0, 0, 0, 0);
        const usageBuckets = [
          { quality: "standard", aspect: "1:1", neurons: STANDARD_NEURONS["1:1"] },
          { quality: "standard", aspect: "3:2", neurons: STANDARD_NEURONS["3:2"] },
          { quality: "standard", aspect: "2:3", neurons: STANDARD_NEURONS["2:3"] },
          { quality: "premium", aspect: "1:1", neurons: PREMIUM_NEURONS },
          { quality: "premium", aspect: "3:2", neurons: PREMIUM_NEURONS },
          { quality: "premium", aspect: "2:3", neurons: PREMIUM_NEURONS },
        ] as const;
        const usageResults = await Promise.all(
          usageBuckets.map((bucket) =>
            supabaseAdmin
              .from("generated_images")
              .select("id", { count: "exact", head: true })
              .eq("quality", bucket.quality)
              .eq("aspect", bucket.aspect)
              .gte("created_at", utcDayStart.toISOString()),
          ),
        );
        if (usageResults.some((result) => result.error)) {
          console.error("XOVA image daily usage check failed");
          return Response.json({ error: "err.unavailable" }, { status: 503 });
        }
        const usedNeurons = usageBuckets.reduce(
          (total, bucket, index) => total + (usageResults[index].count ?? 0) * bucket.neurons,
          0,
        );
        const requestedNeurons =
          quality === "premium" ? PREMIUM_NEURONS : STANDARD_NEURONS[aspect];
        if (usedNeurons + requestedNeurons > DAILY_NEURON_BUDGET) {
          return Response.json({ error: "err.imageDailyLimit" }, { status: 429 });
        }

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
          let lastProviderDetail = "";
          // Faithful English translation of the user's own words — nothing added.
          const translatedPrompt = await translateToEnglish(prompt);
          const english = overlayText
            ? `${translatedPrompt}. Create only the visual background and scene. Do not render any text, letters, words, numbers, logos, signatures, labels, or pseudo-text. Leave a clean, uncluttered lower-center area for a separate text overlay.`
            : translatedPrompt;

          // Use the economical 4B model by default; premium selects the higher-detail 9B model.
          // Keep the account token server-side; never expose it to the browser.
          const [width, height] =
            aspect === "3:2" ? [1344, 896] : aspect === "2:3" ? [896, 1344] : [1024, 1024];
          const form = new FormData();
          form.set("prompt", english);
          form.set("width", String(width));
          form.set("height", String(height));
          const modelId =
            quality === "premium"
              ? "@cf/black-forest-labs/flux-2-klein-9b"
              : "@cf/black-forest-labs/flux-2-klein-4b";
          form.set("guidance", quality === "premium" ? "5" : "4");

          try {
            for (let attempt = 1; attempt <= 3; attempt += 1) {
              const res = await fetch(
                "https://api.cloudflare.com/client/v4/accounts/" +
                  encodeURIComponent(cloudflareAccountId) + "/ai/run/" + modelId,
                {
                  method: "POST",
                  headers: { Authorization: "Bearer " + cloudflareApiToken },
                  body: form,
                  signal: request.signal,
                },
              );

              if (!res.ok) {
                lastStatus = res.status;
                lastProviderDetail = await res.text().catch(() => "");
                console.error("XOVA Cloudflare image error", res.status, lastProviderDetail.slice(0, 500));

                const dailyQuotaExceeded =
                  /3036|daily free allocation|used up your daily/i.test(lastProviderDetail);
                const retryable = [429, 500, 502, 503, 504].includes(res.status) && !dailyQuotaExceeded;
                if (!retryable || attempt === 3) break;

                const retryAfter = Number(res.headers.get("retry-after"));
                const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
                  ? Math.min(retryAfter * 1000, 3000)
                  : attempt * 800;
                await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
                continue;
              }

              const contentType = res.headers.get("content-type") ?? "";
              if (contentType.startsWith("image/")) {
                bytes = new Uint8Array(await res.arrayBuffer());
              } else {
                const payload = (await res.json()) as {
                  result?: { image?: string };
                  success?: boolean;
                  errors?: Array<{ message?: string; code?: number | string }>;
                };
                const base64 = payload.result?.image;
                if (payload.success !== false && typeof base64 === "string" && base64.length > 0) {
                  bytes = base64ToBytes(base64.replace(/^data:[^;]+;base64,/, ""));
                } else {
                  lastProviderDetail = JSON.stringify(payload.errors ?? []);
                  console.error("XOVA Cloudflare image response missing image data", lastProviderDetail.slice(0, 500));
                }
              }
              break;
            }
          } catch (error) {
            if (request.signal.aborted) return new Response(null, { status: 499 });
            console.error("XOVA Cloudflare image request failed", error);
          }

          if (!bytes) {
            const providerError = lastStatus
              ? aiProviderErrorCode(lastStatus, lastProviderDetail)
              : "err.imageFailed";
            const errorCode = ["err.aiDailyLimit", "err.aiBusy", "err.rate"].includes(providerError)
              ? providerError
              : "err.imageFailed";
            return Response.json({ error: errorCode }, { status: 502 });
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
              prompt: overlayText
                ? `${prompt}\\n\\n[XOVA_TEXT_OVERLAY]\\n${overlayText}`
                : prompt,
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
            overlayText: overlayText || undefined,
          });
        } catch (error) {
          console.error("XOVA image error", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
    },
  },
});

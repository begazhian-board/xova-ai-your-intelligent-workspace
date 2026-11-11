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

/** Strictly translates Arabic image requests without inventing or embellishing details. */
async function buildEnglishImagePrompt(text: string, apiKey?: string): Promise<string> {
  if (!/[^\x00-\x7F]/.test(text)) return text;
  // Translation is best-effort: if Gemini is unavailable, let the image model try the original Arabic prompt.
  if (!apiKey) {
    console.warn("XOVA image prompt translation skipped: GEMINI_API_KEY is missing");
    return text;
  }

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(8_000),
        body: JSON.stringify({
          contents: [{
            parts: [{
              text:
                "Translate the following Arabic image request into English as literally as possible. " +
                "This is translation only, not creative prompt writing. " +
                "Do not add objects, locations, people, styles, lighting, backgrounds, or details. " +
                "Do not replace or reinterpret any food, product, brand, or named subject. " +
                "Write brand and food names phonetically when needed (for example, اندومي = Indomie). " +
                "Keep the same objects and relationships in the same order. " +
                "Return only the translated request in one sentence, with no explanation or quotation marks.\\n\\n" +
                "Arabic request: " + text,
            }],
          }],
          generationConfig: { maxOutputTokens: 128 },
        }),
      },
    );

    if (!res.ok) {
      const details = await res.text();
      console.error("XOVA image prompt translation Gemini", res.status, details.slice(0, 500));
      return text;
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const output = json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim()
      .replace(/^["'“”]+|["'“”]+$/g, "");

    if (!output || !/[a-z]/i.test(output)) {
      console.error("XOVA image prompt translation returned no usable English text");
      return text;
    }
    return output.slice(0, 1000);
  } catch (error) {
    console.error("XOVA image prompt translation error", error);
    return text;
  }
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Cloudflare model outputs differ: Phoenix may return base64 as result:string, while FLUX returns result.image. */
async function readCloudflareImageResponse(response: Response, provider: string): Promise<Uint8Array | null> {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.startsWith("image/") || contentType === "application/octet-stream") {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length ? bytes : null;
  }

  const raw = await response.text();
  try {
    const payload = JSON.parse(raw) as {
      result?: string | { image?: string };
      image?: string;
      errors?: unknown[];
      success?: boolean;
      messages?: unknown[];
    };
    const encoded =
      typeof payload.result === "string"
        ? payload.result
        : payload.result?.image ?? payload.image;

    if (encoded) {
      const base64 = encoded.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").replace(/\s/g, "");
      const bytes = base64ToBytes(base64);
      if (bytes.length) return bytes;
    }

    console.error(
      `XOVA image ${provider}: no base64 image in response`,
      JSON.stringify(payload.errors ?? payload.messages ?? []).slice(0, 500),
    );
  } catch {
    // Some model responses may provide the encoded image as the raw body.
    const rawBase64 = raw.trim().replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "").replace(/\s/g, "");
    if (/^[A-Za-z0-9+/]+={0,2}$/.test(rawBase64) && rawBase64.length > 1000) {
      try {
        const bytes = base64ToBytes(rawBase64);
        if (bytes.length) return bytes;
      } catch {
        // Fall through to the provider diagnostic below.
      }
    }
  }

  console.error(`XOVA image ${provider}: unexpected response`, response.status, contentType, raw.slice(0, 500));
  return null;
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

          // Fast path: FLUX.1 Schnell uses its minimum 4 steps.
          // A hard timeout prevents a slow provider from keeping the request open indefinitely.
          try {
            const res = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/run/@cf/black-forest-labs/flux-1-schnell`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${cloudflareApiToken}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ prompt: english.slice(0, 2048), steps: 4 }),
                signal: AbortSignal.timeout(45_000),
              },
            );

            if (res.ok) {
              bytes = await readCloudflareImageResponse(res, "FLUX Schnell");
              if (!bytes) cloudflareReturnedNoImage = true;
            } else {
              cloudflareStatus = res.status;
              console.error("XOVA FLUX Schnell", res.status, (await res.text()).slice(0, 300));
            }
          } catch (error) {
            cloudflareReturnedNoImage = true;
            console.error("XOVA FLUX Schnell error or timeout", error);
          }

          if (!bytes) {
            const error =
              cloudflareStatus === 401 || cloudflareStatus === 403
                ? "err.imageCloudflareAuth"
                : cloudflareStatus === 429
                  ? "err.imageProviderRate"
                  : cloudflareStatus === 402
                    ? "err.imageCloudflareBilling"
                    : cloudflareStatus === 400
                      ? "err.imageProviderRequest"
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

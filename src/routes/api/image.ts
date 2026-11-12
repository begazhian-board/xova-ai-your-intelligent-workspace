import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

interface WireBody {
  prompt?: string;
  aspect?: "1:1" | "3:2" | "2:3";
  quality?: "standard" | "premium";
}

const IMAGE_MODEL = "openai/gpt-image-2.5-sunburst";
const TRANSLATION_MODEL = "google/gemini-3.8-flash";
const SIZES = { "1:1": "1024x1024", "3:2": "1536x1024", "2:3": "1024x1536" } as const;
const ASPECTS = new Set(["1:1", "3:2", "2:3"]);
const RATE_LIMIT = 15;
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
  "Translate this image prompt into clear, natural English for an image-generation model. " +
  "Preserve the user's exact subject, objects, actions, composition, style, colors, lighting, " +
  "camera angle, and all constraints. Do not add new objects or creative details. " +
  "Return only the translated prompt.";

async function translateToEnglish(text: string, apiKey: string): Promise<string> {
  if (!/[^\x00-\x7F]/.test(text)) return text;

  try {
    const gateway = createLovableAiGatewayProvider(apiKey);
    const result = await generateText({
      model: gateway(TRANSLATION_MODEL),
      system: TRANSLATE_INSTRUCTION,
      prompt: text,
      maxOutputTokens: 1200,
      temperature: 0.1,
      maxRetries: 0,
    });
    return result.text.trim() || text;
  } catch (error) {
    // Translation is an enhancement, never a reason to block image generation.
    console.error("XOVA image prompt translation failed; using the original prompt", error);
    return text;
  }
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function gatewayErrorCode(status: number | undefined) {
  if (status === 402) return "err.imageCredits";
  if (status === 401 || status === 403) return "err.imageConfig";
  if (status === 429) return "err.rate";
  return "err.imageFailed";
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

        const prompt = body.prompt?.trim();
        if (!prompt) return Response.json({ error: "err.generic" }, { status: 400 });
        if (prompt.length > 2000) return Response.json({ error: "err.generic" }, { status: 400 });

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          console.error("XOVA image generation is missing LOVABLE_API_KEY");
          return Response.json({ error: "err.imageConfig" }, { status: 503 });
        }

        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseServiceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        if (!supabaseUrl || !supabaseServiceKey) {
          console.error("XOVA image generation is missing Supabase server credentials");
          return Response.json({ error: "err.imageStorage" }, { status: 503 });
        }

        const aspect: keyof typeof SIZES =
          body.aspect && ASPECTS.has(body.aspect) ? body.aspect : "1:1";
        const quality = body.quality === "premium" ? "premium" : "standard";

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
          const { count, error: countError } = await supabaseAdmin
            .from("generated_images")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .gte("created_at", since);

          if (countError) {
            console.error("XOVA image rate-limit query failed", countError.message);
            return Response.json({ error: "err.imageStorage" }, { status: 503 });
          }
          if ((count ?? 0) >= RATE_LIMIT) {
            return Response.json({ error: "err.imageRate" }, { status: 429 });
          }

          // Translate Arabic prompts when possible; if translation is unavailable, the
          // original prompt still goes to the multilingual image model.
          const imagePrompt = await translateToEnglish(prompt, apiKey);

          const response = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: IMAGE_MODEL,
              prompt: imagePrompt,
              size: SIZES[aspect],
              quality: quality === "premium" ? "high" : "medium",
              n: 1,
            }),
          });

          if (!response.ok) {
            const details = (await response.text()).slice(0, 500);
            console.error("XOVA Lovable image gateway error", response.status, details);
            return Response.json(
              { error: gatewayErrorCode(response.status) },
              { status: response.status === 429 ? 429 : 502 },
            );
          }

          const payload = (await response.json()) as {
            data?: Array<{ b64_json?: string; url?: string }>;
          };
          const item = payload.data?.[0];
          let bytes: Uint8Array | null = null;

          if (item?.b64_json) {
            bytes = base64ToBytes(item.b64_json);
          } else if (item?.url) {
            const download = await fetch(item.url);
            if (download.ok) bytes = new Uint8Array(await download.arrayBuffer());
            else console.error("XOVA generated image download failed", download.status);
          }

          if (!bytes?.length) {
            console.error("XOVA image gateway returned no image data");
            return Response.json({ error: "err.imageFailed" }, { status: 502 });
          }

          const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
          const path =
            user.id + "/" + crypto.randomUUID() + (isJpeg ? ".jpg" : ".png");
          const { error: uploadError } = await supabaseAdmin.storage
            .from("xova-images")
            .upload(path, bytes, {
              contentType: isJpeg ? "image/jpeg" : "image/png",
              upsert: false,
            });

          if (uploadError) {
            console.error("XOVA image upload failed", uploadError.message);
            return Response.json({ error: "err.imageStorage" }, { status: 502 });
          }

          const { data: signed, error: signError } = await supabaseAdmin.storage
            .from("xova-images")
            .createSignedUrl(path, SIGNED_URL_TTL);

          if (signError || !signed?.signedUrl) {
            console.error("XOVA image URL signing failed", signError?.message);
            return Response.json({ error: "err.imageStorage" }, { status: 502 });
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
            console.error("XOVA image record insert failed", insertError.message);
            return Response.json({ error: "err.imageStorage" }, { status: 502 });
          }

          return Response.json({
            image: signed.signedUrl,
            id: row.id,
            createdAt: row.created_at,
            aspect,
            quality,
          });
        } catch (error) {
          console.error("XOVA image route failed", error);
          return Response.json({ error: "err.imageFailed" }, { status: 502 });
        }
      },
    },
  },
});

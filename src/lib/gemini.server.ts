import { createGoogleGenerativeAI } from "@ai-sdk/google";

/** Google AI Studio (free tier), native API so Google Search grounding is available. */
export function createGeminiProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}

/** Pinned, currently supported Gemini model (handles text + images). */
export const GEMINI_MODEL = "gemini-3.8-flash";

/**
 * Free-tier daily quotas are per model. When the primary model's quota is
 * exhausted, fall through these in order so the chat keeps answering.
 */
export const GEMINI_FALLBACK_MODELS = ["gemini-3.7-flash", "gemini-3.1-flash-lite"];

import { createGoogleGenerativeAI } from "@ai-sdk/google";

/** Google AI Studio (free tier), native API so Google Search grounding is available. */
export function createGeminiProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}

/** Pinned, currently supported Gemini model (handles text + images). */
export const GEMINI_MODEL = "gemini-3.8-flash";

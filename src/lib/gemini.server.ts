import { createGoogleGenerativeAI } from "@ai-sdk/google";

/** Google AI Studio, native API so Google Search grounding metadata is available. */
export function createGeminiProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}

/** Direct Gemini chat model; Google Search grounding is enabled in the chat route. */
export const GEMINI_MODEL = "gemini-3.5-flash-lite";

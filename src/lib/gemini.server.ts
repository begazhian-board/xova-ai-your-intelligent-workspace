import { createGoogleGenerativeAI } from "@ai-sdk/google";

/** Google AI Studio (free tier), native API so Google Search grounding is available. */
export function createGeminiProvider(apiKey: string) {
  return createGoogleGenerativeAI({ apiKey });
}

/** Direct Gemini chat model; Google Search grounding is enabled in the chat route. */
export const GEMINI_MODEL = "gemini-2.5-flash";

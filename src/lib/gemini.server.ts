import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Google AI Studio (free tier) via its OpenAI-compatible endpoint. Used first when GEMINI_API_KEY is set. */
export function createGeminiProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey,
  });
}

/** Gemini Flash handles both text and images. */
export function geminiModel(): string {
  return "gemini-flash-latest";
}

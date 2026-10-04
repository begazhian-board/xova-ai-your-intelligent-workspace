import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/** Groq (free tier) — OpenAI-compatible. Used first when GROQ_API_KEY is set. */
export function createGroqProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    apiKey,
  });
}

export function groqModel(hasImage: boolean): string {
  return hasImage ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile";
}

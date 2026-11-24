export interface AIProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  endpoint: string;
}

export function getAIProviderConfig(purpose: "chat" | "coder" = "chat"): AIProviderConfig | null {
  const apiKey = process.env["AI_API_KEY"] ?? process.env["OPENAI_API_KEY"];
  const baseUrl = (process.env["AI_API_BASE_URL"] ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const model =
    (purpose === "coder" ? process.env["AI_CODER_MODEL"] : undefined) ??
    process.env["AI_MODEL"];

  if (!apiKey?.trim() || !model?.trim()) return null;

  try {
    const parsed = new URL(baseUrl);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) return null;
  } catch {
    return null;
  }

  return {
    apiKey: apiKey.trim(),
    baseUrl,
    model: model.trim(),
    endpoint: baseUrl + "/chat/completions",
  };
}

export function aiProviderErrorCode(status?: number, details = "") {
  if (status === 401 || status === 403) return "err.aiConfig";
  if (status === 402 || /insufficient[_ ](quota|credits)|payment required/i.test(details)) {
    return "err.aiCredits";
  }
  if (status === 404) return "err.aiModel";
  if (status === 400) return "err.aiRequest";
  if (status === 429) return "err.rate";
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return "err.aiBusy";
  }
  return "err.unavailable";
}

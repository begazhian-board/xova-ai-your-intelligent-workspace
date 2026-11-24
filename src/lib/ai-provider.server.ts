export interface AIProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  endpoint: string;
}

const DEFAULT_CLOUDFLARE_MODEL = "@cf/qwen/qwen3.8-27b";

export function getAIProviderConfig(purpose: "chat" | "coder" = "chat"): AIProviderConfig | null {
  const explicitApiKey =
    process.env["AI_API_KEY"] || process.env["OPENAI_API_KEY"];
  const cloudflareAccountId = process.env["CLOUDFLARE_ACCOUNT_ID"]?.trim();
  const cloudflareApiToken = process.env["CLOUDFLARE_API_TOKEN"]?.trim();
  const hasCloudflareCredentials = Boolean(cloudflareAccountId && cloudflareApiToken);

  const useCloudflareByDefault = !explicitApiKey && hasCloudflareCredentials;
  const apiKey = explicitApiKey || (useCloudflareByDefault ? cloudflareApiToken : undefined);
  const cloudflareBaseUrl = hasCloudflareCredentials
    ? "https://api.cloudflare.com/client/v4/accounts/" +
      encodeURIComponent(cloudflareAccountId!) +
      "/ai/v1"
    : undefined;
  const baseUrl = (
    process.env["AI_API_BASE_URL"] ??
    (useCloudflareByDefault ? cloudflareBaseUrl : "https://api.openai.com/v1")
  )?.replace(/\/+$/, "");
  const defaultModel = useCloudflareByDefault ? DEFAULT_CLOUDFLARE_MODEL : undefined;
  const model =
    (purpose === "coder" ? process.env["AI_CODER_MODEL"] : undefined) ??
    process.env["AI_MODEL"] ??
    defaultModel;

  if (!apiKey?.trim() || !baseUrl || !model?.trim()) return null;

  try {
    const parsed = new URL(baseUrl);
    const localHttp =
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname);
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
  if (
    status === 402 ||
    /insufficient[_ ](quota|credits)|payment required/i.test(details)
  ) {
    return "err.aiCredits";
  }
  if (status === 404 || status === 410) return "err.aiModel";
  if (status === 400) return "err.aiRequest";
  if (status === 429) return "err.rate";
  if ([500, 502, 503, 504].includes(status ?? 0)) return "err.aiBusy";
  return "err.unavailable";
}

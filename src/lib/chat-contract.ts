import type { ModeId } from "@/lib/xova";

export type ChatProviderKind = "gemini" | "gateway";

export function chatProviderErrorCode(provider: ChatProviderKind, status?: number) {
  if (status === 429) return "err.rate";
  if (provider === "gateway" && status === 402) return "err.gatewayCredits";
  if (provider === "gateway" && status === 401) return "err.gatewayConfig";
  if (provider === "gateway" && status === 403) return "err.gatewayBlocked";
  if (status && status >= 500) return "err.unavailable";
  return "err.unavailable";
}

export function shouldTryChatFallback(hasVisibleText: boolean) {
  return !hasVisibleText;
}

export function shouldUseGatewayFallback(status?: number) {
  return status === undefined || status === 401 || status === 429 || (status >= 500 && status <= 599);
}

export function searchNoticeCode(mode: ModeId, sourceCount: number, searchUnavailable: boolean) {
  if (mode !== "reasoning" && mode !== "research") return null;
  if (searchUnavailable) return "err.searchFallbackUnavailable";
  if (sourceCount === 0) return "err.searchNoSources";
  return null;
}
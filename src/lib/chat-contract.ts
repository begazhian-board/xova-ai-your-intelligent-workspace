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

export function shouldShowSearchUnavailableNotice(mode: ModeId, sourceCount: number) {
  return (mode === "reasoning" || mode === "research") && sourceCount === 0;
}
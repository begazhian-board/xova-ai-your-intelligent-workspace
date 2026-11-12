import type { ModeId } from "@/lib/xova";

export function chatProviderErrorCode(_provider: "gemini", status?: number) {
  if (status === 429) return "err.rate";
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return "err.geminiConfig";
  }
  if (status && status >= 500) return "err.unavailable";
  return "err.unavailable";
}

export function searchNoticeCode(mode: ModeId, sourceCount: number, searchUnavailable: boolean) {
  if (mode !== "research") return null;
  if (searchUnavailable) return "err.searchFallbackUnavailable";
  if (sourceCount === 0) return "err.searchNoSources";
  return null;
}

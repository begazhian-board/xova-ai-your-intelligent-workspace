import type { ModeId } from "@/lib/xova";

const SEARCH_INTENT =
  /\b(search|look\s*up|find online|on the web|web search|latest|current|today|right now|recent|news|sources?|price|weather|exchange rate|release|version)\b|ابحث|بحث|دور|على الانترنت|عبر الانترنت|الإنترنت|الانترنت|اخر|آخر|اليوم|دلوقتي|حالي|حديث|مؤخر|أخبار|اخبار|مصادر|روابط|سعر|اسعار|أسعار|تحديث/i;

export function shouldSearchWeb(mode: ModeId, text: string) {
  return mode === "research" || mode === "reasoning" || SEARCH_INTENT.test(text);
}
export function chatProviderErrorCode(status?: number, details = "") {
  if (status === 429) return "err.rate";
  if (status === 401 || status === 403 || /API_KEY_INVALID|API key not valid|invalid API key/i.test(details)) {
    return "err.geminiConfig";
  }
  if (status === 404) return "err.geminiModel";
  if (status === 400) return "err.geminiRequest";
  if (status === 500 || status === 503 || /UNAVAILABLE|high demand|no capacity/i.test(details)) {
    return "err.geminiBusy";
  }
  if (status === 502 || status === 504) return "err.geminiNetwork";
  return "err.unavailable";
}
export function searchNoticeCode(requested: boolean, count: number, failed: boolean) {
  if (!requested) return null;
  if (failed) return "err.searchOffline";
  if (!count) return "err.searchNoSources";
  return null;
}

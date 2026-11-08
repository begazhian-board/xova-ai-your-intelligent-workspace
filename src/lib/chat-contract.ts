import type { ModeId } from "@/lib/xova";

const SEARCH_INTENT =
  /\b(search|look\s*up|find online|on the web|web search|latest|current|today|right now|recent|news|sources?|price|weather|exchange rate|release|version)\b|ابحث|بحث|دور|على الانترنت|عبر الانترنت|الإنترنت|الانترنت|اخر|آخر|اليوم|دلوقتي|حالي|حديث|مؤخر|أخبار|اخبار|مصادر|روابط|سعر|اسعار|أسعار|تحديث/i;

export function shouldSearchWeb(mode: ModeId, text: string) {
  return mode === "research" || SEARCH_INTENT.test(text);
}
export function chatProviderErrorCode(status?: number) {
  return status === 429 ? "err.rate" : "err.unavailable";
}
export function searchNoticeCode(requested: boolean, count: number, failed: boolean) {
  if (!requested) return null;
  if (failed) return "err.searchOffline";
  if (!count) return "err.searchNoSources";
  return null;
}

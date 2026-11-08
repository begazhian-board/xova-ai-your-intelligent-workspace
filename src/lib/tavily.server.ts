export interface TavilySearchResult { title: string; url: string; content: string; }
interface TavilyResponse { results?: Array<{ title?: string; url?: string; content?: string }>; }

/** Server-only Tavily search. The API key is never sent to the browser. */
export async function searchTavily(query: string, apiKey: string): Promise<TavilySearchResult[]> {
  const cleanQuery = query.trim().slice(0, 500);
  if (!cleanQuery) return [];
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, query: cleanQuery, topic: "general", search_depth: "basic", max_results: 5, include_answer: false, include_raw_content: false }),
  });
  if (!response.ok) throw new Error(`Tavily search failed with status ${response.status}`);
  const payload = (await response.json()) as TavilyResponse;
  const seen = new Set<string>();
  return (payload.results ?? []).flatMap((result) => {
    if (typeof result.url !== "string" || typeof result.content !== "string") return [];
    try {
      const parsed = new URL(result.url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
      const url = parsed.toString();
      if (seen.has(url)) return [];
      seen.add(url);
      return [{ title: result.title?.trim() || parsed.hostname, url, content: result.content.trim().slice(0, 1800) }];
    } catch { return []; }
  });
}

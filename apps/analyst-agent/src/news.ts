import { XMLParser } from "fast-xml-parser";

export interface Headline {
  title: string;
  url: string;
  publishedAt: string; // ISO
  summary: string;
  source: string; // publisher when the feed names one
  feed: string;
}

interface Feed {
  name: string;
  url: (ticker: string) => string;
}

// Google News needs a search phrase; company names beat bare tickers for recall.
const SEARCH_TERMS: Record<string, string> = { NVDA: "NVIDIA stock", TSLA: "Tesla stock" };
// Yahoo's per-ticker feed also carries general market pieces; keep only items that mention the company.
const KEYWORDS: Record<string, string[]> = { NVDA: ["nvidia", "nvda", "jensen huang"], TSLA: ["tesla", "tsla", "elon musk"] };
const UA = "Mozilla/5.0 (compatible; ElitrAnalyst/0.1)";

export const NEWS_FEEDS: Feed[] = [
  {
    name: "yahoo-finance",
    url: (t) => `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(t)}&region=US&lang=en-US`,
  },
  {
    name: "google-news",
    url: (t) =>
      `https://news.google.com/rss/search?q=${encodeURIComponent(SEARCH_TERMS[t] ?? `${t} stock`)}&hl=en-US&gl=US&ceid=US:en`,
  },
];

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, htmlEntities: true });

const text = (v: unknown): string =>
  (typeof v === "object" && v !== null ? String((v as any)["#text"] ?? "") : String(v ?? "")).trim();

export function parseRss(xml: string, feed: string): Headline[] {
  const doc = parser.parse(xml);
  const raw = doc?.rss?.channel?.item;
  const items: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Headline[] = [];
  for (const it of items) {
    let title = text(it.title);
    const url = text(it.link);
    const ts = Date.parse(text(it.pubDate));
    if (!title || !/^https?:\/\//.test(url) || Number.isNaN(ts)) continue;
    const source = text(it.source);
    // Google News appends " - Publisher" to every title
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();
    out.push({ title, url, publishedAt: new Date(ts).toISOString(), summary: text(it.description), source, feed });
  }
  return out;
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Recent headlines from every working feed: deduped by title, newest first. Throws if no feed works. */
export async function fetchHeadlines(
  ticker: string,
  opts: { maxAgeHours?: number; cap?: number } = {},
): Promise<{ headlines: Headline[]; errors: string[] }> {
  const { maxAgeHours = 48, cap = 25 } = opts;
  const errors: string[] = [];
  const results = await Promise.all(
    NEWS_FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url(ticker), { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseRss(await res.text(), f.name);
      } catch (e) {
        errors.push(`${f.name}: ${(e as Error).message}`);
        return [];
      }
    }),
  );
  if (errors.length === NEWS_FEEDS.length) throw new Error(`all news feeds failed (${errors.join("; ")})`);

  const cutoff = Date.now() - maxAgeHours * 3600_000;
  const keys = KEYWORDS[ticker] ?? [ticker.toLowerCase()];
  const relevant = (h: Headline) => keys.some((k) => `${h.title} ${h.summary}`.toLowerCase().includes(k));
  const seen = new Set<string>();
  const headlines = results
    .flat()
    .filter((h) => Date.parse(h.publishedAt) >= cutoff && relevant(h))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .filter((h) => {
      const k = norm(h.title);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, cap);
  return { headlines, errors };
}

// lib/mlbRumors.ts

export type RumorItem = {
  id: string;
  title: string;
  link: string;
  pubDate: string; // raw
  ymd: string; // YYYY-MM-DD
  source: string;
};

function decodeEntities(s: string) {
  return String(s ?? "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function pickTag(block: string, tag: string) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : "";
}

function pickAttr(block: string, tag: string, attr: string) {
  const re = new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"[^>]*>`, "i");
  const m = block.match(re);
  return m ? decodeEntities(m[1]) : "";
}

function toYmd(s: string) {
  const raw = String(s ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function parseRss(xml: string, source: string): RumorItem[] {
  const items = xml.split(/<item>/i).slice(1).map((s) => s.split(/<\/item>/i)[0]);
  const out: RumorItem[] = [];

  for (const raw of items) {
    const title = pickTag(raw, "title");
    let link = pickTag(raw, "link");
    const pubDate =
      pickTag(raw, "pubDate") ||
      pickTag(raw, "dc:date") ||
      pickTag(raw, "published") ||
      pickTag(raw, "updated");

    // Some RSS feeds put a URL in <guid> or in <link href="...">
    if (!link) link = pickTag(raw, "guid");
    if (!link) link = pickAttr(raw, "link", "href");

    if (!title || !link) continue;

    const ymd = toYmd(pubDate);
    out.push({
      id: `${source}|${title}|${link}`,
      title,
      link,
      pubDate,
      ymd,
      source,
    });
  }

  return out;
}

function parseAtom(xml: string, source: string): RumorItem[] {
  const entries = xml.split(/<entry>/i).slice(1).map((s) => s.split(/<\/entry>/i)[0]);
  const out: RumorItem[] = [];

  for (const raw of entries) {
    const title = pickTag(raw, "title");
    const link = pickAttr(raw, "link", "href") || pickTag(raw, "link");
    const pubDate = pickTag(raw, "updated") || pickTag(raw, "published");

    if (!title || !link) continue;

    const ymd = toYmd(pubDate);
    out.push({
      id: `${source}|${title}|${link}`,
      title,
      link,
      pubDate,
      ymd,
      source,
    });
  }

  return out;
}

async function fetchFeed(feedUrl: string): Promise<string | null> {
  try {
    const res = await fetch(feedUrl, {
      cache: "no-store",
      headers: {
        // Feeds sometimes block generic fetches; these headers help.
        "User-Agent": "Mozilla/5.0 (compatible; mlb-valuations/1.0)",
        Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function sortNewest(items: RumorItem[]) {
  items.sort((a, b) => {
    const ay = a.ymd || "";
    const by = b.ymd || "";
    if (ay && by) return ay < by ? 1 : ay > by ? -1 : 0;
    const ap = a.pubDate || "";
    const bp = b.pubDate || "";
    return ap < bp ? 1 : ap > bp ? -1 : 0;
  });
}

/**
 * Round-robin mixer:
 * - ensures we don't show 5 from the same source if multiple feeds succeed
 */
function roundRobinMix(perSource: Array<{ source: string; items: RumorItem[] }>, limit: number) {
  // Deduplicate by link across all sources
  const seen = new Set<string>();

  // Ensure each list is newest-first
  for (const s of perSource) sortNewest(s.items);

  const out: RumorItem[] = [];
  let progressed = true;

  while (out.length < limit && progressed) {
    progressed = false;
    for (const bucket of perSource) {
      while (bucket.items.length) {
        const it = bucket.items.shift()!;
        if (seen.has(it.link)) continue;
        seen.add(it.link);
        out.push(it);
        progressed = true;
        break;
      }
      if (out.length >= limit) break;
    }
  }

  return out;
}

export async function getLatestRumors(limit = 5): Promise<RumorItem[]> {
  const feeds: Array<{ source: string; url: string }> = [
    { source: "MLB Trade Rumors", url: "https://feeds.feedburner.com/MlbTradeRumors" },
    { source: "ESPN", url: "https://www.espn.com/espn/rss/mlb/news" },
    { source: "CBS Sports", url: "https://www.cbssports.com/rss/headlines/mlb/" },
  ];

  const texts = await Promise.all(feeds.map((f) => fetchFeed(f.url)));

  const perSource: Array<{ source: string; items: RumorItem[] }> = [];

  for (let i = 0; i < feeds.length; i++) {
    const source = feeds[i].source;
    const xml = texts[i];
    if (!xml) continue;

    const isAtom = /<feed\b/i.test(xml) && /<entry>/i.test(xml);
    const items = isAtom ? parseAtom(xml, source) : parseRss(xml, source);

    // Keep only items with a usable date, otherwise ymd might be blank → show "—"
    // We'll still allow blank ymd (some feeds omit), but it will display "—"
    perSource.push({ source, items });
  }

  if (perSource.length === 0) return [];

  // If only one feed succeeds, you'll see one source (nothing else to mix).
  if (perSource.length === 1) {
    const only = perSource[0].items;
    sortNewest(only);
    return only.slice(0, limit);
  }

  return roundRobinMix(perSource, limit);
}

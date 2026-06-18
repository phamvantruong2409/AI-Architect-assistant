const RSS_URL = "https://www.tapchikientruc.com.vn/feed";

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return "";
  const val = match[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1].trim() : val;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diffDays === 0) return "Hôm nay";
    if (diffDays === 1) return "Hôm qua";
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = itemRegex.exec(xml)) !== null && i < 4) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link") || block.match(/<link\s*\/?>(.*?)<\/link>|<link>(.*?)<\/link>/)?.[1] || "";
    const pubDate = extractTag(block, "pubDate");

    if (title) {
      items.push({ id: String(i + 1), title, link, pubDate: formatDate(pubDate) });
      i++;
    }
  }

  return items;
}

export async function fetchNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(RSS_URL, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml);
  } catch {
    return [];
  }
}

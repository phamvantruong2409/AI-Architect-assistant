const RSS_URL = "https://feeds.feedburner.com/Archdaily";

export interface InspirationItem {
  id: string;
  title: string;
  link: string;
  image: string;
  tag: string;
}

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return "";
  const val = match[1].trim();
  const cdata = val.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1].trim() : val;
}

function extractEnclosureUrl(xml: string): string {
  const match = xml.match(/<enclosure url="([^"]+)"/);
  return match ? match[1] : "";
}

function extractFirstCategory(xml: string): string {
  const match = xml.match(/<category><!\[CDATA\[(.*?)\]\]><\/category>/);
  return match ? match[1].trim() : "";
}

function parseRss(xml: string): InspirationItem[] {
  const items: InspirationItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = itemRegex.exec(xml)) !== null && i < 3) {
    const block = match[1];
    const title = extractTag(block, "title");
    const link = extractTag(block, "link") || block.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const image = extractEnclosureUrl(block);
    const tag = extractFirstCategory(block);

    if (title && image) {
      items.push({ id: String(i + 1), title, link, image, tag });
      i++;
    }
  }

  return items;
}

export async function fetchInspiration(): Promise<InspirationItem[]> {
  try {
    const res = await fetch(RSS_URL, { next: { revalidate: 86400 } });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRss(xml);
  } catch {
    return [];
  }
}

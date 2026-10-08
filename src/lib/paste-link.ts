// Pasting a store link into "Add a gift" fills in the gift for you: the link is saved, the store
// is named from the web address, and the title comes from the readable words in it. Nothing is
// fetched from the store's website (no scraping); the person adds the price themselves.

const STORES: Record<string, string> = {
  amazon: "Amazon",
  target: "Target",
  walmart: "Walmart",
  etsy: "Etsy",
  bestbuy: "Best Buy",
  costco: "Costco",
  kohls: "Kohl's",
  macys: "Macy's",
  lego: "LEGO",
  apple: "Apple",
  nordstrom: "Nordstrom",
  ebay: "eBay",
  homedepot: "Home Depot",
  lowes: "Lowe's",
  sephora: "Sephora",
  ulta: "Ulta",
  oldnavy: "Old Navy",
  gap: "Gap",
  nike: "Nike",
  barnesandnoble: "Barnes & Noble",
  wayfair: "Wayfair",
  rei: "REI",
  dickssportinggoods: "Dick's Sporting Goods",
  kroger: "Kroger",
  samsclub: "Sam's Club",
  michaels: "Michaels",
  jcpenney: "JCPenney",
  ikea: "IKEA",
  uncommongoods: "Uncommon Goods",
  crateandbarrel: "Crate & Barrel",
  potterybarn: "Pottery Barn",
  potterybarnkids: "Pottery Barn Kids",
  gamestop: "GameStop",
  disney: "Disney",
  shopdisney: "Disney Store",
};

// Short codes some stores use for share links.
const SHORT_HOSTS: Record<string, string> = {
  "a.co": "Amazon",
  "amzn.to": "Amazon",
  "amzn.com": "Amazon",
  "tgt.biz": "Target",
};

export type PastedGift = { title: string; link: string; store: string };

function storeName(hostname: string): string {
  const host = hostname.toLowerCase().replace(/^(www|m|smile|shop|store)\./, "");
  if (SHORT_HOSTS[host]) return SHORT_HOSTS[host];
  const parts = host.split(".");
  const name = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2] ?? host;
  if (STORES[name]) return STORES[name];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function titleFromPath(url: URL): string | null {
  let best: string | null = null;
  for (const raw of url.pathname.split("/")) {
    let segment: string;
    try {
      segment = decodeURIComponent(raw);
    } catch {
      segment = raw;
    }
    segment = segment.replace(/\.(html?|aspx?|php)$/i, "");
    if (!/[-_+ ]/.test(segment)) continue;
    // Drop product codes: long numbers, and long mixes of letters and digits like "B00NHQFA1I".
    const words = segment
      .split(/[-_+ ]+/)
      .filter((w) => w && !/^\d{6,}$/.test(w) && !(w.length >= 8 && /\d/.test(w) && /[a-z]/i.test(w)));
    const letterWords = words.filter((w) => /[a-z]/i.test(w));
    if (letterWords.length < 2) continue;
    const text = words.join(" ");
    if (!best || text.length > best.length) best = text;
  }
  if (!best) return null;
  const clean = best.replace(/\s+/g, " ").trim().slice(0, 120).trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

/** If the text is a store link, the gift it describes; otherwise null. */
export function giftFromPastedLink(text: string): PastedGift | null {
  const value = text.trim();
  if (!/^https?:\/\//i.test(value) || /\s/.test(value) || value.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!url.hostname.includes(".")) return null;
  const store = storeName(url.hostname).slice(0, 80);
  return { title: titleFromPath(url) ?? `Gift from ${store}`, link: url.toString(), store };
}

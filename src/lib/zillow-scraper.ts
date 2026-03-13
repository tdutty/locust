interface ZillowResult {
  scraped: boolean;
  photos: string[];
  zillowUrl: string | null;
}

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildSearchSlug(address: string, city: string, state: string, zip: string): string {
  // "123 Main St, Houston, TX 77001" → "123-Main-St-Houston-TX-77001"
  const parts = [address, city, state, zip].filter(Boolean).join(' ');
  return parts.replace(/[,.\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function fetchWithProxy(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<Response> {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (apiKey) {
    const proxyUrl = `https://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}&render=false`;
    return fetch(proxyUrl, { signal, redirect: 'follow' });
  }
  return fetch(url, { headers, signal, redirect: 'follow' });
}

/**
 * Scrape Zillow for listing photos and URL by address.
 * Gracefully returns empty results if blocked or not found.
 */
export async function scrapeZillowListing(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<ZillowResult> {
  const slug = buildSearchSlug(address, city, state, zip);
  const searchUrl = `https://www.zillow.com/homes/${slug}_rb/`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        // Exponential backoff: 2s, 4s
        await randomDelay(2000 * attempt, 2000 * attempt + 1000);
      }

      const useProxy = !!process.env.SCRAPER_API_KEY;
      if (attempt === 0) {
        console.log(`[zillow] Scraping ${address} via ${useProxy ? 'ScraperAPI proxy' : 'direct fetch'}`);
      }

      const controller = new AbortController();
      const timeoutMs = useProxy ? 30000 : 10000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const headers: Record<string, string> = {
        'User-Agent': randomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      };

      const res = await fetchWithProxy(searchUrl, headers, controller.signal);

      clearTimeout(timeout);

      if (!res.ok) {
        console.warn(`Zillow returned ${res.status} for ${address} (attempt ${attempt + 1})`);
        continue;
      }

      const html = await res.text();

      // Strategy 1: Extract from __NEXT_DATA__ JSON
      const nextDataResult = extractFromNextData(html);
      if (nextDataResult.photos.length > 0) {
        return { scraped: true, ...nextDataResult };
      }

      // Strategy 2: Regex for zillowstatic.com image URLs + cheerio HTML parsing
      const fallbackResult = await extractWithCheerio(html, searchUrl);
      if (fallbackResult.photos.length > 0) {
        return { scraped: true, ...fallbackResult };
      }

      // No photos found but page loaded — don't retry
      return { scraped: true, photos: [], zillowUrl: fallbackResult.zillowUrl || searchUrl };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.warn(`Zillow timeout for ${address} (attempt ${attempt + 1})`);
      } else {
        console.warn(`Zillow scrape error for ${address} (attempt ${attempt + 1}):`, err.message);
      }
    }
  }

  // All retries exhausted
  return { scraped: false, photos: [], zillowUrl: null };
}

function extractFromNextData(html: string): { photos: string[]; zillowUrl: string | null } {
  const photos: string[] = [];
  let zillowUrl: string | null = null;

  try {
    const nextDataMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (!nextDataMatch) return { photos, zillowUrl };

    const json = JSON.parse(nextDataMatch[1]);
    const searchStr = JSON.stringify(json);

    // Extract detail URL
    const detailUrlMatch = searchStr.match(/"detailUrl":"(\/homedetails\/[^"]+)"/);
    if (detailUrlMatch) {
      zillowUrl = `https://www.zillow.com${detailUrlMatch[1]}`;
    }

    // Extract photo URLs from responsivePhotos or other nested structures
    const photoMatches = searchStr.matchAll(/"url":"(https:\/\/photos\.zillowstatic\.com\/[^"]+)"/g);
    const seen = new Set<string>();
    for (const match of photoMatches) {
      const url = match[1];
      // Prefer larger images — skip tiny thumbnails
      if (!seen.has(url) && !url.includes('_c.jpg') && !url.includes('_e.jpg')) {
        seen.add(url);
        photos.push(url);
      }
      if (photos.length >= 10) break;
    }
  } catch {
    // JSON parse failed, fall through
  }

  return { photos, zillowUrl };
}

async function extractWithCheerio(html: string, fallbackUrl: string): Promise<{ photos: string[]; zillowUrl: string | null }> {
  const photos: string[] = [];
  let zillowUrl: string | null = null;

  try {
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    // Try to find the canonical/detail link
    const canonicalLink = $('link[rel="canonical"]').attr('href');
    if (canonicalLink && canonicalLink.includes('/homedetails/')) {
      zillowUrl = canonicalLink;
    }

    // Extract image URLs from img tags
    $('img[src*="zillowstatic.com"]').each((_, el) => {
      const src = $(el).attr('src');
      if (src && !src.includes('_c.jpg') && !src.includes('_e.jpg') && photos.length < 10) {
        photos.push(src);
      }
    });

    // Also check srcset and data-src
    $('[data-src*="zillowstatic.com"]').each((_, el) => {
      const src = $(el).attr('data-src');
      if (src && photos.length < 10) {
        photos.push(src);
      }
    });
  } catch {
    // Cheerio parse failed
  }

  // Regex fallback for any remaining zillowstatic URLs
  if (photos.length === 0) {
    const regex = /https:\/\/photos\.zillowstatic\.com\/[^\s"'<>]+\.(?:jpg|jpeg|webp|png)/gi;
    const matches = html.match(regex) || [];
    const seen = new Set<string>();
    for (const url of matches) {
      if (!seen.has(url) && !url.includes('_c.jpg') && !url.includes('_e.jpg')) {
        seen.add(url);
        photos.push(url);
      }
      if (photos.length >= 10) break;
    }
  }

  return { photos, zillowUrl: zillowUrl || fallbackUrl };
}

/**
 * Scrape Zillow for a batch of listings, with rate limiting.
 * Sequential with 1-3s random delays between requests.
 */
export async function scrapeZillowBatch(
  listings: Array<{ address: string; city: string; state: string; zip: string }>
): Promise<ZillowResult[]> {
  const results: ZillowResult[] = [];

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const result = await scrapeZillowListing(listing.address, listing.city, listing.state, listing.zip);
    results.push(result);

    // Rate limit: random 1-3s delay between requests
    if (i < listings.length - 1) {
      await randomDelay(1000, 3000);
    }
  }

  return results;
}

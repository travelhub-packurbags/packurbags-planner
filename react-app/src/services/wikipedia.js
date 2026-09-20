/**
 * Image fetcher using Wikimedia sources.
 *
 * Two strategies:
 *  - fetchRestaurantImage()  → Wikimedia Commons file search → filtered for actual restaurant photos
 *  - fetchWikipediaImage()   → Wikipedia pageimages → good for monuments / tourist attractions
 *
 * Both are completely free, no API key required, no rate limits.
 */

const WIKI_API    = 'https://en.wikipedia.org/w/api.php';
const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

// MediaWiki policy requires a User-Agent header for non-browser/node clients
const defaultHeaders = typeof window === 'undefined' ? { 'User-Agent': 'PackUrBagTravel/1.0 (info@packurbag.com)' } : undefined;

// ─── Image quality filters ────────────────────────────────────────────────────


// Filename substrings that indicate the image is NOT a place/food photo
const BAD_FILENAME_TOKENS = [
  'logo', 'map', 'flag', 'seal', 'portrait', 'coat_of_arms', 'emblem',
  'badge', 'icon', 'symbol', 'sign', 'crest', 'stamp', 'sticker',
  'illustration', 'diagram', 'chart', 'graph',
];

/**
 * Returns true if the image should be skipped (logo, portrait, map, etc.)
 * @param {string} filename - e.g. "Indian_Coffee_House_Kolkata.jpg"
 * @param {number} width
 * @param {number} height
 */
function isBadImage(filename, width, height) {
  const lower = filename.toLowerCase();
  if (BAD_FILENAME_TOKENS.some(t => lower.includes(t))) return true;
  // Portrait orientation → likely a person photo
  if (width && height && height > width * 1.4) return true;
  // Tiny thumbnail → skip
  if (width && width < 150) return true;
  return false;
}

// ─── Session-level cache (keyed by "type::name::city") ────────────────────────
const imageCache = new Map();

// ─── Wikimedia Commons file search ────────────────────────────────────────────

/**
 * Searches Wikimedia Commons (namespace 6 = File) for an image matching
 * the query. Filters out logos, portraits, maps, and tiny images.
 * Returns a thumbnail URL or null.
 */
async function searchCommons(query) {
  try {
    const searchParams = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srnamespace: '6',   // File namespace only — actual image files
      srlimit: '8',
      format: 'json',
      origin: '*',
    });

    const searchRes = await fetch(`${COMMONS_API}?${searchParams}`, { headers: defaultHeaders });
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const files = searchData.query?.search || [];
    if (!files.length) return null;

    // Try each result until we find a good photo
    for (const file of files) {
      const filename = file.title; // e.g. "File:Indian_Coffee_House_Kolkata.jpg"
      const shortname = filename.replace('File:', '');

      // Quick filename filter before fetching metadata
      if (BAD_FILENAME_TOKENS.some(t => shortname.toLowerCase().includes(t))) continue;

      // Fetch image dimensions + thumbnail URL
      const infoParams = new URLSearchParams({
        action: 'query',
        titles: filename,
        prop: 'imageinfo',
        iiprop: 'url|dimensions',
        iiurlwidth: '600',
        format: 'json',
        origin: '*',
      });

      const infoRes = await fetch(`${COMMONS_API}?${infoParams}`, { headers: defaultHeaders });
      if (!infoRes.ok) continue;

      const infoData = await infoRes.json();
      const page = Object.values(infoData.query?.pages || {})[0];
      const info = page?.imageinfo?.[0];
      if (!info) continue;

      const { thumburl, url, width, height } = info;
      if (isBadImage(shortname, width, height)) continue;

      return thumburl || url; // thumburl is the resized version (600px wide)
    }
  } catch (err) {
    console.warn(`[Commons] Search failed for "${query}":`, err.message);
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch an image for a RESTAURANT.
 * Tries increasingly broad Wikimedia Commons queries, falls back to Wikipedia pageimages.
 */
export async function fetchRestaurantImage(restaurantName, cityName = '') {
  const cacheKey = `rest::${restaurantName}::${cityName}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  // Try Commons with progressively broader queries
  const queries = [
    cityName ? `${restaurantName} restaurant ${cityName}` : `${restaurantName} restaurant`,
    `${restaurantName} ${cityName}`.trim(),
    restaurantName,
  ];

  for (const q of queries) {
    const img = await searchCommons(q);
    if (img) {
      imageCache.set(cacheKey, img);
      return img;
    }
  }

  // Last resort: Wikipedia pageimages (less accurate for restaurants but better than nothing)
  const wikiImg = await _fetchWikiPageimage(restaurantName, cityName);
  imageCache.set(cacheKey, wikiImg);
  return wikiImg;
}

/**
 * Fetch an image for a TOURIST PLACE / landmark.
 * Wikipedia pageimages works very well for monuments, parks, and historic sites.
 */
export async function fetchWikipediaImage(placeName, cityName = '') {
  const cacheKey = `place::${placeName}::${cityName}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  // Try Wikipedia pageimages first (usually accurate for tourist landmarks)
  const wikiImg = await _fetchWikiPageimage(placeName, cityName);
  if (wikiImg) {
    imageCache.set(cacheKey, wikiImg);
    return wikiImg;
  }

  // Fall back to Commons search for landmarks too
  const commonsImg = await searchCommons(
    cityName ? `${placeName} ${cityName}` : placeName
  );
  imageCache.set(cacheKey, commonsImg);
  return commonsImg;
}

/**
 * Internal: fetches Wikipedia pageimages thumbnail using both search generator and direct title lookup.
 */
async function _fetchWikiPageimage(name, city = '') {
  if (!name) return null;
  // Clean dots, ellipsis, and unnecessary parenthesis from spot names
  const cleanName = name.replace(/\.{2,}/g, '').replace(/\s*\([^)]*\)/g, '').trim();
  const queries = [
    cleanName,
    city ? `${cleanName} ${city}`.trim() : null,
  ].filter(Boolean);

  for (const query of queries) {
    try {
      // 1. Try search generator (finds article even with slight spelling/suffix differences)
      const searchParams = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: query,
        gsrlimit: '1',
        prop: 'pageimages',
        format: 'json',
        pithumbsize: '600',
        origin: '*',
        redirects: '1',
      });

      const searchRes = await fetch(`${WIKI_API}?${searchParams}`, { headers: defaultHeaders });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const pages = searchData.query?.pages;
        if (pages) {
          const page = Object.values(pages)[0];
          const src = page?.thumbnail?.source;
          if (src) {
            const filename = src.split('/').pop() || '';
            const { width, height } = page.thumbnail;
            if (!isBadImage(filename, width, height)) {
              return src;
            }
          }
        }
      }

      // 2. Direct title lookup fallback with automatic redirect resolution
      const directParams = new URLSearchParams({
        action: 'query',
        titles: query,
        prop: 'pageimages',
        format: 'json',
        pithumbsize: '600',
        origin: '*',
        redirects: '1',
      });

      const directRes = await fetch(`${WIKI_API}?${directParams}`, { headers: defaultHeaders });
      if (directRes.ok) {
        const directData = await directRes.json();
        const pages = directData.query?.pages;
        if (pages) {
          const page = Object.values(pages)[0];
          if (!('missing' in page) && page.thumbnail?.source) {
            const src = page.thumbnail.source;
            const filename = src.split('/').pop() || '';
            const { width, height } = page.thumbnail;
            if (!isBadImage(filename, width, height)) {
              return src;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`[Wikipedia] Error fetching image for "${query}":`, err.message);
    }
  }
  return null;
}


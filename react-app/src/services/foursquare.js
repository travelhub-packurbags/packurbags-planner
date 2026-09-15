// Google Places Photo fetcher using Places API (New)
// Used for JSON dataset tourist places and Overpass restaurants (no photo ref available).
// Google-sourced places from fetchGoogleAttractions already embed their image URL.
//
// Rate-limit strategy: callers process places SEQUENTIALLY with a 350ms delay between
// calls (see Step1Places.jsx / Step5Dining.jsx). This function also retries once on 429.

const PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY || '';
const PLACES_BASE = 'https://places.googleapis.com/v1';

// In-memory cache — same place is never fetched twice per session
const imageCache = new Map();

/** Wait helper */
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Fetches a Google Places photo URL for a named place.
 * Returns a URL string or null on failure.
 */
export async function fetchFoursquareImage(placeName, cityName) {
  if (!PLACES_KEY) {
    console.warn('[GooglePlacesPhoto] VITE_GOOGLE_PLACES_KEY is not set');
    return null;
  }

  const cacheKey = `${placeName}::${cityName}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  // Try once, retry after 1s on 429
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const searchRes = await fetch(`${PLACES_BASE}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': PLACES_KEY,
          'X-Goog-FieldMask': 'places.photos',
        },
        body: JSON.stringify({
          textQuery: `${placeName}, ${cityName}, India`,
          maxResultCount: 1,
        }),
      });

      if (searchRes.status === 429) {
        if (attempt === 0) {
          console.warn(`[GooglePlacesPhoto] Rate limited — retrying in 1.5s for "${placeName}"`);
          await wait(1500);
          continue; // retry
        }
        console.warn(`[GooglePlacesPhoto] Still rate limited after retry for "${placeName}"`);
        imageCache.set(cacheKey, null);
        return null;
      }

      if (!searchRes.ok) {
        console.warn(`[GooglePlacesPhoto] Search failed (${searchRes.status}) for "${placeName}, ${cityName}"`);
        imageCache.set(cacheKey, null);
        return null;
      }

      const data = await searchRes.json();
      const photoRef = data.places?.[0]?.photos?.[0]?.name;

      if (!photoRef) {
        console.info(`[GooglePlacesPhoto] No photo found for "${placeName}, ${cityName}"`);
        imageCache.set(cacheKey, null);
        return null;
      }

      // Photo media URL — works as <img> src (browser follows 302 redirect to CDN)
      const photoUrl = `${PLACES_BASE}/${photoRef}/media?maxHeightPx=500&key=${PLACES_KEY}`;
      console.info(`[GooglePlacesPhoto] ✓ "${placeName}"`);
      imageCache.set(cacheKey, photoUrl);
      return photoUrl;

    } catch (err) {
      console.warn(`[GooglePlacesPhoto] Error for "${placeName}":`, err.message);
      imageCache.set(cacheKey, null);
      return null;
    }
  }

  return null;
}

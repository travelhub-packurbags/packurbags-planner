// Google Places Photo fetcher — routes through backend proxy.
// No VITE_GOOGLE_PLACES_KEY exposed to the browser.
//
// Rate-limit strategy: callers process places SEQUENTIALLY with a 350ms delay
// between calls (see Step1Places.jsx / Step5Dining.jsx).

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

// In-memory cache — same place is never fetched twice per session
const imageCache = new Map();

/** Wait helper */
const wait = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Fetches a Google Places photo URL for a named place via backend proxy.
 * Returns a proxied URL string or null on failure.
 */
export async function fetchFoursquareImage(placeName, cityName) {
  const cacheKey = `${placeName}::${cityName}`;
  if (imageCache.has(cacheKey)) return imageCache.get(cacheKey);

  // Step 1: search for the place to get a photo reference
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Use the backend attractions endpoint to get photo refs
      const searchRes = await fetch(
        `${BACKEND_URL}/v1/planner/places/search?q=${encodeURIComponent(`${placeName}, ${cityName}, India`)}`
      );

      if (searchRes.status === 429) {
        if (attempt === 0) {
          console.warn(`[PlacesPhoto] Rate limited — retrying in 1.5s for "${placeName}"`);
          await wait(1500);
          continue;
        }
        imageCache.set(cacheKey, null);
        return null;
      }

      if (!searchRes.ok) {
        imageCache.set(cacheKey, null);
        return null;
      }

      const searchData = await searchRes.json();
      if (searchData.code === 'PLANNER_UNAVAILABLE') {
        imageCache.set(cacheKey, null);
        return null;
      }

      // Get first place suggestion, then fetch details with photos
      const firstSuggestion = searchData.suggestions?.[0]?.placePrediction;
      if (!firstSuggestion?.placeId) {
        imageCache.set(cacheKey, null);
        return null;
      }

      const detailRes = await fetch(
        `${BACKEND_URL}/v1/planner/places/${encodeURIComponent(firstSuggestion.placeId)}`
      );
      if (!detailRes.ok) { imageCache.set(cacheKey, null); return null; }

      const detailData = await detailRes.json();
      const photoRef = detailData.photos?.[0]?.name;

      if (!photoRef) {
        imageCache.set(cacheKey, null);
        return null;
      }

      // Proxy photo through backend — key never in browser URL
      const photoUrl = `${BACKEND_URL}/api/planner/places/photo?ref=${encodeURIComponent(photoRef)}&maxH=500`;
      console.info(`[PlacesPhoto] ✓ "${placeName}"`);
      imageCache.set(cacheKey, photoUrl);
      return photoUrl;

    } catch (err) {
      console.warn(`[PlacesPhoto] Error for "${placeName}":`, err.message);
      imageCache.set(cacheKey, null);
      return null;
    }
  }

  return null;
}

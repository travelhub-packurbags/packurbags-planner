/**
 * Serper image search — routes through backend proxy.
 * No VITE_SERPER_API_KEY in the browser bundle.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
const cache = new Map();

export async function fetchSerperImage(placeName, cityName = '') {
  const query = `${placeName} restaurant ${cityName}`.trim();
  if (cache.has(query)) return cache.get(query);

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/planner/serper/images?q=${encodeURIComponent(query)}`
    );

    if (!res.ok) {
      console.warn(`[Serper] HTTP error ${res.status}`);
      cache.set(query, null);
      return null;
    }

    const data = await res.json();
    if (data.code === 'PLANNER_UNAVAILABLE') {
      cache.set(query, null);
      return null;
    }

    if (data.images && data.images.length > 0) {
      const imgUrl = data.images[0].imageUrl;
      cache.set(query, imgUrl);
      return imgUrl;
    }
  } catch (err) {
    console.error('[Serper] Network/parsing error:', err);
  }

  cache.set(query, null);
  return null;
}

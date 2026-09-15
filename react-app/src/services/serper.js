/**
 * Serper API service for fetching highly accurate Google Images results.
 * This is used specifically for restaurants since Wikipedia and Commons
 * are notoriously inaccurate for private businesses.
 */

const cache = new Map();

export async function fetchSerperImage(placeName, cityName = '') {
  // Use env variable
  const SERPER_API_KEY = import.meta.env.VITE_SERPER_API_KEY;
  
  if (!SERPER_API_KEY) {
    console.warn("No Serper API key found.");
    return null;
  }

  const query = `${placeName} restaurant ${cityName}`.trim();
  if (cache.has(query)) return cache.get(query);

  try {
    const response = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        q: query,
        num: 5 // Fetch a few to find the best one
      })
    });

    if (!response.ok) {
      console.warn(`[Serper] HTTP error ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.images && data.images.length > 0) {
      // Find the first valid-looking image (e.g., skip weird domains if needed)
      // Usually, the first result from Google Images is highly accurate
      const imgUrl = data.images[0].imageUrl;
      cache.set(query, imgUrl);
      return imgUrl;
    }
  } catch (err) {
    console.error("[Serper] Network/parsing error:", err);
  }

  cache.set(query, null);
  return null;
}

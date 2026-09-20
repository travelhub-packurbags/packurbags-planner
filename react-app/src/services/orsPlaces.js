// ORS Places Service — fallback tourist place lookup for cities not in local dataset.
// Uses ORS Geocoding + POI endpoints. Max 2 places enforced at API level.
// No Google Places calls here — Google is already used upstream in Step1Places.

const ORS_KEY = import.meta.env.VITE_ORS_KEY || '';
const ORS_BASE = 'https://api.openrouteservice.org';

// Tourist-relevant ORS POI category IDs
// 160=Tourism, 162=Attraction, 150=Historic, 268=Historic/Fort, 267=Museum, 191=Museum, 344=Viewpoint, 380=Natural/Beach, 390=Leisure/Park, 530=Sport/Adventure, 550=Place of Worship
const TOURIST_CATEGORY_IDS = [160, 162, 150, 268, 267, 191, 344, 380, 390, 530, 550];

/**
 * Geocode a city name to {lat, lng} via ORS Geocoding API.
 * Scoped to India to avoid false matches. Returns null on failure.
 */
export async function geocodeCityORS(cityName) {
  if (!ORS_KEY || !cityName?.trim()) return null;
  try {
    const url = new URL(`${ORS_BASE}/geocode/search`);
    url.searchParams.set('api_key', ORS_KEY);
    url.searchParams.set('text', `${cityName.trim()}, India`);
    url.searchParams.set('size', '1');
    url.searchParams.set('layers', 'locality,region');
    url.searchParams.set('boundary.country', 'IND');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    const [lng, lat] = feature.geometry.coordinates;
    return { lat, lng, resolvedName: feature.properties?.name || cityName };
  } catch (err) {
    console.warn('[ORS Geocode] Failed:', err.message);
    return null;
  }
}

/**
 * Geocode a restaurant or specific POI name/address via ORS Geocoding API.
 * Falls back to Nominatim if ORS fails or returns no match.
 */
export async function geocodePlaceORS(query) {
  if (!query?.trim()) return null;
  const cleaned = query.trim();

  // 1. Try ORS Geocoding API
  if (ORS_KEY) {
    try {
      const url = new URL(`${ORS_BASE}/geocode/search`);
      url.searchParams.set('api_key', ORS_KEY);
      url.searchParams.set('text', cleaned.includes('India') ? cleaned : `${cleaned}, India`);
      url.searchParams.set('size', '1');
      url.searchParams.set('boundary.country', 'IND');

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        const feature = data.features?.[0];
        if (feature?.geometry?.coordinates) {
          const [lng, lat] = feature.geometry.coordinates;
          if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
            return { lat, lng, name: feature.properties?.name || cleaned };
          }
        }
      }
    } catch (e) {
      console.warn('[geocodePlaceORS] ORS lookup error:', e.message);
    }
  }

  // 2. Robust fallback via Nominatim
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleaned)}&format=json&limit=1`;
    const res = await fetch(nomUrl, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'PackUrBag/1.0' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng, name: data[0].display_name || cleaned };
        }
      }
    }
  } catch (e) {
    console.warn('[geocodePlaceORS] Nominatim fallback failed:', e.message);
  }

  return null;
}

/**
 * Fetch up to `limit` tourist POIs near given coordinates from ORS POI API.
 * Returns normalized place objects, empty array on failure.
 */
export async function fetchORSTouristPlaces(lat, lng, limit = 2, bufferMeters = 5000) {
  if (!ORS_KEY || lat == null || lng == null) return [];
  try {
    const res = await fetch(`${ORS_BASE}/pois`, {
      method: 'POST',
      headers: {
        'Authorization': ORS_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json, application/geo+json',
      },
      body: JSON.stringify({
        request: 'pois',
        geometry: {
          geojson: { type: 'Point', coordinates: [lng, lat] },
          buffer: bufferMeters,
        },
        filters: { category_ids: TOURIST_CATEGORY_IDS },
        limit,
        sortby: 'distance',
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const features = data.features || [];
    if (features.length === 0) return [];

    return features.slice(0, limit).map((f, i) => {
      const tags = f.properties?.osm_tags || {};
      const catIds = f.properties?.category_ids
        ? Object.values(f.properties.category_ids).flat().map(Number)
        : [];
      const name = tags.name || tags['name:en'] || `Tourist Spot ${i + 1}`;
      const [pLng, pLat] = f.geometry.coordinates;

      return {
        id: `ors_${f.properties?.osm_id || `${lat}_${i}`}`,
        name,
        city: tags['addr:city'] || tags['addr:town'] || '',
        state: tags['addr:state'] || '',
        zone: 'ORS',
        type: getCategoryLabel(catIds, tags),
        significance: 'Tourist Attraction',
        description: tags.description || tags.tourism || 'A notable attraction near your destination.',
        entrance_fee_inr: 0,
        dslr_allowed: 'Yes',
        weekly_off: 'None',
        rating: 4.0,
        lat: pLat,
        lng: pLng,
        image: null,
        source: 'ors',
        osm_tags: tags,
        category_ids: catIds,
      };
    });
  } catch (err) {
    console.warn('[ORS POI] Failed:', err.message);
    return [];
  }
}

/**
 * Reverse-geocode coordinates to find the nearest named locality using ORS.
 * Returns { cityName, lat, lng } or null on failure.
 */
export async function fetchNearestCityORS(lat, lng) {
  if (!ORS_KEY) return null;
  try {
    const url = new URL(`${ORS_BASE}/geocode/reverse`);
    url.searchParams.set('api_key', ORS_KEY);
    url.searchParams.set('point.lon', String(lng));
    url.searchParams.set('point.lat', String(lat));
    url.searchParams.set('size', '5');
    url.searchParams.set('layers', 'locality');
    url.searchParams.set('boundary.country', 'IND');

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const data = await res.json();

    const feature = data.features
      ?.filter(f => f.properties?.layer === 'locality' && f.properties?.confidence > 0.3)
      .sort((a, b) => (b.properties?.confidence || 0) - (a.properties?.confidence || 0))[0]
      || data.features?.[0];

    if (!feature) return null;
    const [fLng, fLat] = feature.geometry.coordinates;
    return {
      cityName: feature.properties?.name || feature.properties?.label || 'Nearby City',
      lat: fLat,
      lng: fLng,
    };
  } catch (err) {
    console.warn('[ORS Reverse Geocode] Failed:', err.message);
    return null;
  }
}

function getCategoryLabel(categoryIds, tags = {}) {
  if (tags.amenity === 'place_of_worship' || tags.religion || tags.tourism === 'temple' || categoryIds.includes(550)) return 'Temple';
  if (tags.historic || categoryIds.includes(268) || categoryIds.includes(150)) return 'Historical Site';
  if (tags.natural === 'beach' || categoryIds.includes(380)) return 'Beach';
  if (tags.leisure === 'park' || tags.leisure === 'nature_reserve' || tags.leisure === 'garden' || categoryIds.includes(390)) return 'Nature & Park';
  if (tags.tourism === 'museum' || categoryIds.includes(267) || categoryIds.includes(191)) return 'Museum';
  if (tags.tourism === 'viewpoint' || categoryIds.includes(344)) return 'Viewpoint';
  if (tags.sport || tags.leisure === 'water_park' || categoryIds.includes(530)) return 'Adventure';
  if (categoryIds.includes(162) || categoryIds.includes(160)) return 'Tourist Attraction';
  return 'Tourist Attraction';
}


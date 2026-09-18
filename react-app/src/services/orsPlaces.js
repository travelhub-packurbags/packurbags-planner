// ORS Places Service — fallback tourist place lookup for cities not in local dataset.
// Uses ORS Geocoding + POI endpoints. Max 2 places enforced at API level.
// No Google Places calls here — Google is already used upstream in Step1Places.

const ORS_KEY = import.meta.env.VITE_ORS_KEY || '';
const ORS_BASE = 'https://api.openrouteservice.org';

// Tourist-relevant ORS POI category IDs
// 160=Tourism, 162=Attraction, 150=Historic, 344=Viewpoint, 191=Museum
const TOURIST_CATEGORY_IDS = [160, 162, 150, 344, 191];

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
        ? Object.values(f.properties.category_ids).flat()
        : [];
      const name = tags.name || tags['name:en'] || `Tourist Spot ${i + 1}`;
      const [pLng, pLat] = f.geometry.coordinates;

      return {
        id: `ors_${f.properties?.osm_id || `${lat}_${i}`}`,
        name,
        city: tags['addr:city'] || tags['addr:town'] || '',
        state: tags['addr:state'] || '',
        zone: 'ORS',
        type: getCategoryLabel(catIds),
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

function getCategoryLabel(categoryIds) {
  if (!categoryIds?.length) return 'Tourist Attraction';
  const id = Number(categoryIds[0]);
  if (id === 162) return 'Tourist Attraction';
  if (id === 150) return 'Historical Site';
  if (id === 344) return 'Viewpoint';
  if (id === 191) return 'Museum';
  if (id === 160) return 'Tourist Spot';
  return 'Tourist Attraction';
}

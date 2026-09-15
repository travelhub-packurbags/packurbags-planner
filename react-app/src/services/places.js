import { toast } from 'react-toastify';

let GOOGLE_PLACES_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY || "";
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// Module-level cache for fetchGoogleAttractions.
// Prevents duplicate API calls from React StrictMode's double-invoke.
const attractionsCache = new Map();

export async function getGoogleKey() {
  if (GOOGLE_PLACES_KEY) return GOOGLE_PLACES_KEY;
  try {
    const res = await fetch(`${BACKEND_URL}/api/config/maps`);
    const data = await res.json();
    GOOGLE_PLACES_KEY = data.googlePlacesKey;
    return GOOGLE_PLACES_KEY;
  } catch (err) {
    console.error("Failed to fetch maps config", err);
    return "";
  }
}

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";

let cachedLocalData = null;

/**
 * Load local datasets as fallback for offline or API errors.
 */
async function loadLocalDataset() {
  if (cachedLocalData) return cachedLocalData;
  try {
    const [placesRes, locationsRes, hotelsRes] = await Promise.all([
      fetch('/data/tourist_places.json').then(r => r.json()).catch(() => []),
      fetch('/data/locations.json').then(r => r.json()).catch(() => []),
      fetch('/data/hotels.json').then(r => r.json()).catch(() => [])
    ]);

    cachedLocalData = {
      places: Array.isArray(placesRes) ? placesRes : [],
      locations: Array.isArray(locationsRes) ? locationsRes : [],
      hotels: Array.isArray(hotelsRes) ? hotelsRes : []
    };
    return cachedLocalData;
  } catch (err) {
    console.error("Error loading local fallback datasets:", err);
    return { places: [], locations: [], hotels: [] };
  }
}

/**
 * Search local datasets when Google API fails
 */
async function searchLocalDataset(query) {
  const { places, locations, hotels } = await loadLocalDataset();
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];

  const results = [];

  places.forEach(p => {
    if ((p.name && p.name.toLowerCase().includes(q)) || (p.city && p.city.toLowerCase().includes(q))) {
      results.push({
        placeId: `local_p_${p.id || p.name}`,
        text: `${p.name} (${p.city || 'India'})`,
        displayName: p.name,
        rawItem: p,
        source: 'local'
      });
    }
  });

  locations.forEach(l => {
    if ((l.title && l.title.toLowerCase().includes(q)) || (l.country && l.country.toLowerCase().includes(q))) {
      results.push({
        placeId: `local_l_${l.id || l.title}`,
        text: `${l.title} (${l.country || 'India'})`,
        displayName: l.title,
        rawItem: l,
        source: 'local'
      });
    }
  });

  hotels.forEach(h => {
    const name = h.property_name || h.name || 'Hotel';
    if (name.toLowerCase().includes(q) || (h.city && h.city.toLowerCase().includes(q))) {
      results.push({
        placeId: `local_h_${h.id || name}`,
        text: `${name} (${h.city || 'India'})`,
        displayName: name,
        rawItem: h,
        source: 'local'
      });
    }
  });

  return results.slice(0, 8);
}

/**
 * Get place details from local fallback dataset
 */
async function getLocalPlaceDetails(placeId) {
  const { places, locations, hotels } = await loadLocalDataset();

  let found = places.find(p => `local_p_${p.id || p.name}` === placeId);
  if (found) {
    return {
      id: placeId,
      placeId,
      name: found.name,
      displayName: found.name,
      lat: found.lat || 15.4989,
      lng: found.lng || 73.8278,
      location: { latitude: found.lat || 15.4989, longitude: found.lng || 73.8278 },
      rating: found.rating || 4.5,
      formattedAddress: `${found.name}, ${found.city || 'India'}`,
      address: `${found.name}, ${found.city || 'India'}`,
      entrance_fee_inr: found.entrance_fee_inr || 0,
      dslr_allowed: found.dslr_allowed || 'Yes',
      weekly_off: found.weekly_off || 'None',
      source: 'local'
    };
  }

  found = locations.find(l => `local_l_${l.id || l.title}` === placeId);
  if (found) {
    return {
      id: placeId,
      placeId,
      name: found.title,
      displayName: found.title,
      lat: found.lat || 20.5937,
      lng: found.lng || 78.9629,
      location: { latitude: found.lat || 20.5937, longitude: found.lng || 78.9629 },
      rating: found.rating || 4.7,
      formattedAddress: `${found.title}, ${found.country || 'India'}`,
      address: `${found.title}, ${found.country || 'India'}`,
      source: 'local'
    };
  }

  found = hotels.find(h => `local_h_${h.id || h.property_name}` === placeId);
  if (found) {
    const name = found.property_name || found.name || 'Hotel';
    return {
      id: placeId,
      placeId,
      name,
      displayName: name,
      lat: found.lat || 15.2993,
      lng: found.lng || 74.124,
      location: { latitude: found.lat || 15.2993, longitude: found.lng || 74.124 },
      rating: found.hotel_stars || 4.2,
      formattedAddress: `${name}, ${found.city || 'India'}`,
      address: `${name}, ${found.city || 'India'}`,
      source: 'local'
    };
  }

  return {
    id: placeId,
    placeId,
    name: 'India Landmark',
    displayName: 'India Landmark',
    lat: 20.5937,
    lng: 78.9629,
    location: { latitude: 20.5937, longitude: 78.9629 },
    rating: 4.5,
    formattedAddress: 'India',
    address: 'India',
    source: 'local'
  };
}

/**
 * 1. PLACES SEARCH + AUTOCOMPLETE
 * Replace local CSV search with Google Places API (New).
 */
export async function searchPlaces(query) {
  if (!query || !query.trim()) return [];

  try {
    const key = await getGoogleKey();
    if (!key) throw new Error("Missing Google Places API Key");

    const res = await fetch(AUTOCOMPLETE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'
      },
      body: JSON.stringify({
        input: query.trim(),
        includedRegionCodes: ['in']
      })
    });

    if (!res.ok) {
      throw new Error(`Google Places API returned status ${res.status}`);
    }

    const data = await res.json();
    const suggestions = data.suggestions || [];

    if (suggestions.length === 0) {
      return searchLocalDataset(query);
    }

    return suggestions.map(s => {
      const pred = s.placePrediction || {};
      const textVal = pred.text?.text || (typeof pred.text === 'string' ? pred.text : 'Unknown Place');
      const mainText = pred.structuredFormat?.mainText?.text || textVal;
      return {
        placeId: pred.placeId,
        text: textVal, // Full text for display in dropdown
        displayName: mainText, // Short name for the input field
        source: 'google'
      };
    }).filter(item => item.placeId);

  } catch (err) {
    console.error("Google API failed, falling back to local dataset:", err.message || err);
    toast.warn("Using offline data. Some suggestions may be limited", { toastId: 'google-fallback-warn' });
    return searchLocalDataset(query);
  }
}

/**
 * Get detailed place information by placeId
 */
export async function getPlaceDetails(placeId) {
  if (!placeId) return null;

  if (placeId.startsWith('local_')) {
    return getLocalPlaceDetails(placeId);
  }

  try {
    const key = await getGoogleKey();
    if (!key) throw new Error("Missing Google Places API Key");

    const url = `https://places.googleapis.com/v1/places/${placeId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'id,displayName,location,rating,formattedAddress,websiteUri,photos'
      }
    });

    if (!res.ok) {
      throw new Error(`Google Place Details API returned status ${res.status}`);
    }

    const data = await res.json();
    const name = data.displayName?.text || 'Attraction';
    const lat = data.location?.latitude || 0;
    const lng = data.location?.longitude || 0;

    return {
      id: data.id || placeId,
      placeId: data.id || placeId,
      name,
      displayName: name,
      lat,
      lng,
      location: data.location || { latitude: lat, longitude: lng },
      rating: data.rating || 4.5,
      formattedAddress: data.formattedAddress || '',
      address: data.formattedAddress || '',
      websiteUri: data.websiteUri || null,
      photos: data.photos || [],
      source: 'google'
    };

  } catch (err) {
    console.error("Google API failed, falling back to local dataset:", err.message || err);
    toast.warn("Using offline data. Some suggestions may be limited", { toastId: 'google-details-fallback-warn' });
    return getLocalPlaceDetails(placeId);
  }
}

/**
 * Helper to geocode a city name into {lat, lng} coordinates
 */
export async function geocodeCity(cityName) {
  if (!cityName) return null;
  const q = cityName.toLowerCase().trim();
  
  // Try local hardcoded first for speed
  const CITY_COORDS = {
    'shimla': { lat: 31.1048, lng: 77.1734 },
    'goa': { lat: 15.2993, lng: 74.1240 },
    'delhi': { lat: 28.6139, lng: 77.2090 },
    'new delhi': { lat: 28.6139, lng: 77.2090 },
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'jaipur': { lat: 26.9124, lng: 75.7873 },
    'manali': { lat: 32.2432, lng: 77.1892 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'bengaluru': { lat: 12.9716, lng: 77.5946 },
    'kolkata': { lat: 22.5726, lng: 88.3639 },
    'chennai': { lat: 13.0827, lng: 80.2707 },
    'hyderabad': { lat: 17.3850, lng: 78.4867 },
    'pune': { lat: 18.5204, lng: 73.8567 },
    'chandigarh': { lat: 30.7333, lng: 76.7794 },
    'rishikesh': { lat: 30.0869, lng: 78.2676 },
    'indore': { lat: 22.7196, lng: 75.8577 },
    'thiruvananthapuram': { lat: 8.5241, lng: 76.9366 },
    'trivandrum': { lat: 8.5241, lng: 76.9366 },
    'lucknow': { lat: 26.8467, lng: 80.9462 },
    'agra': { lat: 27.1767, lng: 78.0081 },
    'varanasi': { lat: 25.3176, lng: 82.9739 },
    'amritsar': { lat: 31.6340, lng: 74.8723 },
    'udaipur': { lat: 24.5854, lng: 73.7125 },
    'jodhpur': { lat: 26.2389, lng: 73.0243 },
    'mysore': { lat: 12.2958, lng: 76.6394 },
    'mysuru': { lat: 12.2958, lng: 76.6394 },
    'kochi': { lat: 9.9312, lng: 76.2673 },
    'coimbatore': { lat: 11.0168, lng: 76.9558 },
    'bhopal': { lat: 23.2599, lng: 77.4126 },
    'nagpur': { lat: 21.1458, lng: 79.0882 },
    'surat': { lat: 21.1702, lng: 72.8311 },
    'ahmedabad': { lat: 23.0225, lng: 72.5714 },
    'patna': { lat: 25.5941, lng: 85.1376 },
    'bhubaneswar': { lat: 20.2961, lng: 85.8245 },
    'raipur': { lat: 21.2514, lng: 81.6296 },
    'guwahati': { lat: 26.1445, lng: 91.7362 },
    'darjeeling': { lat: 27.0360, lng: 88.2627 },
    'ooty': { lat: 11.4064, lng: 76.6932 },
    'kodaikanal': { lat: 10.2381, lng: 77.4892 },
    'hampi': { lat: 15.3350, lng: 76.4600 },
    'pondicherry': { lat: 11.9416, lng: 79.8083 },
    'jaisalmer': { lat: 26.9157, lng: 70.9083 },
    'pushkar': { lat: 26.4897, lng: 74.5511 },
    'mcleod ganj': { lat: 32.2427, lng: 76.3218 },
    'dharamsala': { lat: 32.2190, lng: 76.3234 },
    'spiti': { lat: 32.2461, lng: 78.0349 },
    'leh': { lat: 34.1526, lng: 77.5771 },
    'srinagar': { lat: 34.0837, lng: 74.7973 },
    'dehradun': { lat: 30.3165, lng: 78.0322 },
    'haridwar': { lat: 29.9457, lng: 78.1642 },
    'nainital': { lat: 29.3919, lng: 79.4542 },
    'mussoorie': { lat: 30.4598, lng: 78.0664 },
    'vizag': { lat: 17.6868, lng: 83.2185 },
    'visakhapatnam': { lat: 17.6868, lng: 83.2185 },
    'madurai': { lat: 9.9252, lng: 78.1198 },
    'tiruchirappalli': { lat: 10.7905, lng: 78.7047 },
  };

  const localMatch = Object.keys(CITY_COORDS).find(k => q.includes(k));
  if (localMatch) {
    return CITY_COORDS[localMatch];
  }

  // Exact landmark coordinates to prevent overlapping pins when API fails
  const EXACT_LANDMARKS = {
    // Mumbai
    'gateway of india': { lat: 18.9220, lng: 72.8347 },
    'marine drive': { lat: 18.9440, lng: 72.8238 },
    'chowpatty': { lat: 18.9519, lng: 72.8166 }, // Added Chowpatty Beach
    'juhu': { lat: 19.1031, lng: 72.8266 },
    'elephanta': { lat: 18.9633, lng: 72.9315 },
    'bandra': { lat: 19.0553, lng: 72.8335 },
    'haji ali': { lat: 18.9827, lng: 72.8089 },
    'siddhivinayak': { lat: 19.0166, lng: 72.8304 },
    'dharavi': { lat: 19.0380, lng: 72.8538 },
    'film city': { lat: 19.1610, lng: 72.8833 },
    // Delhi
    'india gate': { lat: 28.6129, lng: 77.2295 },
    'red fort': { lat: 28.6562, lng: 77.2410 },
    'qutub minar': { lat: 28.5244, lng: 77.1855 },
    'humayun': { lat: 28.5933, lng: 77.2507 },
    'lotus temple': { lat: 28.5535, lng: 77.2588 },
    'akshardham': { lat: 28.6127, lng: 77.2773 },
    'chandni chowk': { lat: 28.6505, lng: 77.2303 },
    'jantar mantar': { lat: 28.6271, lng: 77.2166 },
    'connaught': { lat: 28.6304, lng: 77.2177 },
    // Jaipur
    'jaigarh': { lat: 26.9855, lng: 75.8491 },
    'amer fort': { lat: 26.9855, lng: 75.8513 },
    'amber fort': { lat: 26.9855, lng: 75.8513 },
    'city palace': { lat: 26.9258, lng: 75.8235 }, // Jaipur
    'hawa mahal': { lat: 26.9239, lng: 75.8267 },
    'nahargarh': { lat: 26.9372, lng: 75.8153 },
    'jal mahal': { lat: 26.9531, lng: 75.8459 },
    'albert hall': { lat: 26.9116, lng: 75.8195 },
    'birla mandir': { lat: 26.8922, lng: 75.8156 },
    // Agra
    'taj mahal': { lat: 27.1751, lng: 78.0421 },
    'agra fort': { lat: 27.1795, lng: 78.0195 },
    'fatehpur': { lat: 27.0945, lng: 77.6679 },
    // Varanasi
    'kashi': { lat: 25.3109, lng: 83.0107 },
    'dashashwamedh': { lat: 25.3068, lng: 83.0106 },
    'sarnath': { lat: 25.3811, lng: 83.0214 },
    'manikarnika': { lat: 25.3106, lng: 83.0141 },
    // Amritsar
    'golden temple': { lat: 31.6200, lng: 74.8765 },
    'wagah': { lat: 31.6053, lng: 74.5714 },
    'jallianwala': { lat: 31.6208, lng: 74.8800 },
    // Goa
    'calangute': { lat: 15.5494, lng: 73.7626 },
    'baga': { lat: 15.5553, lng: 73.7517 },
    'anjuna': { lat: 15.5733, lng: 73.7444 },
    'fort aguada': { lat: 15.4925, lng: 73.7667 },
    // Bangalore
    'cubbon': { lat: 12.9779, lng: 77.5952 },
    'lalbagh': { lat: 12.9507, lng: 77.5848 },
    'vidhana soudha': { lat: 12.9796, lng: 77.5908 },
    'nandi hills': { lat: 13.3702, lng: 77.6835 },
    'ulsoor': { lat: 12.9818, lng: 77.6212 },
    // Kolkata
    'victoria memorial': { lat: 22.5448, lng: 88.3426 },
    'howrah': { lat: 22.5851, lng: 88.3468 },
    'dakshineswar': { lat: 22.6545, lng: 88.3575 },
    'kalighat': { lat: 22.5204, lng: 88.3425 },
    // Hyderabad
    'charminar': { lat: 17.3616, lng: 78.4747 },
    'golconda': { lat: 17.3833, lng: 78.4011 },
    'hussain sagar': { lat: 17.4239, lng: 78.4738 },
    'ramoji': { lat: 17.2543, lng: 78.6808 },
    // Mysore
    'mysore palace': { lat: 12.3051, lng: 76.6551 },
    'chamundi': { lat: 12.2740, lng: 76.6713 },
    'brindavan': { lat: 12.4234, lng: 76.5730 },
    // Manali
    'rohtang': { lat: 32.3716, lng: 77.2466 },
    'solang': { lat: 32.3164, lng: 77.1565 },
    'hadimba': { lat: 32.2464, lng: 77.1824 },
    // Shimla
    'jakhu': { lat: 31.1026, lng: 77.1818 },
    'kufri': { lat: 31.1011, lng: 77.2662 },
    'mall road': { lat: 31.1042, lng: 77.1711 },
    // Udaipur
    'lake pichola': { lat: 24.5700, lng: 73.6738 },
    'jag mandir': { lat: 24.5676, lng: 73.6773 },
    'saheliyon': { lat: 24.6025, lng: 73.6874 },
    // Jodhpur
    'mehrangarh': { lat: 26.2978, lng: 73.0185 },
    'umaid bhawan': { lat: 26.2807, lng: 73.0471 },
    // Jaisalmer
    'jaisalmer fort': { lat: 26.9124, lng: 70.9126 },
    'sam sand': { lat: 26.8183, lng: 70.5286 },
    'patwon': { lat: 26.9150, lng: 70.9160 },
    // Kochi/Kerala
    'alleppey': { lat: 9.4981, lng: 76.3388 },
    'periyar': { lat: 9.4679, lng: 77.1432 },
    'backwater': { lat: 9.6000, lng: 76.3667 },
  };
  const exactMatch = Object.keys(EXACT_LANDMARKS).find(k => q.includes(k));
  if (exactMatch) {
    return EXACT_LANDMARKS[exactMatch];
  }

  // Fallback to Google Text Search API (more accurate for full address strings than Autocomplete)
  try {
    const key = await getGoogleKey();
    if (!key) throw new Error("Missing Google API Key");

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.location'
      },
      body: JSON.stringify({
        textQuery: cityName
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.places && data.places.length > 0) {
        const loc = data.places[0].location;
        if (loc && loc.latitude && loc.longitude) {
          return { lat: loc.latitude, lng: loc.longitude };
        }
      }
    }
  } catch (err) {
    console.error("Geocoding failed for:", cityName, err);
  }

  return null;
}

/**
 * Search for Top 10 Restaurants in a given city using Google Places API (Text Search)
 */
export async function searchRestaurants(cityName) {
  try {
    // Step 1: Geocode the city to get lat/lng using Nominatim (free, no key)
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en', 'User-Agent': 'FirstflightTravels/1.0' } }
    );
    const geoData = await geoRes.json();
    if (!geoData || geoData.length === 0) throw new Error('City not found');

    const { lat, lon } = geoData[0];
    const radius = 10000; // 10km radius

    // Step 2: Query Overpass API for restaurants in the city
    const overpassQuery = `
      [out:json][timeout:20];
      (
        node["amenity"="restaurant"]["name"](around:${radius},${lat},${lon});
        way["amenity"="restaurant"]["name"](around:${radius},${lat},${lon});
      );
      out body 60;
    `;
    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
    });

    if (!overpassRes.ok) throw new Error('Overpass API failed');

    const overpassData = await overpassRes.json();
    let elements = overpassData.elements || [];

    // Step 3: Filter & enrich elements
    elements = elements.filter(e => e.tags && e.tags.name);

    // Sort by having more tag info (better data quality)
    elements.sort((a, b) => Object.keys(b.tags).length - Object.keys(a.tags).length);

    // Limit to top 10
    elements = elements.slice(0, 10);

    // Food image pool for variety
    const foodImages = [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?auto=format&fit=crop&w=600&q=80',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80',
    ];

    return elements.map((e, i) => {
      const tags = e.tags;
      const cuisine = tags.cuisine ? tags.cuisine.replace(/_/g, ' ') : 'Multi-cuisine';
      const rating = parseFloat((3.8 + Math.random() * 1.2).toFixed(1)); // 3.8 – 5.0
      let price = 500;
      if (tags['price:range'] === '$') price = 300;
      else if (tags['price:range'] === '$$') price = 800;
      else if (tags['price:range'] === '$$$') price = 1500;
      else if (tags['price:range'] === '$$$$') price = 2500;

      return {
        id: `osm_${e.id}`,
        name: tags.name,
        city: cityName,
        cuisine,
        food_type: cuisine,
        rating,
        avg_rating: rating,
        price,
        area: tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:street'] || cityName,
        image: foodImages[i % foodImages.length],
        source: 'openstreetmap'
      };
    });

  } catch (err) {
    console.error('Restaurant search (Overpass) failed:', err);
    throw err;
  }
}


/**
 * Search for Top 10 Tourist Attractions in a given city using Google Places API
 */
export function fetchGoogleAttractions(cityName) {
  // Cache stores the Promise — set BEFORE any await so StrictMode's 2nd call
  // always gets a cache hit and shares the single in-flight request.
  if (attractionsCache.has(cityName)) return attractionsCache.get(cityName);

  const p = (async () => {
    const key = await getGoogleKey();
    if (!key) return [];

    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // No places.photos — tourist spot images come from Wikipedia
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.formattedAddress,places.editorialSummary,places.location,places.primaryType',
      },
      body: JSON.stringify({ textQuery: `top tourist attractions in ${cityName}`, languageCode: 'en' }),
    });

    if (!res.ok) {
      console.error(`[fetchGoogleAttractions] HTTP ${res.status} for "${cityName}"`);
      return [];
    }

    const data = await res.json();
    if (!data.places) return [];

    return data.places.slice(0, 10).map((p, idx) => ({
      id: `google_p_${p.id || idx}`,
      name: p.displayName?.text || 'Attraction',
      city: cityName,
      state: cityName,
      zone: 'Unknown',
      type: p.primaryType ? p.primaryType.replace(/_/g, ' ') : 'Tourist Hub',
      google_review_rating: p.rating || 4.5,
      entrance_fee_inr: 0,
      weekly_off: 'None',
      dslr_allowed: 'Yes',
      description: p.editorialSummary?.text || `A beautiful popular tourist attraction located in ${cityName}.`,
      lat: p.location?.latitude,
      lng: p.location?.longitude,
      image: null,   // fetched separately via Wikipedia
      source: 'google',
    }));
  })();

  // Store Promise immediately — before any await runs — so duplicate calls share it
  attractionsCache.set(cityName, p);
  return p;
}


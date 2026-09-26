import { toast } from 'react-toastify';

// All Google Places calls go through backend proxy — no key in the browser bundle.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

let cachedLocalData = null;

/**
 * Load local datasets as fallback for offline or API errors.
 */
async function loadLocalDataset() {
  if (cachedLocalData) return cachedLocalData;
  try {
    const [placesRes, locationsRes, hotelsRes] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/tourist_places.json`).then(r => r.json()).catch(() => []),
      fetch(`${import.meta.env.BASE_URL}data/locations.json`).then(r => r.json()).catch(() => []),
      fetch(`${import.meta.env.BASE_URL}data/hotels.json`).then(r => r.json()).catch(() => [])
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
    const res = await fetch(`${BACKEND_URL}/v1/planner/places/search?q=${encodeURIComponent(query.trim())}`);
    if (!res.ok) throw new Error(`Backend places search returned ${res.status}`);
    const data = await res.json();
    if (data.code === 'PLANNER_UNAVAILABLE') throw new Error(data.message);

    const suggestions = data.suggestions || [];
    if (suggestions.length === 0) return searchLocalDataset(query);

    return suggestions.map(s => {
      const pred    = s.placePrediction || {};
      const textVal = pred.text?.text || (typeof pred.text === 'string' ? pred.text : 'Unknown Place');
      const mainText = pred.structuredFormat?.mainText?.text || textVal;
      return {
        placeId:     pred.placeId,
        text:        textVal,
        displayName: mainText,
        source:      'google',
      };
    }).filter(item => item.placeId);

  } catch (err) {
    console.error('Places search failed, falling back to local dataset:', err.message || err);
    toast.warn('Using offline data. Some suggestions may be limited', { toastId: 'google-fallback-warn' });
    return searchLocalDataset(query);
  }
}


/**
 * Get detailed place information by placeId
 */
export async function getPlaceDetails(placeId) {
  if (!placeId) return null;
  if (placeId.startsWith('local_')) return getLocalPlaceDetails(placeId);

  try {
    const res = await fetch(`${BACKEND_URL}/v1/planner/places/${encodeURIComponent(placeId)}`);
    if (!res.ok) throw new Error(`Backend place details returned ${res.status}`);
    const data = await res.json();
    if (data.code === 'PLANNER_UNAVAILABLE') throw new Error(data.message);

    const name = data.displayName?.text || 'Attraction';
    const lat  = data.location?.latitude  || 0;
    const lng  = data.location?.longitude || 0;
    return {
      id: data.id || placeId, placeId: data.id || placeId,
      name, displayName: name, lat, lng,
      location: data.location || { latitude: lat, longitude: lng },
      rating: data.rating || 4.5,
      formattedAddress: data.formattedAddress || '',
      address: data.formattedAddress || '',
      websiteUri: data.websiteUri || null,
      photos: data.photos || [],
      source: 'google',
    };
  } catch (err) {
    console.error('Place details failed, falling back to local dataset:', err.message || err);
    toast.warn('Using offline data. Some suggestions may be limited', { toastId: 'google-details-fallback-warn' });
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
    // Telangana / Andhra Pradesh cities
    'khammam': { lat: 17.2465, lng: 80.1514 },
    'warangal': { lat: 17.9689, lng: 79.5941 },
    'karimnagar': { lat: 18.4386, lng: 79.1288 },
    'nizamabad': { lat: 18.6726, lng: 78.0941 },
    'nalgonda': { lat: 17.0576, lng: 79.2671 },
    'adilabad': { lat: 19.6641, lng: 78.5320 },
    'kurnool': { lat: 15.8281, lng: 78.0373 },
    'guntur': { lat: 16.3067, lng: 80.4365 },
    'nellore': { lat: 14.4426, lng: 79.9865 },
    'vijayawada': { lat: 16.5062, lng: 80.6480 },
    'tirupati': { lat: 13.6288, lng: 79.4192 },
    'kakinada': { lat: 16.9891, lng: 82.2475 },
    'rajahmundry': { lat: 17.0005, lng: 81.8040 },
    'vizianagaram': { lat: 18.1168, lng: 83.4115 },
    'eluru': { lat: 16.7107, lng: 81.0952 },
    'ongole': { lat: 15.5057, lng: 80.0499 },
    'anantapur': { lat: 14.6819, lng: 77.6006 },
    'kadapa': { lat: 14.4673, lng: 78.8242 },
    'chittoor': { lat: 13.2172, lng: 79.1003 },
    'srikakulam': { lat: 18.2949, lng: 83.8938 },
    // Karnataka
    'hubli': { lat: 15.3647, lng: 75.1240 },
    'dharwad': { lat: 15.4589, lng: 75.0078 },
    'mangalore': { lat: 12.9141, lng: 74.8560 },
    'bellary': { lat: 15.1394, lng: 76.9214 },
    'bidar': { lat: 17.9104, lng: 77.5199 },
    'gulbarga': { lat: 17.3297, lng: 76.8343 },
    'tumkur': { lat: 13.3409, lng: 77.1010 },
    'davanagere': { lat: 14.4644, lng: 75.9218 },
    'shivamogga': { lat: 13.9299, lng: 75.5681 },
    'udupi': { lat: 13.3409, lng: 74.7421 },
    // Maharashtra
    'nashik': { lat: 19.9975, lng: 73.7898 },
    'aurangabad': { lat: 19.8762, lng: 75.3433 },
    'solapur': { lat: 17.6599, lng: 75.9064 },
    'kolhapur': { lat: 16.7050, lng: 74.2433 },
    'amravati': { lat: 20.9374, lng: 77.7796 },
    'latur': { lat: 18.4088, lng: 76.5604 },
    'nanded': { lat: 19.1383, lng: 77.3210 },
    // Rajasthan
    'ajmer': { lat: 26.4499, lng: 74.6399 },
    'bikaner': { lat: 28.0229, lng: 73.3119 },
    'kota': { lat: 25.2138, lng: 75.8648 },
    'alwar': { lat: 27.5530, lng: 76.6346 },
    'bharatpur': { lat: 27.2152, lng: 77.4938 },
    // Madhya Pradesh
    'jabalpur': { lat: 23.1815, lng: 79.9864 },
    'gwalior': { lat: 26.2183, lng: 78.1828 },
    'ujjain': { lat: 23.1828, lng: 75.7772 },
    'sagar': { lat: 23.8388, lng: 78.7378 },
    'satna': { lat: 24.5794, lng: 80.8317 },
    // UP / Bihar
    'prayagraj': { lat: 25.4358, lng: 81.8463 },
    'allahabad': { lat: 25.4358, lng: 81.8463 },
    'kanpur': { lat: 26.4499, lng: 80.3319 },
    'meerut': { lat: 28.9845, lng: 77.7064 },
    'aligarh': { lat: 27.8974, lng: 78.0880 },
    'mathura': { lat: 27.4924, lng: 77.6737 },
    'gorakhpur': { lat: 26.7606, lng: 83.3732 },
    'muzaffarpur': { lat: 26.1209, lng: 85.3647 },
    'gaya': { lat: 24.7914, lng: 84.9994 },
    // West Bengal / NE India
    'siliguri': { lat: 26.7271, lng: 88.3953 },
    'asansol': { lat: 23.6832, lng: 86.9820 },
    'durgapur': { lat: 23.5204, lng: 87.3119 },
    'shillong': { lat: 25.5788, lng: 91.8933 },
    'agartala': { lat: 23.8315, lng: 91.2868 },
    'imphal': { lat: 24.8170, lng: 93.9368 },
    'aizawl': { lat: 23.7271, lng: 92.7176 },
    // Gujarat
    'vadodara': { lat: 22.3072, lng: 73.1812 },
    'rajkot': { lat: 22.3039, lng: 70.8022 },
    'bhavnagar': { lat: 21.7645, lng: 72.1519 },
    'junagadh': { lat: 21.5222, lng: 70.4579 },
    'jamnagar': { lat: 22.4707, lng: 70.0577 },
    // Others
    'ranchi': { lat: 23.3441, lng: 85.3096 },
    'jamshedpur': { lat: 22.8046, lng: 86.2029 },
    'dhanbad': { lat: 23.7957, lng: 86.4304 },
    'rourkela': { lat: 22.2270, lng: 84.8647 },
    'cuttack': { lat: 20.4625, lng: 85.8828 },
    'bareilly': { lat: 28.3670, lng: 79.4304 },
    'moradabad': { lat: 28.8386, lng: 78.7733 },
    'jammu': { lat: 32.7266, lng: 74.8570 },
    'panaji': { lat: 15.4909, lng: 73.8278 },
    'port blair': { lat: 11.6234, lng: 92.7265 },
  };

  let localMatch = null;
  if (CITY_COORDS[q]) {
    localMatch = q;
  } else {
    // Prevent substring bugs like "visakha-patna-m" matching "patna"
    localMatch = Object.keys(CITY_COORDS).find(k => q.startsWith(k + ',') || q.startsWith(k + ' '));
  }
  
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
  let exactMatch = null;
  if (EXACT_LANDMARKS[q]) {
    exactMatch = q;
  } else {
    // Basic boundary check to avoid substring bugs
    exactMatch = Object.keys(EXACT_LANDMARKS).find(k => {
      // Must match at the start or have a space/comma before it
      const idx = q.indexOf(k);
      if (idx === -1) return false;
      if (idx === 0) return true;
      const charBefore = q[idx - 1];
      return charBefore === ' ' || charBefore === ',' || charBefore === '-';
    });
  }
  if (exactMatch) {
    return EXACT_LANDMARKS[exactMatch];
  }

  // Fallback to backend Google Text Search proxy (more accurate for full address strings)
  try {
    const res = await fetch(`${BACKEND_URL}/v1/planner/geocode?city=${encodeURIComponent(cityName)}`);
    if (res.ok) {
      const data = await res.json();
      if (!data.code && data.places && data.places.length > 0) {
        const loc = data.places[0].location;
        if (loc && loc.latitude && loc.longitude) {
          return { lat: loc.latitude, lng: loc.longitude };
        }
      }
    }
  } catch (err) {
    console.error('Geocoding failed for:', cityName, err);
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
      const rating = parseFloat((3.8 + Math.random() * 1.2).toFixed(1)); // 3.8 â€“ 5.0
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


const attractionsCache = new Map();

/**
 * Search for Top 10 Tourist Attractions in a given city using Google Places API
 */
export function fetchGoogleAttractions(cityName) {
  // Cache stores the Promise â€” set BEFORE any await so StrictMode's 2nd call
  // always gets a cache hit and shares the single in-flight request.
  if (attractionsCache.has(cityName)) return attractionsCache.get(cityName);

  const p = (async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/v1/planner/places/attractions?city=${encodeURIComponent(cityName)}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (data.code === 'PLANNER_UNAVAILABLE' || !data.places) return [];

      return data.places.slice(0, 10).map((place, idx) => ({
        id:                   `google_p_${place.id || idx}`,
        name:                 place.displayName?.text || 'Attraction',
        city:                 cityName,
        state:                cityName,
        zone:                 'Unknown',
        type:                 place.primaryType ? place.primaryType.replace(/_/g, ' ') : 'Tourist Hub',
        google_review_rating: place.rating || 4.5,
        entrance_fee_inr:     0,
        weekly_off:           'None',
        dslr_allowed:         'Yes',
        description:          place.editorialSummary?.text || `A popular tourist attraction in ${cityName}.`,
        lat:                  place.location?.latitude,
        lng:                  place.location?.longitude,
        image:                null,
        source:               'google',
      }));
    } catch (err) {
      console.error(`[fetchGoogleAttractions] Failed for "${cityName}":`, err.message);
      return [];
    }
  })();

  // Store Promise immediately â€” before any await runs â€” so duplicate calls share it
  attractionsCache.set(cityName, p);
  return p;
}


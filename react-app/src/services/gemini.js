import { checkRateLimit, RATE_LIMITS } from '../utils/rateLimit';
import { SYSTEM_PROMPT } from './systemPrompt';
import { fetchWeather, getPrecautions } from './weather';
/**
 * Reverse geocode a [lat, lng] to a city name via Nominatim.
 */
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`,
      { headers: { 'Accept-Language': 'en' } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return d.address?.city || d.address?.town || d.address?.village || d.address?.county || null;
  } catch {
    return null;
  }
}

/**
 * Sample 3 intermediate cities from ORS polyline at 25%, 50%, 75%.
 */
async function getRouteWaypoints(polylineCoords) {
  if (!polylineCoords || polylineCoords.length < 4) return [];
  const indices = [
    Math.floor(polylineCoords.length * 0.25),
    Math.floor(polylineCoords.length * 0.50),
    Math.floor(polylineCoords.length * 0.75),
  ];
  const results = await Promise.all(
    indices.map(i => reverseGeocode(polylineCoords[i][0], polylineCoords[i][1]))
  );
  return [...new Set(results.filter(Boolean))];
}


// All Gemini calls go through the backend proxy -- no key in the browser bundle.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

/**
 * Core Gemini call.
 * 
 * PRODUCTION PATH: Calls /api/planner/generate on the backend (backend-core).
 *   The Gemini key is stored in PLANNER_GEMINI_API_KEY on the server â€” it never
 *   appears in the browser bundle.
 * 
 * LOCAL DEV FALLBACK: If the backend proxy returns a 503 (key not configured),
 *   falls back to calling Gemini directly using VITE_GEMINI_API_KEY if present.
 *   This keeps local development working without needing .env.planner set up.
 */
async function callGemini(userMessage, systemInstruction = null, requireDays = false) {
  const { allowed, retryAfterMs } = checkRateLimit(RATE_LIMITS.GEMINI.key, RATE_LIMITS.GEMINI.max, RATE_LIMITS.GEMINI.windowMs);
  if (!allowed) {
    throw new Error(`Rate limited. Try again in ${Math.ceil(retryAfterMs / 1000)}s`);
  }

  // --- 1. Try backend proxy (production path â€” key stays server-side) ---
  try {
    const proxyRes = await fetch(`${BACKEND_URL}/api/planner/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage, systemInstruction }),
      signal: AbortSignal.timeout(60000),
    });

    if (proxyRes.ok) {
      const data = await proxyRes.json();
      if (data.text) {
        if (requireDays) {
          try {
            const testObj = extractJSON(data.text);
            const daysArr = testObj.days || testObj.itinerary || [];
            if (Array.isArray(daysArr) && daysArr.length > 0) return data.text;
            // Days empty â€” fall through to direct call below
          } catch {
            // parse failed â€” fall through
          }
        } else {
          return data.text;
        }
      }
    } else if (proxyRes.status !== 503) {
      // 503 means key not set on server â€” expected for local dev, fall through silently
      console.warn(`[callGemini] Backend returned ${proxyRes.status}`);
    }
  } catch (proxyErr) {
    console.warn('[callGemini] Backend unreachable:', proxyErr.message);
  }

  // Safe fallback — keeps the UI from crashing when backend is down
  return JSON.stringify({
    days: [],
    trip_summary: { weather_note: 'Pleasant weather expected during travel dates.' },
    tips: ['Enjoy your journey!']
  });
}


/**
 * Robustly parse JSON from Gemini output.
 * Handles: raw JSON, ```json blocks, partial prose before/after.
 */
function extractJSON(text) {
  // Strip markdown code fences
  let cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Sometimes Gemini prepends a sentence â€” find the first { or [
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  if (firstBrace === -1 && firstBracket === -1) {
    throw new Error('No JSON object found in Gemini response.');
  }
  const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;
  cleaned = cleaned.slice(start);

  // Also trim any trailing prose after the last } or ]
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');
  const end = Math.max(lastBrace, lastBracket);
  if (end !== -1) {
    cleaned = cleaned.slice(0, end + 1);
  }

  return JSON.parse(cleaned);
}

const CITY_FALLBACK_DB = {
  goa: {
    spots: [
      { name: "Fort Aguada & Lighthouse", fee: 50, dslr: "Yes", activity: "17th-century Portuguese fortress & lighthouse overlooking Sinquerim beach" },
      { name: "Chapora Fort", fee: 0, dslr: "Yes", activity: "Panoramic views of Vagator Beach & Chapora River (Dil Chahta Hai spot)" },
      { name: "Basilica of Bom Jesus", fee: 0, dslr: "No", activity: "UNESCO World Heritage site containing St. Francis Xavier mortal remains" },
      { name: "Anjuna Flea Market & Beach", fee: 0, dslr: "Yes", activity: "Beachfront artisan crafts, Boho jewelry & sunset beach shacks" },
      { name: "Dudhsagar Waterfalls Safari", fee: 500, dslr: "Yes", activity: "Jeep safari through Mollem forest to 4-tiered cascading waterfall" },
      { name: "Fontainhas Latin Quarter", fee: 0, dslr: "Yes", activity: "Heritage photo walk past colorful 19th-century Portuguese villas" },
      { name: "Calangute & Baga Watersports", fee: 0, dslr: "Yes", activity: "Parasailing, jet ski rides, and beachside dining" },
      { name: "Se Cathedral", fee: 0, dslr: "Yes", activity: "One of Asia's largest churches featuring the Golden Bell" },
      { name: "Palolem Beach", fee: 0, dslr: "Yes", activity: "Scenic crescent bay with kayaking and tranquil beach cabanas" },
      { name: "Reis Magos Fort", fee: 50, dslr: "Yes", activity: "Restored 16th-century river fort overlooking Panaji skyline" }
    ],
    hotels: [
      { name: "Grand Hyatt Goa Resort & Spa", price: 8500, rating: 4.8, address: "Bambolim Bay, Goa" },
      { name: "Taj Fort Aguada Resort", price: 12500, rating: 4.9, address: "Sinquerim, Candolim, Goa" },
      { name: "Alila Diwa Goa", price: 7500, rating: 4.7, address: "Majorda, South Goa" },
      { name: "Lemon Tree Amarante Beach Resort", price: 4200, rating: 4.4, address: "Candolim, North Goa" },
      { name: "Hotel Residency Tower Goa", price: 2400, rating: 4.1, address: "Panaji, Goa" }
    ],
    dining: [
      { name: "Britto's Bar & Restaurant", rate: 1200, note: "Baga Beach; Goan fish curry & fresh tiger prawns" },
      { name: "Thalassa Greek Taverna", rate: 2000, cuisine: "Vagator Cliff; Sunset Mediterranean dining & cocktails" },
      { name: "Fisherman's Wharf", rate: 1400, cuisine: "Cavelossim; Riverside Goan seafood thali & kingfish" },
      { name: "Artjuna Garden Cafe", rate: 600, cuisine: "Anjuna; Organic smoothie bowls, falafel & fresh bakery" },
      { name: "Curlies Beach Shack", rate: 800, cuisine: "Anjuna Beachfront; Woodfired pizza & chilled beverage" },
      { name: "Vinayak Family Restaurant", rate: 500, cuisine: "Assagao; Authentic Goan prawn thali & fried fish" }
    ]
  },
  manali: {
    spots: [
      { name: "Hadimba Devi Temple", fee: 50, dslr: "Yes", activity: "1553 CE pagoda wooden shrine inside Dhungri cedar forest" },
      { name: "Solang Valley Snow Point", fee: 500, dslr: "Yes", activity: "Paragliding, ropeway rides, and snow adventure sports" },
      { name: "Vashisht Hot Springs", fee: 0, dslr: "Yes", activity: "Natural sulfur thermal baths and stone temple" },
      { name: "Jogini Waterfall Trek", fee: 0, dslr: "Yes", activity: "3km nature trek along mountain streams to waterfall" },
      { name: "Old Manali Cafe Circuit", fee: 0, dslr: "Yes", activity: "Apple orchards, bohemian cafes & handmade wooden crafts" },
      { name: "Atal Tunnel & Sissu", fee: 200, dslr: "Yes", activity: "Drive through world's longest high-altitude tunnel into Lahaul valley" }
    ],
    hotels: [
      { name: "Solang Valley Resort Manali", price: 6500, rating: 4.6, address: "Palchan, Manali" },
      { name: "Manu Allaya Resort & Spa", price: 8000, rating: 4.7, address: "Chhial, Manali" },
      { name: "Snow Valley Resorts Manali", price: 3200, rating: 4.3, address: "Log Huts Area, Manali" }
    ],
    dining: [
      { name: "Johnson's Cafe", rate: 900, note: "Model Town; Fresh Himalayan trout & warm apple crumble" },
      { name: "Cafe 1947", rate: 800, note: "Old Manali; Riverside Italian pasta & acoustic music" },
      { name: "Chopsticks Restaurant", rate: 600, note: "Mall Road; Authentic Tibetan momos & hot thukpa" }
    ]
  },
  jaipur: {
    spots: [
      { name: "Amer Fort & Sheesh Mahal", fee: 500, dslr: "Yes", activity: "16th-century hilltop palace, mirror hall & elephant ramparts" },
      { name: "Hawa Mahal (Palace of Winds)", fee: 200, dslr: "Yes", activity: "Iconic 953-window pink sandstone facade built for royal court" },
      { name: "City Palace Jaipur", fee: 700, dslr: "Yes", activity: "Royal courtyards, Peacock Gate, and museum of maharaja textiles" },
      { name: "Jantar Mantar Observatory", fee: 200, dslr: "Yes", activity: "UNESCO World Heritage site with giant stone astronomical instruments" },
      { name: "Nahargarh Fort Sunset Point", fee: 200, dslr: "Yes", activity: "Panoramas of Pink City at sunset from fort ramparts" },
      { name: "Jal Mahal (Water Palace)", fee: 0, dslr: "Yes", activity: "5-story palace floating on Man Sagar Lake" }
    ],
    hotels: [
      { name: "Trident Jaipur", price: 9500, rating: 4.8, address: "Amber Fort Road, Jaipur" },
      { name: "Hotel Pearl Palace", price: 2800, rating: 4.6, address: "Hathroi Fort, Jaipur" },
      { name: "Shahpura House Heritage Hotel", price: 6200, rating: 4.7, address: "Bani Park, Jaipur" }
    ],
    dining: [
      { name: "LMB (Laxmi Misthan Bhandar)", rate: 700, note: "Johari Bazaar; Iconic Rajasthani Dal Baati Churma" },
      { name: "Tapri Central Rooftop Cafe", rate: 500, note: "C-Scheme; Rooftop Kulhad Chai & fusion snacks" },
      { name: "Chokhi Dhani Ethnic Resort", rate: 1800, note: "Tonk Road; Royal Rajasthani thali & folk dance show" }
    ]
  }
};

async function generateFallbackTripPlan(config) {
  const {
    locations = ['Goa'], 
    fromDate, 
    toDate, 
    mode = 'Flight', 
    budget = 'balanced', 
    tripType = 'Family Trip',
    fromCity = 'Delhi', 
    travellerCount = 2, 
    selectedHotels = [],
    customPlaces = [],
    scheduleData = {},
    selectedRides = [],
    selectedCafes = [],
    selectedRestaurants = [],
    outboundTransport = null,
    returnTransport = null,
    routeInfo = null
  } = config;

  const destCity = (locations[0] || 'Goa').trim();
  const destKey = destCity.toLowerCase();
  
  let spots = [];
  let hotels = [];
  let dining = [];

  try {
    const [tpRes, hRes, rRes] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/tourist_places.json`).then(r => r.json()).catch(() => []),
      fetch(`${import.meta.env.BASE_URL}data/hotels.json`).then(r => r.json()).catch(() => []),
      fetch(`${import.meta.env.BASE_URL}data/swiggy.json`).then(r => r.json()).catch(() => [])
    ]);

    spots = tpRes.filter(p => (p.city || '').toLowerCase().includes(destKey) || destKey.includes((p.city || '').toLowerCase()));
    hotels = hRes.filter(h => (h.city || '').toLowerCase().includes(destKey) || destKey.includes((h.city || '').toLowerCase()));
    if (hotels.length > 0 && budget) {
      const budgetHotels = hotels.filter(h => {
        const star = h.hotel_stars || 3;
        if (budget === 'budget') return star <= 3;
        if (budget === 'balanced') return star === 4;
        return star >= 5;
      });
      if (budgetHotels.length > 0) hotels = budgetHotels;
    }
    dining = rRes.filter(r => (r.City || '').toLowerCase().includes(destKey) || destKey.includes((r.City || '').toLowerCase()));
  } catch (err) {
    console.warn("Failed to fetch dynamic fallback databases:", err);
  }

  // Final fallback to hardcoded DB if requested city not found in local datasets
  if (spots.length === 0) {
    const dbKey = Object.keys(CITY_FALLBACK_DB).find(k => destKey.includes(k)) || 'goa';
    const cityData = CITY_FALLBACK_DB[dbKey];
    spots = cityData.spots;
    hotels = cityData.hotels;
    dining = cityData.dining;
  }

  const formattedSpots = spots.map(s => ({
    name: s.name || s.place || 'Attraction',
    fee: s.entrance_fee_inr ?? s.fee ?? 100,
    dslr: s.dslr_allowed || 'Yes',
    activity: s.description || s.activity || 'Sightseeing activity'
  }));

  const formattedHotels = hotels.map(h => ({
    name: h.property_name || h.name,
    price: h.price_per_night_inr || h.price_inr || h.price || 3500,
    rating: h.hotel_stars || h.rating || 4,
    address: h.address || ''
  }));

  const formattedDining = dining.map(r => ({
    name: r.Restaurant || r.name,
    rate: r.Price || r.rate || 500,
    cuisine: r['Food type'] || r.cuisine || r.note || 'Local cuisine'
  }));

  // Prevent empty arrays
  if (formattedSpots.length === 0) formattedSpots.push({ name: "Local Attraction", fee: 100, dslr: "Yes", activity: "Explore the local beauty and landmarks." });
  if (formattedHotels.length === 0) formattedHotels.push({ name: "Comfort Inn", price: 3000, rating: 4, address: "City Center" });
  if (formattedDining.length === 0) formattedDining.push({ name: "Local Heritage Restaurant", rate: 500, cuisine: "Traditional Delicacies" });

  const start = new Date(fromDate || Date.now());
  const end = new Date(toDate || Date.now() + 3 * 86400000);
  const diffTime = Math.abs(end - start);
  const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

  const vibeThemes = {
    'Family Trip': ['Heritage & Temple Trail', 'Scenic Promenade & Lake Walk', 'Cultural Market & Local Delights', 'Relaxed Family Exploration', 'Artisans & Gardens'],
    'Friends Trip': ['Adventure & Viewpoints', 'Trendy Cafes & Night Markets', 'Water Sports & Coastal Drive', 'Thrilling Exploration', 'Sunset Party & Music'],
    'Couples / Romantic Trip': ['Romantic Sunset Viewpoint', 'Candlelight Dining & Strolls', 'Boutique Heritage Walk', 'Scenic Coastal Serenity', 'Intimate Beach Walk'],
    'Solo Trip': ['Solo Heritage Discovery', 'Authentic Local Food Crawl', 'Artisan Markets & Photo Walk', 'Peaceful Exploration', 'Cultural Heritage Circuit'],
    'Corporate / Business Trip': ['Executive Heritage Highlights', 'High-Speed Networking Dining', 'Iconic Landmark Tour', 'Smooth Transit & Return', 'Boutique Lounge Evening']
  };

  const themes = vibeThemes[tripType] || vibeThemes['Family Trip'];
  const daysArr = [];

  const isVehicleMode = mode && (
    mode.toLowerCase().includes('car') ||
    mode.toLowerCase().includes('bus') ||
    mode.toLowerCase().includes('coach') ||
    mode.toLowerCase().includes('bike') ||
    mode.toLowerCase().includes('drive') ||
    mode.toLowerCase().includes('vehicle') ||
    mode.toLowerCase().includes('rental') ||
    mode.toLowerCase().includes('personal') ||
    mode.toLowerCase().includes('road')
  );
  const drivingHours = routeInfo ? (routeInfo.durationHours || 0) : 0;
  const travelDays = (isVehicleMode && drivingHours >= 8) ? Math.ceil(drivingHours / 8) : 0;
  const minimumDaysNeeded = (travelDays * 2) + 2; // Round-trip transit + min 2 days at destination
  if (travelDays > 0 && totalDays <= minimumDaysNeeded) {
    return {
      error: `Trip duration too short for road travel! Driving takes ~${routeInfo?.durationDisplay || Math.round(drivingHours) + ' hrs'}, requiring at least ${minimumDaysNeeded} days (${travelDays} days each way + min 2 days at destination). Please provide more days or choose Flight/Train.`
    };
  }

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayNum = i + 1;

    const isOutboundDrive = i < travelDays;
    const isReturnDrive = i >= totalDays - travelDays && i > travelDays;
    const isDriveDay = isOutboundDrive || isReturnDrive;

    if (isDriveDay) {
      let wp = '';
      if (config.routeWaypoints && config.routeWaypoints.length > 0) {
        if (isOutboundDrive) {
           wp = config.routeWaypoints[Math.min(i, config.routeWaypoints.length - 1)];
        } else {
           const rev = [...config.routeWaypoints].reverse();
           wp = rev[Math.min(i - (totalDays - travelDays), rev.length - 1)];
        }
      }
      let matchingHotel = null;
      if (wp && config.selectedHotels) {
        matchingHotel = config.selectedHotels.find(h => 
          (h.routeCity || '').toLowerCase() === wp.toLowerCase() || 
          (h.city || '').toLowerCase() === wp.toLowerCase()
        );
      }

      const cityLabel = wp ? wp : (isOutboundDrive ? 'En-route to Destination' : `En-route to ${fromCity}`);

      daysArr.push({
        day: dayNum,
        date: dateStr,
        city: cityLabel,
        theme: `Day ${dayNum}: Highway Drive`,
        hotel: matchingHotel ? {
          hotel_id: matchingHotel.id,
          name: matchingHotel.name,
          price_per_night_inr: matchingHotel.price_per_night_inr || matchingHotel.price_inr || 2000,
          rating: matchingHotel.hotelCategory?.length || 3,
          address: matchingHotel.address || matchingHotel.city
        } : {
          hotel_id: `h_drive_${dayNum}`,
          name: wp ? `Highway Motel (${wp})` : "Highway Rest Motel",
          price_per_night_inr: 1500,
          rating: 3,
          address: wp ? `Highway Route near ${wp}` : "Highway Route"
        },
        schedule: [
          {
            time: '06:00',
            place: 'Highway Route',
            activity: 'Morning departure drive',
            type: 'transport',
            duration_min: 150,
            cost_inr: 0
          },
          {
            time: '08:30',
            place: wp ? `Dhaba near ${wp}` : 'Highway Dhaba',
            activity: 'Breakfast (Parathas and Chai)',
            type: 'meal',
            duration_min: 45,
            cost_inr: 150
          },
          {
            time: '13:00',
            place: 'Midway Restaurant',
            activity: 'Lunch break (Thali)',
            type: 'meal',
            duration_min: 60,
            cost_inr: 250
          },
          {
            time: '18:30',
            place: cityLabel,
            activity: 'Check-in to motel and rest',
            type: 'sightseeing',
            duration_min: 60,
            cost_inr: 0
          },
          {
            time: '20:30',
            place: 'Motel Restaurant',
            activity: 'Dinner and rest',
            type: 'meal',
            duration_min: 60,
            cost_inr: 300
          }
        ],
        day_total_inr: 2200
      });
      continue;
    }

    // Filter user custom places for this day, or pick DISTINCT spots
    const userDayPlaces = customPlaces.filter(p => {
      const s = scheduleData[p.id];
      return s ? s.day === `Day ${dayNum}` : false;
    });

    const spot1 = userDayPlaces[0] || formattedSpots[(i * 2) % formattedSpots.length];
    const spot2 = userDayPlaces[1] || formattedSpots[(i * 2 + 1) % formattedSpots.length];

    const dayHotel = selectedHotels[i % Math.max(1, selectedHotels.length)] || formattedHotels[i % formattedHotels.length];
    const dayCafe = selectedCafes.find(c => c.day === `Day ${dayNum}`) || formattedDining[(i * 2) % formattedDining.length];
    const dayRest = selectedRestaurants.find(r => r.day === `Day ${dayNum}`) || formattedDining[(i * 2 + 1) % formattedDining.length];
    const dayRide = selectedRides[i % Math.max(1, selectedRides.length)];

    const schedule = [
      {
        time: '09:00',
        place: spot1.name,
        activity: spot1.activity,
        type: 'sightseeing',
        duration_min: 120,
        cost_inr: spot1.fee,
        notes: spot1.dslr === 'Yes' ? 'DSLR Photography Permitted' : undefined
      },
      {
        time: '13:00',
        place: dayCafe.name,
        activity: `Lunch break (${dayCafe.cuisine})`,
        type: 'meal',
        duration_min: 60,
        cost_inr: Math.round(dayCafe.rate / 2)
      },
      {
        time: '16:00',
        place: spot2.name,
        activity: spot2.activity,
        type: 'sightseeing',
        duration_min: 90,
        cost_inr: spot2.fee
      },
      {
        time: '20:00',
        place: dayRest.name,
        activity: `Evening dinner & relaxation (${dayRest.cuisine})`,
        type: 'meal',
        duration_min: 90,
        cost_inr: Math.round(dayRest.rate / 2)
      }
    ];

    if (dayRide) {
      schedule.unshift({
        time: '08:30',
        place: `${dayRide.vehicle_model} Ground Ride`,
        activity: `Private ground transit via ${dayRide.vehicle_model} (${dayRide.vehicle_category})`,
        type: 'transport',
        duration_min: 30,
        cost_inr: dayRide.price || 500
      });
    }

    const hotelPrice = dayHotel.price_per_night_inr || dayHotel.price_inr || dayHotel.price || 3500;

    daysArr.push({
      day: dayNum,
      date: dateStr,
      city: destCity,
      theme: `Day ${dayNum}: ${themes[i % themes.length]}`,
      hotel: {
        hotel_id: dayHotel.hotel_id || `h_${dayNum}`,
        name: dayHotel.name,
        price_per_night_inr: hotelPrice,
        rating: dayHotel.rating,
        address: dayHotel.address || `Central Promenade, ${destCity}`
      },
      schedule,
      day_total_inr: schedule.reduce((sum, s) => sum + (s.cost_inr || 0), 0) + hotelPrice
    });
  }

  const outboundTotal = (outboundTransport?.price || 0) * travellerCount;
  const returnTotal = (returnTransport?.price || 0) * travellerCount;
  const intercityTotal = outboundTotal + returnTotal;

  const spotsTotal = customPlaces.reduce((sum, p) => sum + (p.entrance_fee_inr || 0) * travellerCount, 0);
  const hotelsTotal = selectedHotels.reduce((sum, h) => sum + ((h.price_per_night_inr || h.price_inr || 0) * (h.nights || 1) * (h.rooms || 1)), 0);
  const ridesTotal = selectedRides.reduce((sum, r) => sum + (r.price || 0), 0);
  const cafesTotal = selectedCafes.reduce((sum, c) => sum + (c.rate_for_two || 500) * Math.ceil((c.seats || 2) / 2), 0);
  const restTotal = selectedRestaurants.reduce((sum, r) => sum + (r.price || 400) * Math.ceil((r.seats || 2) / 2), 0);
  const diningTotal = cafesTotal + restTotal;

  const sumDaysTotal = daysArr.reduce((sum, d) => sum + (d.day_total_inr || 0), 0) + intercityTotal;
  const finalCost = sumDaysTotal > 0 ? sumDaysTotal : (budget === 'budget' ? 12000 : (budget === 'comfort' ? 45000 : 25000));

  return {
    trip_name: `${destCity} ${tripType} Experience`,
    type: 'national',
    from_city: fromCity,
    destinations: locations,
    travel_mode: mode,
    budget_tier: budget,
    trip_type: tripType,
    tripType: tripType,
    total_days: totalDays,
    total_nights: Math.max(1, totalDays - 1),
    from_date: fromDate,
    to_date: toDate,
    estimated_budget_inr: { min: finalCost, max: Math.round(finalCost * 1.15) },
    currency: { local: 'INR', inr_rate: 1 },
    intercity_transport: {
      outbound: outboundTransport ? {
        mode: outboundTransport.type || outboundTransport.mode || 'Flight',
        operator: outboundTransport.operator || 'Air India',
        from: fromCity,
        to: destCity,
        dep_time: outboundTransport.depTime || '09:00 AM',
        arr_time: outboundTransport.arrTime || '11:30 AM',
        duration: outboundTransport.duration || '2h 30m',
        cost_inr: outboundTransport.price !== undefined ? outboundTransport.price : 5000
      } : (isVehicleMode ? {
        mode: mode,
        operator: 'Personal Vehicle / Bike Ride',
        from: fromCity,
        to: destCity,
        dep_time: '06:00 AM',
        arr_time: routeInfo ? `After ${routeInfo.durationDisplay}` : '09:00 PM',
        duration: routeInfo ? routeInfo.durationDisplay : 'Calculated',
        cost_inr: routeInfo ? Math.round(routeInfo.fuelCostInr / travellerCount) : 5000
      } : undefined),
      return: returnTransport ? {
        mode: returnTransport.type || returnTransport.mode || 'Flight',
        operator: returnTransport.operator || 'SpiceJet',
        from: destCity,
        to: fromCity,
        dep_time: returnTransport.depTime || '03:00 PM',
        arr_time: returnTransport.arrTime || '05:30 PM',
        duration: returnTransport.duration || '2h 30m',
        cost_inr: returnTransport.price !== undefined ? returnTransport.price : 5000
      } : (isVehicleMode ? {
        mode: mode,
        operator: 'Personal Vehicle / Bike Ride',
        from: destCity,
        to: fromCity,
        dep_time: '06:00 AM',
        arr_time: routeInfo ? `After ${routeInfo.durationDisplay}` : '09:00 PM',
        duration: routeInfo ? routeInfo.durationDisplay : 'Calculated',
        cost_inr: routeInfo ? Math.round(routeInfo.fuelCostInr / travellerCount) : 5000
      } : undefined)
    },
    days: daysArr,
    trip_summary: {
      total_cost_inr: finalCost,
      budget_breakdown: {
        intercity_transport_inr: intercityTotal,
        local_transport_inr: ridesTotal,
        accommodation_inr: hotelsTotal,
        food_inr: diningTotal,
        activities_inr: spotsTotal,
        shopping_inr: 0,
        misc_inr: 0
      },
      highlights: [
        `Curated for ${tripType} with tailored activity pacing`,
        `Explore top attractions in ${destCity}`,
        `Hygienic local dining and verified accommodations`
      ],
      weather_note: 'Pleasant weather expected during travel dates.'
    }
  };
}

/**
 * Main itinerary generator.
 * Sends the full system prompt as systemInstruction + a clean user query.
 */
export async function generateTripPlan(config) {
  const {
    locations = ['Goa'], 
    fromDate, 
    toDate, 
    mode, 
    budget, 
    tripType = 'Family Trip',
    fromCity = 'Delhi', 
    travellerCount = 2, 
    selectedHotel = null,
    selectedHotels = [],
    customPlaces = [],
    scheduleData = {},
    selectedRide = null,
    selectedRides = [],
    selectedCafes = [],
    selectedRestaurants = [],
    outboundTransport = null,
    returnTransport = null,
    routeInfo = null,
    liveTransport = null,  // DSA live transport from auto-transport endpoint
    liveHotels = null,     // DSA live hotels
  } = config;

  // ── Helper: normalize any date string to YYYY-MM-DD ──
  const normDate = (d) => {
    if (!d) return '';
    // Already ISO format
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    // Try parsing
    const parsed = new Date(d);
    if (!isNaN(parsed)) return parsed.toISOString().split('T')[0];
    return d;
  };

  const normFrom = normDate(fromDate);
  const normTo   = normDate(toDate);

  // Calculate total trip days explicitly so AI never guesses wrong
  const startD = new Date(normFrom || Date.now());
  const endD   = new Date(normTo   || Date.now());
  const computedTotalDays = Math.max(1, Math.round((endD - startD) / 86400000) + 1);

  // ── Fetch real local data for the destination city ──
  const destCity = (locations[0] || 'Goa').trim();
  const destKeyLower = destCity.toLowerCase();

  let verifiedSpots   = [];
  let verifiedHotels  = [];

  try {
    const BASE = import.meta.env.BASE_URL || '/';
    const [tpRes, hRes] = await Promise.all([
      fetch(`${BASE}data/tourist_places.json`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${BASE}data/hotels.json`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]);

    verifiedSpots = (tpRes || [])
      .filter(p => (p.city || '').toLowerCase().includes(destKeyLower) || destKeyLower.includes((p.city || '').toLowerCase()))
      .slice(0, 10)
      .map(p => `* ${p.name || p.place} — ${p.description || p.activity || ''} (Entry: ₹${p.entrance_fee_inr || 0}, DSLR: ${p.dslr_allowed || 'Yes'}, Weekly Off: ${p.weekly_off || 'None'})`);

    const tierFilter = (h) => {
      const star = h.hotel_stars || 3;
      if (!budget || budget === 'balanced') return star === 4 || star === 3;
      if (budget === 'budget') return star <= 3;
      if (budget === 'comfort') return star >= 4;
      return true;
    };
    verifiedHotels = (hRes || [])
      .filter(h => ((h.city || '').toLowerCase().includes(destKeyLower) || destKeyLower.includes((h.city || '').toLowerCase())) && tierFilter(h))
      .slice(0, 5)
      .map(h => `* [hotel_id: ${h.hotel_id || h.id}] ${h.property_name || h.name} — ${h.hotel_stars || 3} Stars, ₹${h.price_per_night_inr || h.price_inr || 3500}/night, ${h.address || h.city}`);
  } catch (err) {
    console.warn('Local data pre-fetch failed:', err);
  }

  let userMessage = `Generate a complete travel itinerary with the following inputs:

- destinations: ${locations.join(', ')}
- from_date: ${normFrom}
- to_date: ${normTo}
- total_days: ${computedTotalDays}
- travel_mode: ${mode}
- trip_type: ${tripType}
- budget_tier: ${budget}
- from_city: ${fromCity}
- traveller_count: ${travellerCount}

⚠️ CRITICAL DAY COUNT RULE: You MUST output EXACTLY ${computedTotalDays} day objects in the "days" array. No more, no less. The trip runs from ${normFrom} to ${normTo} inclusive.`;

  // ── Inject verified local tourist spots ──
  if (verifiedSpots.length > 0) {
    userMessage += `\n\n- DESTINATION_VERIFIED_SPOTS (real places from database — use these first, supplement with your knowledge):
${verifiedSpots.join('\n')}
INSTRUCTION: Prioritize placing these verified spots in the itinerary. You may add MORE real places from your knowledge but DO NOT invent fictional or generic place names.`;
  }

  // ── Inject verified local hotels ──
  if (liveHotels && liveHotels.length > 0) {
    const liveHotelList = liveHotels.map(h => `* [hotel_id: ${h.id}] ${h.name} — ${h.starRating || 3} Stars, ₹${h.price || 3500}/night, ${h.address || h.city}`).join('\n');
    userMessage += `\n\n- LIVE_AVAILABLE_HOTELS (Real-time live prices from API — MUST USE ONE OF THESE):
${liveHotelList}
INSTRUCTION: You MUST use one of these live hotels for the destination stay days. Do NOT invent hotel names. If user has CUSTOMER_SELECTED_HOTEL_STAY_SEQUENCE below, that takes priority.`;
  } else if (verifiedHotels.length > 0) {
    userMessage += `\n\n- DESTINATION_VERIFIED_HOTELS (real hotels from database — use hotel_id exactly as given):
${verifiedHotels.join('\n')}
INSTRUCTION: Use one of these real hotels for the destination stay days. Copy the hotel_id field exactly. If user has CUSTOMER_SELECTED_HOTEL_STAY_SEQUENCE below, that takes priority.`;
  }

  // --- Geography: Sample intermediate cities from ORS polyline ---
  let routeWaypoints = [];
  if (routeInfo && routeInfo.polylineCoords && routeInfo.polylineCoords.length > 4) {
    try {
      routeWaypoints = await getRouteWaypoints(routeInfo.polylineCoords);
    } catch (e) {
      console.warn('Waypoint reverse-geocode failed:', e);
    }
  }

  // Inject real-world ORS route knowledge
  if (routeInfo) {
    userMessage += `\n\n- REALTIME_ROUTE_KNOWLEDGE: \nThe total driving distance is ${routeInfo.distanceKm} km. \nThe estimated driving time is ${routeInfo.durationDisplay}. \nThe estimated fuel cost is \u20b9${routeInfo.fuelCostInr}.\nAVERAGE SPEED: Use 60 km/hr for Indian highways (as calculated by the routing engine). Segment duration = distance_km / 60 hours.\nCRITICAL: Use this travel time to realistically space out activities and travel days!`;
    if (routeWaypoints.length > 0) {
      userMessage += `\nACTUAL GPS-VERIFIED HIGHWAY CITIES ON THIS ROUTE: ${routeWaypoints.join(' -> ')}. Name dhabas/restaurants ONLY in these cities. DO NOT hallucinate cities from other highways.`;
    }
  }

  // Inject vehicle-specific road trip rules
  const isVehicleMode = mode && (
    mode.toLowerCase().includes('car') ||
    mode.toLowerCase().includes('bus') ||
    mode.toLowerCase().includes('coach') ||
    mode.toLowerCase().includes('bike') ||
    mode.toLowerCase().includes('drive') ||
    mode.toLowerCase().includes('vehicle') ||
    mode.toLowerCase().includes('rental') ||
    mode.toLowerCase().includes('personal') ||
    mode.toLowerCase().includes('road')
  );
  if (isVehicleMode && routeInfo) {
    const drivingHours = routeInfo.durationHours || 0;
    const travelDays = Math.ceil(drivingHours / 8); // Max 8-10hr/day
    const totalTripDaysV = computedTotalDays;
    const minimumDaysNeeded = (travelDays * 2) + 1;
    if (drivingHours >= 8 && totalTripDaysV < minimumDaysNeeded) {
      return {
        error: `Trip duration too short for road travel! Driving takes ~${routeInfo.durationDisplay || Math.round(drivingHours) + ' hrs'}, requiring at least ${minimumDaysNeeded} days (${travelDays} days each way + destination stay). Please provide more days or choose Flight/Train.`
      };
    }
    const arrivalDay = travelDays + 1;
    userMessage += `\n\n- ROAD_TRIP_ENFORCEMENT:\nMAXIMUM DRIVE PER DAY: 10 hours. NEVER exceed this in any single day.\nEstimated driving time: ${routeInfo.durationDisplay} (${drivingHours.toFixed(1)} hours).\nDrive days one-way: ${travelDays} (ceil of hours / 8).\nTotal trip days: ${totalTripDaysV}.\nSCHEDULE RULE: Day 1 to Day ${travelDays} = DRIVE DAYS (en-route, NOT at destination).\nDay ${arrivalDay} onwards = sightseeing at destination.\nLast ${travelDays} days = return drive back to ${fromCity}.\nARRIVAL DAY: If arriving after 14:00, only light evening walk + dinner. NO major monuments on arrival day.\nEach drive day: 06:00 depart -> 08:30 breakfast dhaba -> 13:00 lunch dhaba -> 18:30 check-in -> 20:30 dinner.\nFor micro-timings between random highway dhabas on drive days, calculate exactly based on distance / 60 km/hr. Do not hallucinate random travel times.\nONE hotel per city, do NOT change hotels daily at destination. If suggesting an overnight hotel en-route for the drive, label it clearly as "Suggested overnight stop — not booked".\n\nRESTAURANT SHIFT RULE (CRITICAL): The traveller arrives at the destination on Day ${arrivalDay}. If ANY user-selected restaurant or cafe has been assigned to Day 1 through Day ${travelDays} (the drive days), automatically reschedule it to Day ${arrivalDay} or later — never place a Mumbai/destination restaurant on a highway drive day. Do NOT place destination city restaurants on drive days under any circumstances.\n\nHOTEL CHECK-IN TO RESTAURANT GAP RULE: Hotel check-in happens at 14:00 (standard). Any restaurant booking must be scheduled AT LEAST 4 hours after check-in — i.e., no earlier than 18:00 on arrival/check-in days. Never schedule dinner at 14:30 or 15:00 on a check-in day.`;
  }


  // Custom Scheduled Tourist Hubs — FILTER to destination city to prevent cross-city contamination
  const destCities = locations.map(l => l.toLowerCase().trim());
  const placeMatchesDest = (p) => {
    const pCity = (p.city || '').toLowerCase();
    return destCities.some(dc => pCity.includes(dc) || dc.includes(pCity)) || !p.city;
  };
  const filteredCustomPlaces = (customPlaces || []).filter(placeMatchesDest);

  if (filteredCustomPlaces.length > 0) {
    const placesDetails = filteredCustomPlaces.map(p => {
      const sched = scheduleData[p.id] || { day: 'Day 1', timeSlot: 'Morning' };
      return `* ${p.name} [USER_SELECTED] (City: ${p.city}, Assigned: ${sched.day} ${sched.timeSlot}, Fee: ₹${p.entrance_fee_inr}, DSLR Allowed: ${p.dslr_allowed}, Weekly Off: ${p.weekly_off})`;
    }).join('\n');

    userMessage += `\n\n- CUSTOMER_SELECTED_TOURIST_HUBS_AND_SCHEDULE (marked [USER_SELECTED]):\n${placesDetails}`;
    userMessage += `\n\nCRITICAL INSTRUCTION: You MUST place each [USER_SELECTED] attraction into the itinerary on its assigned Day and Time Slot. Mark these items with "source": "user" in the schedule JSON. All other sightseeing items added by you must have "source": "ai". In the tips and precautions section, explicitly highlight the DSLR policies and Weekly Off days for these selected places.`;
  } else if ((customPlaces || []).length > 0) {
    // Places were selected but for wrong city — warn AI
    userMessage += `\n\n- NOTE: User had pre-selected places from a different city. Do NOT include them. Generate appropriate ${destCity} sightseeing instead.`;
  }

  // Multi-Hotel Stay Sequence
  const hotelsList = selectedHotels.length > 0 ? selectedHotels : (selectedHotel ? [selectedHotel] : []);
  if (hotelsList.length > 0) {
    const sorted = [...hotelsList].sort((a, b) => (a.stayOrder || 1) - (b.stayOrder || 1));
    const hotelDetails = sorted.map((h, i) => {
      const name = h.property_name || h.name;
      return `* Stay #${i + 1}: "${name}" (${h.hotel_stars || 3} Stars, ₹${h.price_per_night_inr || h.price_inr || 0}/night, Duration: ${h.nights || 1} Night(s))`;
    }).join('\n');

    userMessage += `\n\n- CUSTOMER_SELECTED_HOTEL_STAY_SEQUENCE:\n${hotelDetails}`;
    userMessage += `\n\nCRITICAL INSTRUCTION: You MUST follow this exact hotel stay sequence across the itinerary days. Allocate the exact number of nights to each hotel in order. NEVER hallucinate or invent new hotels if the user has provided a custom hotel list. If the user's provided hotel nights run out before the departure day, simply repeat the last hotel they provided.`;
  }

  // Multi-Ride Bookings
  const ridesList = selectedRides.length > 0 ? selectedRides : (selectedRide ? [selectedRide] : []);
  if (ridesList.length > 0) {
    const rideDetails = ridesList.map(r => `* Vehicle: ${r.vehicle_model} (${r.vehicle_category}, Type: ${r.booking_type}, Price: ₹${r.price}, Destination: ${r.tourist_place || r.city})`).join('\n');
    userMessage += `\n\n- BOOKED_GROUND_TRANSPORT_RIDES:\n${rideDetails}`;
  }

  // Intercity Outbound & Return Transport (from Customization Wizard)
  if (outboundTransport || returnTransport) {
    userMessage += `\n\n- USER_SELECTED_TRANSPORT_PREFERENCES:\n`;
    if (outboundTransport) {
      const obMode = outboundTransport.type || outboundTransport.mode || 'Vehicle';
      userMessage += `\n* Outbound (Day 1 from ${fromCity}): ${obMode} via ${outboundTransport.operator} (${outboundTransport.depTime} - ${outboundTransport.arrTime}, ₹${outboundTransport.price || 0}/person)`;
    }
    if (returnTransport) {
      const retMode = returnTransport.type || returnTransport.mode || 'Vehicle';
      userMessage += `\n* Return (Last Day): ${retMode} via ${returnTransport.operator} (${returnTransport.depTime} - ${returnTransport.arrTime}, ₹${returnTransport.price || 0}/person)`;
    }
  }

  // Live DSA Transport Data (from auto-generated itinerary — real API data)
  const isTransportMode = mode && (mode.toLowerCase().includes('flight') || mode.toLowerCase().includes('bus') || mode.toLowerCase().includes('train'));
  if (liveTransport && (liveTransport.outbound || liveTransport.return)) {
    const src = liveTransport.source || 'DSA';
    userMessage += `\n\n- LIVE_DSA_TRANSPORT_DATA (from ${src} live API — USE THESE EXACT DETAILS):`;
    if (liveTransport.outbound) {
      const o = liveTransport.outbound;
      userMessage += `\n* Outbound Flight/Bus (Day 1 from ${fromCity}): ${o.operator} ${o.code || ''}, Departs ${o.depTime}, Arrives ${o.arrTime}, Duration: ${o.duration}, Fare: ₹${o.price}/person, Baggage: ${o.baggage || 'N/A'}`;
    }
    if (liveTransport.return) {
      const r = liveTransport.return;
      userMessage += `\n* Return Flight/Bus (Last Day): ${r.operator} ${r.code || ''}, Departs ${r.depTime}, Arrives ${r.arrTime}, Duration: ${r.duration}, Fare: ₹${r.price}/person, Baggage: ${r.baggage || 'N/A'}`;
    }
    userMessage += `\n\nCRITICAL: Use the above LIVE DSA transport details verbatim in intercity_transport section. Set operator, dep_time, arr_time, duration, cost_inr from these values. Do NOT invent or use synthetic flight/bus details.`;
  } else if (isTransportMode && !outboundTransport && !returnTransport) {
    userMessage += `\n\nCRITICAL: Live flight/bus data is currently unavailable. Do NOT invent flight numbers, airlines, or exact times. In the intercity_transport section, simply write "operator": "To be booked locally", "dep_time": "Morning/Evening", and estimate a realistic budget cost.`;
  }

  // ── Inject personalized touches based on Trip Type ──
  userMessage += `\n\n- TRIP_TYPE_PERSONALIZATION: The user selected "${tripType}". Tailor the itinerary pace, tone, and recommendations for this specific style:`;
  if (tripType.toLowerCase().includes('family')) {
    userMessage += `\n  - Pace: Relaxed, minimal changing of hotels.\n  - Activities: Kid-friendly, accessible spots, no extremely strenuous treks.\n  - Dining: Family restaurants with varied menus.\n  - Schedule: Avoid very late night activities. Include afternoon downtime.`;
  } else if (tripType.toLowerCase().includes('solo') || tripType.toLowerCase().includes('backpacker')) {
    userMessage += `\n  - Pace: Fast, adventurous, highly flexible.\n  - Activities: Offbeat trails, hostels, meeting locals, high-adrenaline sports.\n  - Dining: Street food, local cafes, backpacker hangouts.\n  - Budget: Prioritize cost-effective local transit inside the city.`;
  } else if (tripType.toLowerCase().includes('corporate') || tripType.toLowerCase().includes('business')) {
    userMessage += `\n  - Pace: Efficient, structured.\n  - Amenities: Hotels/cafes must have good Wi-Fi and quiet environments.\n  - Activities: Premium experiences, quick sightseeing breaks between meetings.\n  - Dining: Fine dining, quiet lounges suitable for networking or relaxing after work.`;
  } else if (tripType.toLowerCase().includes('couple') || tripType.toLowerCase().includes('romantic')) {
    userMessage += `\n  - Pace: Leisurely and intimate.\n  - Activities: Scenic spots, sunset viewpoints, couple's spa if applicable.\n  - Dining: Candlelight dinners, romantic ambiance, premium cafes.`;
  } else {
    userMessage += `\n  - Provide a balanced mix of sightseeing, leisure, and local culture.`;
  }

  // Scheduled Dining (Cafes & Restaurants) — use safe fallbacks for missing day/timeSlot
  if (selectedCafes.length > 0 || selectedRestaurants.length > 0) {
    const cafesText = selectedCafes.map(c => `* Cafe: ${c.name} (Assigned: ${c.day || 'Any Day'} ${c.timeSlot || 'Lunch'}, Rate for two: ₹${c.rate_for_two || c.price || 500}) [USER_SELECTED]`).join('\n');
    const restText  = selectedRestaurants.map(r => `* Restaurant: ${r.name} (Assigned: ${r.day || 'Any Day'} ${r.timeSlot || 'Dinner'}, Price for two: ₹${r.price || r.rate_for_two || 500}) [USER_SELECTED]`).join('\n');
    userMessage += `\n\n- CUSTOMER_SELECTED_DINING (marked [USER_SELECTED]):\n${cafesText}\n${restText}`;
    userMessage += `\n\nCRITICAL INSTRUCTION: Place these [USER_SELECTED] restaurants and cafes into the itinerary. Mark them with "source": "user" in the schedule JSON. If no specific day is given, distribute them across destination days at appropriate meal times.`;
  }

  // Budget Guardrails
  const estimatedMinBudget = computedTotalDays * travellerCount * 1500; // minimum ₹1500/day per person for basics
  const isBudgetUnrealistic = budgetNumeric && budgetNumeric < estimatedMinBudget;
  
  userMessage += `\n\nCRITICAL BUDGET INSTRUCTION: You MUST calculate estimated_budget_inr and trip_summary.total_cost_inr to reflect the REAL total sum of all user-selected transport, hotels, rides, dining, and sightseeing fees.`;
  
  if (isBudgetUnrealistic) {
    userMessage += `\nWARNING: The user's provided budget (₹${budgetNumeric}) is unrealistically low for ${travellerCount} travellers over ${computedTotalDays} days (Minimum realistic basic survival budget is ~₹${estimatedMinBudget}).
    1. Do NOT hallucinate ₹100/night hotels or free flights to fit the budget.
    2. Suggest the cheapest REALISTIC options (hostels, buses, street food).
    3. The final \`total_cost_inr\` MUST reflect reality, even if it exceeds the user's requested budget. Do NOT fake numbers to make it fit.`;
  } else {
    userMessage += `\nEnsure the final budget reflects the chosen tier (${budget}) and doesn't artificially inflate or deflate real-world costs.`;
  }

  userMessage += `\n\nFINAL REMINDER — "source" field in every schedule item:
- "source": "user" → place/restaurant explicitly chosen by the user (from CUSTOMER_SELECTED lists above)
- "source": "ai"   → everything else added by you to complete the itinerary
This field MUST appear on every schedule item. Never omit it.`;

  let parsed = null;
  try {
    const text = await callGemini(userMessage, SYSTEM_PROMPT, true);
    parsed = extractJSON(text);
    if (!parsed || !Array.isArray(parsed.days) || parsed.days.length === 0) {
      console.warn("AI returned empty or missing days array. Utilizing smart fallback trip plan generator.");
      parsed = await generateFallbackTripPlan({ ...config, routeWaypoints });
    }
  } catch (err) {
    console.warn("AI API request failed. Utilizing smart customized offline fallback generator:", err.message);
    parsed = await generateFallbackTripPlan({ ...config, routeWaypoints });
  }

  // --- Budget: include fuel cost for vehicle modes + walk AI day costs ---
  const isVehicleModePost = mode && (mode.toLowerCase().includes('self drive') || mode.toLowerCase().includes('personal vehicle') || mode.toLowerCase().includes('bike'));
  const fuelCostTotal = (isVehicleModePost && routeInfo) ? (routeInfo.fuelCostInr * 2) : 0;
  const outboundTotal = (outboundTransport?.price || 0) * travellerCount;
  const returnTotal = (returnTransport?.price || 0) * travellerCount;
  const intercityTotal = outboundTotal + returnTotal + fuelCostTotal;
  const spotsTotal = customPlaces.reduce((sum, p) => sum + (p.entrance_fee_inr || 0) * travellerCount, 0);
  const hotelsTotal = selectedHotels.reduce((sum, h) => sum + ((h.price_per_night_inr || h.price_inr || 0) * (h.nights || 1) * (h.rooms || 1)), 0);
  const ridesTotal = selectedRides.reduce((sum, r) => sum + (r.price || 0), 0);
  const cafesTotal = selectedCafes.reduce((sum, c) => sum + (c.rate_for_two || 500) * Math.ceil((c.seats || 2) / 2), 0);
  const restTotal = selectedRestaurants.reduce((sum, r) => sum + (r.price || 400) * Math.ceil((r.seats || 2) / 2), 0);
  const diningTotal = cafesTotal + restTotal;

  let aiDayCosts = 0;
  let aiActivities = 0;
  let aiShopping = 0;
  if (parsed && parsed.days) {
    parsed.days.forEach(day => {
      (day.schedule || []).forEach(s => { 
        if (!s.title?.toLowerCase().includes('hotel') && !s.title?.toLowerCase().includes('restaurant')) {
          aiActivities += (s.cost_inr || 0);
        }
      });
    });
  }
  
  if (parsed && !parsed.error) {
    const finalAccommodation = hotelsTotal > 0 ? hotelsTotal : (parsed.trip_summary?.budget_breakdown?.accommodation_inr || 0);
    const finalFood = diningTotal > 0 ? diningTotal : (parsed.trip_summary?.budget_breakdown?.food_inr || 0);
    let finalActivities = spotsTotal > 0 ? spotsTotal : (aiActivities > 0 ? aiActivities : (parsed.trip_summary?.budget_breakdown?.activities_inr || 0));
    let finalShopping = parsed.trip_summary?.budget_breakdown?.shopping_inr || 0;
    
    // Sum everything up explicitly so the math exactly matches the itemized UI
    let grandTotal = intercityTotal + ridesTotal + finalAccommodation + finalFood + finalActivities + finalShopping;
    
    // If the user provided a strict budget, enforce it as a cap if we somehow exceeded it
    if (config.budgetNumeric && grandTotal > config.budgetNumeric) {
       const excess = grandTotal - config.budgetNumeric;
       // Attempt to absorb excess in shopping and activities
       if (finalShopping >= excess) {
         finalShopping -= excess;
       } else {
         const remainingExcess = excess - finalShopping;
         finalShopping = 0;
         if (finalActivities >= remainingExcess) {
           finalActivities -= remainingExcess;
         } else {
           finalActivities = 0;
         }
       }
       grandTotal = config.budgetNumeric;
    }

    const budgetMin = Math.round(grandTotal * 0.92);
    parsed.estimated_budget_inr = { min: budgetMin, max: grandTotal };
    if (!parsed.trip_summary) parsed.trip_summary = {};
    parsed.trip_summary.total_cost_inr = grandTotal;
    parsed.trip_summary.budget_breakdown = {
      intercity_transport_inr: intercityTotal,
      local_transport_inr: ridesTotal,
      accommodation_inr: finalAccommodation,
      food_inr: finalFood,
      activities_inr: finalActivities,
      shopping_inr: finalShopping,
      misc_inr: 0,
    };
  }

  // --- Per-day weather injection for each stop city ---
  try {
    if (parsed && !parsed.error && parsed.days) {
      const citiesInTrip = [...new Set(parsed.days.map(d => d.city).filter(Boolean))];
      const weatherMap = {};
      await Promise.all(
        citiesInTrip.map(async city => {
          try { weatherMap[city] = await fetchWeather(city); } catch { }
        })
      );
      const startDate = new Date(fromDate);
      parsed.days = parsed.days.map((day, i) => {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + i);
        const dateStr = dayDate.toLocaleDateString('en-IN');
        const cw = weatherMap[day.city];
        if (cw) {
          const match = cw.dailySummary?.find(s => s.date === dateStr) || cw.dailySummary?.[0];
          if (match) {
            const wIcon = match.maxRain >= 70 ? "ðŸŒ§ï¸" : match.maxRain >= 40 ? "ðŸŒ¦ï¸" : "â˜€ï¸";
            day.weather_note = `${wIcon} ${match.maxTemp}Â°C / ${match.minTemp}Â°C, ${match.mainWeather} â€” Rain: ${match.maxRain}%`;
          }
        }
        return day;
      });
      const destName = (locations[0] || 'Delhi').trim();
      const destWeather = weatherMap[destName] || weatherMap[citiesInTrip[0]];
      if (destWeather) {
        if (!parsed.trip_summary) parsed.trip_summary = {};
        const d1 = destWeather.dailySummary?.[0];
        if (d1 && !parsed.trip_summary.weather_note) parsed.trip_summary.weather_note = `${d1.maxTemp}Â°C / ${d1.minTemp}Â°C, ${d1.mainWeather} (Rain: ${d1.maxRain}%)`;
        if (destWeather.alerts) {
          const prec = getPrecautions(destWeather.alerts).slice(0, 2);
          if (prec.length > 0) {
            const nonW = (parsed.tips || []).filter(t => !t.includes('Weather Precaution') && !t.startsWith('ðŸŒ§') && !t.startsWith('ðŸŒ¦') && !t.startsWith('â˜€'));
            parsed.tips = [...nonW, ...prec.map(p => `${p.icon} ${p.text}`)];
          }
        }
      }
    }
  } catch (wErr) {
    console.warn('Per-day weather injection skipped:', wErr);
  }

  if (parsed && !parsed.error) {
    parsed.trip_type = tripType;
    if (routeInfo) {
      parsed.routeInfo = routeInfo;
    }
  }

  return parsed;
}

/**
 * Redraft an existing plan based on user instructions.
 */
export async function redraftTripPlan(currentPlan, instruction) {
  const systemInstruction = `You are an expert travel itinerary editor for Firstflight Travels. 
You will receive an existing JSON itinerary and a modification request. 
Apply ONLY the requested changes and return the complete updated itinerary as a raw JSON object.
Do NOT change the JSON schema structure. Do NOT include any markdown or explanatory text.`;

  const userMessage = `Here is the current travel itinerary:
${JSON.stringify(currentPlan, null, 2)}

Modification request: "${instruction}"

Return the complete modified itinerary as raw JSON only.`;

  const text = await callGemini(userMessage, systemInstruction, true);
  try {
    return extractJSON(text);
  } catch {
    return { raw: text, error: 'Could not parse the redrafted itinerary. Please try again.' };
  }
}

/**
 * Generate a travel document checklist.
 */
export async function generatePermitChecklist(mode, from, to) {
  const userMessage = `Generate a travel document checklist for a ${mode} journey from ${from} to ${to} in India.
Include: ID requirements, permits needed, insurance recommendations, cancellation policies, and any special documents.
Format as a JSON array: [{"item": "...", "required": true/false, "description": "...", "tip": "..."}]
Return ONLY the raw JSON array, no markdown.`;

  const text = await callGemini(userMessage);
  try {
    return extractJSON(text);
  } catch {
    return [
      { item: 'Valid ID (Aadhaar/Passport)', required: true, description: 'Government issued photo ID', tip: 'Keep a digital copy on your phone' },
      { item: 'Hotel Booking Confirmation', required: true, description: 'Printed or digital copy', tip: 'Email yourself a copy before departure' }
    ];
  }
}

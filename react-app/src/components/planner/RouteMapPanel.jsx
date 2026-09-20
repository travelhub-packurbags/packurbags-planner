import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faRoute, 
  faGasPump, 
  faClock, 
  faRoad, 
  faSearch, 
  faPlus, 
  faTrash, 
  faSpinner, 
  faLocationDot 
} from '@fortawesome/free-solid-svg-icons';
import { toast } from 'react-toastify';
import { searchPlaces, getPlaceDetails, geocodeCity, getGoogleKey } from '../../services/places';
import { getRoute } from '../../services/routing';
import { geocodePlaceORS } from '../../services/orsPlaces';
import { faCamera } from '@fortawesome/free-solid-svg-icons';

// Custom pin marker icon for map stops
const stopPinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: #121619;
    color: #D4B15A;
    border: 2px solid #D4B15A;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 11px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  ">📍</div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// Restaurant marker — orange background with fork emoji
const restaurantPinIcon = L.divIcon({
  className: '',
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #f97316;
    color: white;
    border: 2px solid #ea580c;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    box-shadow: 0 4px 10px rgba(249,115,22,0.5);
  ">🍴</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14]
});

// Helper component to auto-recenter map view to fit route bounds
function MapBoundsFitter({ polylineCoords, stops = [], restaurantMarkers = [] }) {
  const map = useMap();

  useEffect(() => {
    if (polylineCoords && polylineCoords.length > 0) {
      // Ensure polyline coords are also valid
      const validPoly = polylineCoords.filter(pt => pt && pt[0] && pt[1] && !isNaN(pt[0]) && !isNaN(pt[1]));
      if (validPoly.length > 0) {
        const bounds = L.latLngBounds(validPoly);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    } else {
      const allPts = [
        ...stops.filter(s => s && s.lat && s.lng && !isNaN(Number(s.lat)) && !isNaN(Number(s.lng))).map(s => [Number(s.lat), Number(s.lng)]),
        ...restaurantMarkers.filter(r => r && r.lat && r.lng && !isNaN(Number(r.lat)) && !isNaN(Number(r.lng))).map(r => [Number(r.lat), Number(r.lng)])
      ];
      if (allPts.length > 0) {
        const bounds = L.latLngBounds(allPts);
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }
  }, [map, polylineCoords, stops, restaurantMarkers]);

  return null;
}

// Force the map to refresh its size and re-fit bounds when route data arrives
function RouteUpdater({ routeInfo, stops }) {
  const map = useMap();
  useEffect(() => {
    if (!routeInfo) return;
    // Small delay to let React render the Polyline first
    const t = setTimeout(() => {
      map.invalidateSize();
      if (routeInfo.polylineCoords && routeInfo.polylineCoords.length > 0) {
        const valid = routeInfo.polylineCoords.filter(p => p && !isNaN(p[0]) && !isNaN(p[1]));
        if (valid.length > 0) map.fitBounds(L.latLngBounds(valid), { padding: [50, 50] });
      } else if (stops.length > 1) {
        const pts = stops.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng]);
        if (pts.length > 0) map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });
      }
    }, 100);
    return () => clearTimeout(t);
  }, [map, routeInfo, stops]);
  return null;
}

export default function RouteMapPanel({ initialStops = [], onStopsChange = null, onCaptureSnippet = null, fromCity = null, toCity = null, restaurants = [] }) {
  const [stops, setStops] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [restaurantMarkers, setRestaurantMarkers] = useState([]);

  // Geocode restaurants via ORS API and build map markers
  useEffect(() => {
    if (!restaurants || restaurants.length === 0) { setRestaurantMarkers([]); return; }
    let cancelled = false;
    const geocode = async () => {
      const markers = [];
      for (const r of restaurants) {
        // Use existing coords if available
        let lat = Number(r.lat || r.latitude || 0);
        let lng = Number(r.lng || r.longitude || 0);
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          // Geocode via ORS API
          const query = r.address ? `${r.name}, ${r.address}` : (r.city ? `${r.name}, ${r.city}` : r.name);
          try {
            const res = await geocodePlaceORS(query);
            if (res && res.lat && res.lng) {
              lat = res.lat;
              lng = res.lng;
            }
          } catch (err) {
            console.warn(`Failed to geocode restaurant ${r.name} via ORS:`, err);
          }
        }
        if (!cancelled && lat && lng && !isNaN(lat) && !isNaN(lng)) {
          markers.push({ 
            id: r.id || r.name, 
            name: r.name, 
            lat, 
            lng, 
            address: r.address || r.locality || r.city || '', 
            cuisine: r.cuisines || r.cuisine || '' 
          });
        }
      }
      if (!cancelled) setRestaurantMarkers(markers);
    };
    geocode();
    return () => { cancelled = true; };
  }, [restaurants]);



  const handleCaptureSnippet = () => {
    if (!onCaptureSnippet) return;
    setIsCapturing(true);
    try {
      const validStops = stops.filter(s => s.lat && s.lng);
      if (validStops.length === 0) { toast.error('No stops to capture'); setIsCapturing(false); return; }

      const W = 800, H = 420;
      const lats = validStops.map(s => Number(s.lat));
      const lngs = validStops.map(s => Number(s.lng));
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
      const padLat = (maxLat - minLat) * 0.25 || 0.5;
      const padLng = (maxLng - minLng) * 0.25 || 0.5;
      const bMinLat = minLat - padLat, bMaxLat = maxLat + padLat;
      const bMinLng = minLng - padLng, bMaxLng = maxLng + padLng;
      const toX = lng => ((Number(lng) - bMinLng) / (bMaxLng - bMinLng)) * (W - 80) + 40;
      const toY = lat => H - 40 - ((Number(lat) - bMinLat) / (bMaxLat - bMinLat)) * (H - 90);

      const pts = validStops.map(s => ({ x: toX(s.lng), y: toY(s.lat), name: s.name || '' }));
      const palette = ['#D4B15A','#4f46e5','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4'];

      let routeLine = '';
      if (routeInfo && routeInfo.polylineCoords && routeInfo.polylineCoords.length > 1) {
        const coords = routeInfo.polylineCoords;
        const step = Math.max(1, Math.floor(coords.length / 80));
        const sampled = coords.filter((_, i) => i % step === 0);
        // polylineCoords are stored as [lat,lng] from our ORS helper
        const linePts = sampled.map(c => `${toX(c[1])},${toY(c[0])}`).join(' ');
        routeLine = `<polyline points="${linePts}" fill="none" stroke="#4f46e5" stroke-width="3" stroke-dasharray="10,5" opacity="0.75"/>`;
      } else if (pts.length >= 2) {
        routeLine = `<polyline points="${pts.map(p => p.x+','+p.y).join(' ')}" fill="none" stroke="#4f46e5" stroke-width="3" stroke-dasharray="10,5" opacity="0.75"/>`;
      }

      const grid = Array.from({length: 8}, (_, i) =>
        `<line x1="${i*W/8}" y1="0" x2="${i*W/8}" y2="${H}" stroke="#c8dff0" stroke-width="0.5" opacity="0.4"/>` +
        `<line x1="0" y1="${i*H/8}" x2="${W}" y2="${i*H/8}" stroke="#c8dff0" stroke-width="0.5" opacity="0.4"/>`
      ).join('');

      const markers = pts.map((p, i) => {
        const col = palette[i % palette.length];
        const label = String.fromCharCode(65 + i);
        const nm = p.name.length > 18 ? p.name.slice(0, 16) + '\u2026' : p.name;
        const bw = nm.length * 7 + 16;
        return `<circle cx="${p.x}" cy="${p.y}" r="14" fill="${col}" stroke="white" stroke-width="2.5"/>` +
               `<text x="${p.x}" y="${p.y+5}" text-anchor="middle" fill="white" font-size="11" font-weight="bold" font-family="sans-serif">${label}</text>` +
               `<rect x="${p.x+16}" y="${p.y-12}" width="${bw}" height="22" rx="5" fill="white" fill-opacity="0.92" stroke="#ddd" stroke-width="1"/>` +
               `<text x="${p.x+24}" y="${p.y+4}" fill="#222" font-size="11" font-family="sans-serif">${nm}</text>`;
      }).join('');

      const distText = routeInfo && routeInfo.distanceKm
        ? `Dist: ${routeInfo.distanceKm} km  \u2022  Time: ${routeInfo.durationStr || routeInfo.durationDisplay || ''}`
        : '';

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
        `<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">` +
        `<stop offset="0%" style="stop-color:#e8f4fd"/><stop offset="100%" style="stop-color:#dbeafe"/>` +
        `</linearGradient></defs>` +
        `<rect width="${W}" height="${H}" fill="url(#bg)" rx="10"/>` +
        grid + routeLine + markers +
        `<rect x="0" y="0" width="${W}" height="34" fill="#121619" rx="10"/>` +
        `<rect x="0" y="24" width="${W}" height="10" fill="#121619"/>` +
        `<text x="14" y="23" fill="#D4B15A" font-size="14" font-weight="bold" font-family="sans-serif">Tourist Hubs Route Map</text>` +
        (distText ? `<rect x="0" y="${H-28}" width="${W}" height="28" fill="#12161988" rx="0"/>` +
                    `<text x="14" y="${H-10}" fill="#D4B15A" font-size="12" font-family="sans-serif">${distText}</text>` : '') +
        `</svg>`;

      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

      onCaptureSnippet({
        image: dataUrl,
        distance: routeInfo && routeInfo.distanceKm,
        time: routeInfo && (routeInfo.durationStr || routeInfo.durationDisplay),
        fuel: (routeInfo && routeInfo.fuelCostInr) || 0
      });
      toast.success('Map snippet captured and added to itinerary!');
    } catch (err) {
      console.error('Capture failed:', err);
      toast.error('Capture failed');
    } finally {
      setIsCapturing(false);
    }
  };

  // Sync initialStops if props change
  useEffect(() => {
    const loadFormattedStops = async () => {
      const allStops = [];

      // If fromCity/toCity props are provided, prepend them as origin/destination
      // This ensures the route always has a clear start/end even if selectedPlaces
      // are all in the same city.
      if (fromCity) {
        const fc = await geocodeCity(fromCity);
        if (fc) allStops.push({ id: 'origin', name: fromCity, lat: fc.lat, lng: fc.lng, address: fromCity });
      }

      const validInitialStops = (initialStops || []).filter(Boolean);
      for (let idx = 0; idx < validInitialStops.length; idx++) {
        const s = validInitialStops[idx];
        let lat = Number(s.lat || s.latitude || s.Latitude);
        let lng = Number(s.lng || s.longitude || s.Longitude);
        const name = s.name || s.title || s.displayName || `Stop ${idx + 1}`;
        const cityName = s.city || s.state || '';

        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
          // 1st try: geocode by the place name itself
          let coords = await geocodeCity(name);
          // 2nd try: if that fails, geocode by the place's city (always works for known cities)
          if (!coords && cityName) {
            coords = await geocodeCity(cityName);
          }
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          } else {
            // Skip this stop entirely rather than adding a wrong centre-of-India pin
            continue;
          }
        }

        allStops.push({
          id: s.id || s.placeId || `stop_${idx}`,
          name,
          lat,
          lng,
          address: s.address || s.formattedAddress || cityName || ''
        });
      }

      if (toCity && !fromCity) {
        // Only add toCity if fromCity wasn't added (avoid duplicating if caller already added it)
        const tc = await geocodeCity(toCity);
        if (tc) allStops.push({ id: 'dest', name: toCity, lat: tc.lat, lng: tc.lng, address: toCity });
      }

      if (allStops.length > 0) setStops(allStops);
    };

    loadFormattedStops();
  }, [initialStops, fromCity, toCity]);

  // Debounced places search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchPlaces(searchQuery);
        setSuggestions(results);
      } catch (err) {
        console.error("Search error in component:", err);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle selecting a place suggestion from autocomplete
  const handleSelectSuggestion = async (suggestion) => {
    setSearching(true);
    setSearchQuery('');
    setSuggestions([]);

    try {
      const details = await getPlaceDetails(suggestion.placeId);
      if (details) {
        const newStop = {
          id: details.id || details.placeId || `stop_${Date.now()}`,
          name: details.displayName || details.name,
          lat: Number(details.lat),
          lng: Number(details.lng),
          address: details.formattedAddress || details.address || ''
        };

        const updated = [...stops, newStop];
        setStops(updated);
        if (onStopsChange) onStopsChange(updated);
        toast.success(`Added ${newStop.name} to route stops`);
      }
    } catch (err) {
      console.error("Failed to add place details:", err);
      toast.error("Could not add selected place");
    } finally {
      setSearching(false);
    }
  };

  // Remove stop
  const handleRemoveStop = (id) => {
    const updated = stops.filter(s => s.id !== id);
    setStops(updated);
    if (onStopsChange) onStopsChange(updated);
    setRouteInfo(null);
  };

  // Calculate driving route using OpenRouteService with Haversine fallback
  const handleCalculateRoute = async (currentStops = stops) => {
    const validStops = currentStops.filter(s => s.lat && s.lng);
    if (validStops.length < 2) return;

    setLoadingRoute(true);
    try {
      // ORS expects [[lng, lat], ...]
      const coords = validStops.map(s => [s.lng, s.lat]);
      const res = await getRoute(coords);
      if (res) {
        setRouteInfo(res);
      }
    } catch (err) {
      console.error("Route calculation error:", err);
    } finally {
      setLoadingRoute(false);
    }
  };

  // Auto-calculate optimized route when stops change
  useEffect(() => {
    if (stops.length >= 2) {
      const timer = setTimeout(() => {
        handleCalculateRoute(stops);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [stops]);


  const validCenterStops = stops.filter(s => s && s.lat && s.lng && !isNaN(Number(s.lat)) && !isNaN(Number(s.lng)));
  const centerLat = validCenterStops.length > 0 ? Number(validCenterStops[0].lat) : 22.3511;
  const centerLng = validCenterStops.length > 0 ? Number(validCenterStops[0].lng) : 78.6677;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 mb-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <span className="text-xs font-bold text-[#D4B15A] uppercase tracking-widest bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
            🗺️ OpenRouteService + Google Places
          </span>
          <h3 className="text-2xl font-bold text-gray-900 mt-2 flex items-center gap-2">
            <FontAwesomeIcon icon={faRoute} className="text-[#D4B15A]" />
            <span>Interactive Driving Route & Distance</span>
          </h3>
          <p className="text-gray-500 text-xs mt-1">
            Search places, add stops, and calculate accurate driving time, distance, and fuel cost.
          </p>
        </div>

        <button
          onClick={handleCalculateRoute}
          disabled={loadingRoute || stops.length < 2}
          className="bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] disabled:bg-gray-300 disabled:text-gray-500 font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm shadow-md cursor-pointer shrink-0"
        >
          {loadingRoute ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faRoad} />}
          <span>Calculate Driving Route</span>
        </button>

        {routeInfo && onCaptureSnippet && (
          <button
            onClick={handleCaptureSnippet}
            disabled={isCapturing}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm shadow-md cursor-pointer shrink-0 disabled:opacity-50"
          >
            {isCapturing ? <FontAwesomeIcon icon={faSpinner} spin /> : <FontAwesomeIcon icon={faCamera} />}
            <span>Take Snippet for Itinerary</span>
          </button>
        )}
      </div>

      {/* Add Stop / Autocomplete Search */}
      <div className="relative mb-6">
        <div className="relative">
          <FontAwesomeIcon icon={faSearch} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Add a stop (Search places, cities, attractions via Google Places API)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#D4B15A] focus:bg-white transition-all font-medium"
          />
          {searching && (
            <FontAwesomeIcon icon={faSpinner} spin className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4B15A]" />
          )}
        </div>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-60 overflow-y-auto">
            {suggestions.map((item, i) => (
              <button
                key={item.placeId || i}
                onClick={() => handleSelectSuggestion(item)}
                className="w-full text-left px-4 py-3 hover:bg-amber-50 border-b border-gray-50 last:border-none flex items-center justify-between transition-colors text-sm"
              >
                <div className="flex items-center gap-2.5">
                  <FontAwesomeIcon icon={faLocationDot} className="text-[#D4B15A] shrink-0" />
                  <span className="font-semibold text-gray-800">{item.text || item.displayName}</span>
                </div>
                <span className="text-[10px] uppercase font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {item.source === 'google' ? 'Google' : 'Offline'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Route Metrics Summary Cards */}
      {routeInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg font-bold shrink-0">
              <FontAwesomeIcon icon={faRoad} />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Distance</p>
              <p className="text-xl font-extrabold text-amber-950">{routeInfo.distanceKm} km</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
              <FontAwesomeIcon icon={faClock} />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Estimated Time</p>
              <p className="text-xl font-extrabold text-blue-950">{routeInfo.durationDisplay}</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg font-bold shrink-0">
              <FontAwesomeIcon icon={faGasPump} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Est. Fuel Cost</p>
              <p className="text-xl font-extrabold text-emerald-950">₹{routeInfo.fuelCostInr}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stops Sequence Pills */}
      {stops.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {stops.map((stop, idx) => (
            <div 
              key={stop.id || idx}
              className="bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-semibold text-gray-800"
            >
              <span className="w-4 h-4 rounded-full bg-[#121619] text-[#D4B15A] flex items-center justify-center text-[10px] font-bold">
                {idx + 1}
              </span>
              <span>{stop.name}</span>
              <button 
                onClick={() => handleRemoveStop(stop.id)}
                className="text-gray-400 hover:text-red-500 ml-1 transition-colors"
                title="Remove stop"
              >
                <FontAwesomeIcon icon={faTrash} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Leaflet Map Rendering Polyline Route */}
      <div id="route-map-container" className="h-[400px] w-full rounded-2xl overflow-hidden shadow-inner border border-gray-200 relative z-0">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={6}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            crossOrigin="anonymous"
          />

          {/* Polyline Driving Route — vivid indigo so it's always visible */}
          {routeInfo?.polylineCoords && routeInfo.polylineCoords.length > 0 && (
            <Polyline
              positions={routeInfo.polylineCoords}
              color="#4f46e5"
              weight={7}
              opacity={0.85}
            />
          )}

          {/* Markers for stops */}
          {stops.filter(s => s && s.lat && s.lng && !isNaN(Number(s.lat)) && !isNaN(Number(s.lng))).map((s, idx) => (
            <Marker key={s.id || idx} position={[Number(s.lat), Number(s.lng)]} icon={stopPinIcon}>
              <Popup>
                <div className="p-1 text-center">
                  <p className="font-bold text-xs text-gray-900">Stop #{idx + 1}: {s.name}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Restaurant markers — orange fork icon */}
          {restaurantMarkers.map((r, idx) => (
            <Marker key={`rest_${r.id || idx}`} position={[Number(r.lat), Number(r.lng)]} icon={restaurantPinIcon}>
              <Popup>
                <div className="p-1">
                  <p className="font-bold text-xs text-orange-700">🍴 {r.name}</p>
                  {r.address && <p className="text-[11px] text-gray-500 mt-0.5">📍 {r.address}</p>}
                  {r.cuisine && <p className="text-[11px] text-gray-400 mt-0.5">{r.cuisine}</p>}
                  <p className="text-[10px] text-orange-500 font-bold mt-1">Your Chosen Restaurant</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Fit map bounds dynamically */}
          <RouteUpdater routeInfo={routeInfo} stops={stops} />
          <MapBoundsFitter polylineCoords={routeInfo?.polylineCoords} stops={stops} restaurantMarkers={restaurantMarkers} />
        </MapContainer>

        {/* Map legend */}
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-3 py-2 text-[11px] shadow-md flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-[#121619] border border-[#D4B15A] flex items-center justify-center text-[8px]">📍</span>
            <span className="text-gray-700 font-semibold">Tourist Stops</span>
          </div>
          {restaurantMarkers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-[8px]">🍴</span>
              <span className="text-orange-700 font-semibold">Your Restaurants ({restaurantMarkers.length})</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

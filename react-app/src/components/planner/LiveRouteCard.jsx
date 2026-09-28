import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faStar, faExclamationTriangle, faUtensils, faCamera } from '@fortawesome/free-solid-svg-icons';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeCity } from '../../services/places';
import { getRoute } from '../../services/routing';
import { toast } from 'react-toastify';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// ── Icons ──────────────────────────────────────────────────────────────────────
const hotelIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#0284c7;color:#fff;border:2.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.4);">🏨</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16]
});

const routeHotelIcon = L.divIcon({
  className: '',
  html: `<div style="width:32px;height:32px;background:#D4B15A;color:#fff;border:2.5px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 4px 12px rgba(0,0,0,0.4);">🏨</div>`,
  iconSize: [32, 32], iconAnchor: [16, 16]
});

const stopIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;background:#121619;color:#D4B15A;border:2px solid #D4B15A;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;box-shadow:0 3px 8px rgba(0,0,0,0.4);">📍</div>`,
  iconSize: [22, 22], iconAnchor: [11, 11]
});

// Great circle arc calculation between two geographic coordinates
function getGreatCircleArc(start, end, numPoints = 80) {
  if (!start || !end) return [];
  const points = [];
  const d2r = Math.PI / 180;
  const r2d = 180 / Math.PI;
  const lat1 = start.lat * d2r;
  const lon1 = start.lng * d2r;
  const lat2 = end.lat * d2r;
  const lon2 = end.lng * d2r;

  const d = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon1 - lon2) / 2), 2)
  ));

  if (d === 0 || isNaN(d)) return [[start.lat, start.lng]];

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2))) * r2d;
    const lon = Math.atan2(y, x) * r2d;
    points.push([lat, lon]);
  }
  return points;
}

// Animated plane marker that moves smoothly along the curved flight path
function AnimatedPlane({ stops, progress }) {
  const map = useMap();
  const markerRef = useRef(null);

  const arc = useMemo(() => {
    if (!stops || stops.length < 2) return [];
    return getGreatCircleArc(stops[0], stops[stops.length - 1], 100);
  }, [stops]);

  const { position, heading } = useMemo(() => {
    if (!arc || arc.length < 2) {
      if (!stops || stops.length < 2) return { position: null, heading: 0 };
      const from = stops[0];
      const to = stops[stops.length - 1];
      const dy = to.lat - from.lat;
      const dx = to.lng - from.lng;
      return {
        position: [from.lat + dy * progress, from.lng + dx * progress],
        heading: Math.atan2(dx, dy) * (180 / Math.PI)
      };
    }
    const totalSegments = arc.length - 1;
    const rawIdx = progress * totalSegments;
    const idx = Math.min(Math.floor(rawIdx), totalSegments - 1);
    const nextIdx = idx + 1;
    const t = rawIdx - idx;
    const curr = arc[idx];
    const nxt = arc[nextIdx];
    const lat = curr[0] + (nxt[0] - curr[0]) * t;
    const lng = curr[1] + (nxt[1] - curr[1]) * t;
    const dy = nxt[0] - curr[0];
    const dx = nxt[1] - curr[1];
    const bearing = Math.atan2(dx, dy) * (180 / Math.PI);
    return { position: [lat, lng], heading: bearing };
  }, [arc, stops, progress]);

  const planeIcon = useMemo(() => L.divIcon({
    className: '',
    html: `
      <div style="position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center;">
        <!-- Soft radar aura -->
        <div style="position:absolute; width:36px; height:36px; border-radius:50%; background:radial-gradient(circle, rgba(99,102,241,0.35) 0%, rgba(99,102,241,0) 75%); pointer-events:none;"></div>
        <!-- Rotated aircraft with user transition -->
        <div style="transform:rotate(${heading}deg); transition:all 0.02s linear; display:flex; align-items:center; justify-content:center; width:100%; height:100%;">
          <svg width="34" height="34" viewBox="0 0 100 100" style="filter:drop-shadow(0 4px 8px rgba(15,23,42,0.45)); overflow:visible;">
            <!-- Contrail vapor trails -->
            <line x1="38" y1="72" x2="38" y2="92" stroke="rgba(224,231,255,0.85)" stroke-width="3" stroke-linecap="round" stroke-dasharray="3,3"/>
            <line x1="62" y1="72" x2="62" y2="92" stroke="rgba(224,231,255,0.85)" stroke-width="3" stroke-linecap="round" stroke-dasharray="3,3"/>
            <!-- Jet fuselage and wings -->
            <path d="M50 4 C46 4 43 8 43 18 L43 38 L10 56 C7 58 7 62 10 62 L43 54 L43 75 L31 84 C29 85 29 88 32 88 L46 86 L50 96 L54 86 L68 88 C71 88 71 85 69 84 L57 75 L57 54 L90 62 C93 62 93 58 90 56 L57 38 L57 18 C57 8 54 4 50 4 Z" fill="#ffffff" stroke="#312e81" stroke-width="2.5" stroke-linejoin="round"/>
            <!-- Cockpit window -->
            <path d="M47 15 C47 12 50 10 50 10 C50 10 53 12 53 15 Z" fill="#4338ca"/>
            <!-- Jet turbines -->
            <rect x="33" y="45" width="7" height="16" rx="3.5" fill="#e0e7ff" stroke="#312e81" stroke-width="1.5"/>
            <rect x="60" y="45" width="7" height="16" rx="3.5" fill="#e0e7ff" stroke="#312e81" stroke-width="1.5"/>
            <!-- Port / Starboard navigation lights -->
            <circle cx="10" cy="59" r="2.5" fill="#ef4444"/>
            <circle cx="90" cy="59" r="2.5" fill="#22c55e"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  }), [heading]);

  if (!position) return null;

  return <Marker position={position} icon={planeIcon} zIndexOffset={1000} ref={markerRef} />;
}

// ── Map bounds fitter ──────────────────────────────────────────────────────────
function MapFitter({ coords }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!fitted.current && coords && coords.length > 0) {
      fitted.current = true;
      try { map.fitBounds(L.latLngBounds(coords), { padding: [28, 28] }); } catch (_) {}
    }
  }, [map, coords]);
  return null;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function LiveRouteCard({ fromCity, destinations, onCaptureSnippet, fromDate, toDate }) {
  const [stops, setStops] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [destHotels, setDestHotels] = useState([]);
  const [routeHotels, setRouteHotels] = useState([]);
  const [dsaLive, setDsaLive] = useState(null); // null=loading, true=live, false=fallback
  const [hotelAuthError, setHotelAuthError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isIntercontinental, setIsIntercontinental] = useState(false);
  const [planePos, setPlanePos] = useState(0); // 0.0 to 1.0 for animation
  const [findingRest, setFindingRest] = useState(null); // hotelId being searched
  const [isCapturing, setIsCapturing] = useState(false);
  const initKey = useRef('');

  const cities = useMemo(() => {
    const dest = (destinations || '').split(',').map(s => s.trim()).filter(Boolean);
    return [fromCity || 'Delhi', ...dest];
  }, [fromCity, destinations]);

  const flightArcCoords = useMemo(() => {
    if (!isIntercontinental || stops.length < 2) return null;
    return getGreatCircleArc(stops[0], stops[stops.length - 1], 90);
  }, [isIntercontinental, stops]);

  const boundsCoords = useMemo(() => {
    if (isIntercontinental && flightArcCoords?.length) return flightArcCoords;
    if (routeInfo?.polylineCoords?.length) return routeInfo.polylineCoords;
    if (stops.length > 0) return stops.map(s => [s.lat, s.lng]);
    return [];
  }, [isIntercontinental, flightArcCoords, routeInfo, stops]);

  useEffect(() => {
    const key = `${cities.join(',')}_${fromDate || ''}_${toDate || ''}`;
    if (initKey.current === key) return;
    initKey.current = key;
    loadAll(cities);
  }, [cities, fromDate, toDate]);

  // Animate plane icon along the route for intercontinental trips
  useEffect(() => {
    if (!isIntercontinental) { setPlanePos(0); return; }
    let pos = 0;
    const interval = setInterval(() => {
      pos = (pos + 0.005) % 1.0; // 2.5x faster increment
      setPlanePos(pos);
    }, 50); // 50ms interval for smoother, faster animation
    return () => clearInterval(interval);
  }, [isIntercontinental]);

  const loadAll = async (currentCities) => {
    setLoading(true);
    setDsaLive(null);
    setHotelAuthError(false);
    setDestHotels([]);
    setRouteHotels([]);
    try {
      // 1. Geocode stops
      const geocoded = [];
      for (const city of currentCities) {
        const c = await geocodeCity(city);
        if (c) geocoded.push({ name: city, lat: c.lat, lng: c.lng });
      }
      setStops(geocoded);

      // Detect intercontinental (lng gap > 30 degrees)
      if (geocoded.length >= 2) {
        const lngGap = Math.abs(geocoded[geocoded.length - 1].lng - geocoded[0].lng);
        setIsIntercontinental(lngGap > 30);
      }

      // 2. Get driving route
      let route = null;
      if (geocoded.length >= 2) {
        route = await getRoute(geocoded.map(s => [s.lng, s.lat]));
        if (route) setRouteInfo(route);
      }

      const checkIn = fromDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0];
      const checkOut = toDate || new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0];

      // 3. Fetch destination hotels from live DSA
      const cityFetches = currentCities.map(c =>
        fetch(`${BACKEND_URL}/api/planner/dsa/hotels/search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city: c, checkIn, checkOut, rooms: 1, adults: 2, nights: 2 })
        }).then(r => r.json()).catch(() => ({ success: false, results: [] }))
      );
      const cityResults = await Promise.all(cityFetches);
      let dHotels = [];
      let anyLive = false;
      let isAuthError = false;
      cityResults.forEach((res, idx) => {
        if (res.authError) { isAuthError = true; } // don't return early, keep going to fetch local fallback!
        if (res.success && res.results?.length) {
          if (res.source === 'DSA') {
            anyLive = true;
          }
          // Pin hotel to the stop's geocoded coordinates so it's ON the route
          const stopCoord = geocoded[idx] || geocoded[geocoded.length - 1];
          const best = res.results[0];
          if (best) {
            dHotels.push({
              ...best,
              lat: stopCoord?.lat || best.lat || 0,
              lng: stopCoord?.lng || best.lng || 0,
              routePoint: false,
            });
          }
        }
      });
      setDestHotels(dHotels);

      // 4. Fetch midway hotels along route at 1/5 intervals — pin to polyline points
      if (route?.polylineCoords?.length >= 10) {
        const poly = route.polylineCoords;
        const step = Math.max(1, Math.floor(poly.length / 300));
        const sampled = poly.filter((_, i) => i % step === 0);

        const routeRes = await fetch(`${BACKEND_URL}/api/planner/dsa/hotels/along-route`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ polyline: sampled, checkIn, checkOut, rooms: 1, adults: 2, nights: 2 })
        }).then(r => r.json()).catch(() => ({ success: false, results: [] }));

        if (routeRes.authError) {
          isAuthError = true;
        } 
        if (routeRes.success && routeRes.results?.length) {
          if (routeRes.source === 'DSA') {
            anyLive = true;
          }
          // IMPORTANT: Use the backend's route point lat/lng (polyline point), 
          // NOT the hotel's actual GPS, to keep markers on the route
          const pinned = routeRes.results.map(h => ({
            ...h,
            lat: h.routePointLat || h.lat,
            lng: h.routePointLng || h.lng,
          }));
          setRouteHotels(pinned);
        }
      }
      setHotelAuthError(isAuthError);
      setDsaLive(anyLive);
    } catch (err) {
      console.error('LiveRouteCard load error:', err);
      setDsaLive(false);
    } finally {
      setLoading(false);
    }
  };

  // Find nearby restaurants via Google Places
  const handleFindRestaurants = useCallback(async (hotel) => {
    if (findingRest) return;
    setFindingRest(hotel.id);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
      const query = `restaurants near ${hotel.property_name} ${hotel.city || hotel.routeCityName || ''}`;
      const res = await fetch(`${BACKEND_URL}/v1/planner/places/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      const suggestions = data.suggestions || [];
      if (suggestions.length === 0) {
        toast.info('No restaurants found nearby');
      } else {
        const names = suggestions.slice(0, 3).map(s => s.placePrediction?.text?.text || 'Restaurant').join(', ');
        toast.success(`Nearby: ${names}`, { autoClose: 6000 });
      }
    } catch (err) {
      toast.error('Could not fetch restaurants');
    } finally {
      setFindingRest(null);
    }
  }, [findingRest]);

  // Take snapshot of the route
  const handleCaptureSnippet = useCallback(async () => {
    if (!onCaptureSnippet || isCapturing) return;
    setIsCapturing(true);
    try {
      const BACKEND_URL_LRC = import.meta.env.VITE_BACKEND_URL || '';
      let pathParam = '';
      if (routeInfo?.polylineCoords?.length > 0) {
        const coords = routeInfo.polylineCoords;
        const step = Math.max(1, Math.floor(coords.length / 80));
        const sampled = coords.filter((_, i) => i % step === 0);
        pathParam = `&path=color:0x121619ff%7Cweight:4%7C${sampled.map(c => `${c[0]},${c[1]}`).join('%7C')}`;
      }
      const stopMarkers = stops.map((s, i) =>
        `&markers=color:red%7Clabel:${String.fromCharCode(65 + i)}%7C${s.lat},${s.lng}`
      ).join('');
      const mid = stops[Math.floor(stops.length / 2)] || { lat: 20.5937, lng: 78.9629 };
      const rawParams = `center=${mid.lat},${mid.lng}&zoom=6&size=800x450&maptype=roadmap&scale=2${stopMarkers}${pathParam}`;
      const staticUrl = `${BACKEND_URL_LRC}/api/planner/static-map?params=${encodeURIComponent(rawParams)}`;
      onCaptureSnippet({ image: staticUrl, distance: routeInfo?.distanceKm, time: routeInfo?.durationDisplay, fuel: routeInfo?.fuelCostInr || 0 });
      toast.success('Map snippet captured for itinerary!');
    } catch (err) {
      toast.error('Capture failed');
    } finally {
      setIsCapturing(false);
    }
  }, [onCaptureSnippet, isCapturing, routeInfo, stops]);

  const allHotels = [...destHotels, ...routeHotels];

  // ── Hotel Popup ──────────────────────────────────────────────────────────────
  const HotelPopup = ({ h, isRoutePoint }) => (
    <div className="p-1" style={{ minWidth: 180, maxWidth: 210 }}>
      <p className="font-bold text-xs text-gray-900 leading-tight mb-0.5">{h.property_name}</p>
      <p className="text-[10px] text-gray-500 mb-1">{h.routeCityName || h.city}</p>
      <div className="flex items-center gap-1 text-[10px] text-amber-500 mb-1.5">
        <FontAwesomeIcon icon={faStar} />
        <span className="font-bold text-gray-700">{h.hotel_stars}★</span>
        {h.price_per_night_inr > 0 && (
          <span className="text-gray-400">| ₹{h.price_per_night_inr.toLocaleString('en-IN')}/night</span>
        )}
      </div>
      {isRoutePoint && (
        <span className="inline-block text-[9px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 font-semibold mb-1.5">🗺️ En Route</span>
      )}
      <button
        onClick={() => handleFindRestaurants(h)}
        disabled={findingRest === h.id}
        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-[10px] font-bold py-1.5 rounded-lg transition-colors"
      >
        {findingRest === h.id ? (
          <FontAwesomeIcon icon={faSpinner} spin />
        ) : (
          <FontAwesomeIcon icon={faUtensils} />
        )}
        {findingRest === h.id ? 'Searching...' : 'Find Restaurants'}
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-gray-200/80 p-3.5 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="px-1.5 py-1.5 flex items-center justify-between gap-2 shrink-0 mb-1">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-gray-900 flex items-center gap-1.5">
            <span>🗺️</span> Live Route Map
          </h3>
          <p className="text-[11px] text-gray-500 font-medium truncate mt-0.5">{fromCity} → {destinations}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* DSA Signal */}
          {dsaLive === null ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              <FontAwesomeIcon icon={faSpinner} spin className="text-[10px]" /> Loading
            </span>
          ) : dsaLive ? (
            <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shadow-2xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Live DSA
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              Fallback
            </span>
          )}
          {/* Snippet button */}
          {onCaptureSnippet && (
            <button
              onClick={handleCaptureSnippet}
              disabled={isCapturing || loading}
              title="Take snippet for itinerary"
              className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
            >
              <FontAwesomeIcon icon={faCamera} className="text-[9px]" />
              {isCapturing ? '...' : 'Snippet'}
            </button>
          )}
        </div>
      </div>

      {/* Route stats pill (Image 2 & 5) */}
      {routeInfo && (
        <div className="my-2 p-2 px-3 flex items-center justify-around text-xs font-bold text-gray-700 bg-gray-50/90 border border-gray-100 rounded-xl shrink-0 shadow-2xs">
          <span className="flex items-center gap-1 text-gray-800">
            <span className="text-amber-500">📍</span> {routeInfo.distanceKm} km
          </span>
          <span className="text-gray-300">|</span>
          <span className="flex items-center gap-1 text-gray-800">
            <span className="text-indigo-500">⏱️</span> {routeInfo.durationDisplay}
          </span>
          {routeInfo.fuelCostInr > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1 text-gray-800">
                <span className="text-emerald-500">⛽</span> ₹{routeInfo.fuelCostInr}
              </span>
            </>
          )}
        </div>
      )}

      {/* Map with rounded border */}
      <div className="flex-grow relative rounded-2xl overflow-hidden border border-gray-200/70 shadow-inner">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-[500] bg-white/85 backdrop-blur-sm">
            <FontAwesomeIcon icon={faSpinner} spin className="text-3xl text-[#D4B15A] mb-2" />
            <p className="text-xs text-gray-500 font-medium text-center px-4">Fetching live hotels along route…</p>
          </div>
        )}
        <MapContainer center={[22.5937, 78.9629]} zoom={5} scrollWheelZoom={true} className="h-full w-full" style={{ minHeight: 280 }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            crossOrigin="anonymous"
          />

          {/* Route polyline or great-circle curved flight path */}
          {isIntercontinental && flightArcCoords?.length > 0 ? (
            <>
              {/* Soft ambient flight glow */}
              <Polyline 
                positions={flightArcCoords} 
                color="#6366f1" 
                weight={8} 
                opacity={0.2} 
              />
              {/* Electric indigo dashed flight path */}
              <Polyline 
                positions={flightArcCoords} 
                color="#4f46e5" 
                weight={3} 
                opacity={0.85} 
                dashArray="8, 10" 
              />
            </>
          ) : (
            routeInfo?.polylineCoords?.length > 0 && (
              <Polyline 
                positions={routeInfo.polylineCoords} 
                color="#121619" 
                weight={4} 
                opacity={0.85} 
                dashArray="8,8" 
              />
            )
          )}
          {/* Animated plane for intercontinental routes */}
          {isIntercontinental && stops.length >= 2 && (
            <AnimatedPlane stops={stops} progress={planePos} />
          )}

          {/* Stop markers */}
          {stops.map((s, i) => (
            <Marker key={`stop-${i}`} position={[s.lat, s.lng]} icon={stopIcon}>
              <Popup><div className="text-xs font-bold">{s.name}</div><div className="text-[10px] text-gray-500">Stop {i + 1}</div></Popup>
            </Marker>
          ))}

          {/* Destination hotels (blue) */}
          {destHotels.map((h, i) => (
            <Marker key={`dest-${h.id || i}`} position={[h.lat, h.lng]} icon={hotelIcon}>
              <Popup><HotelPopup h={h} isRoutePoint={false} /></Popup>
            </Marker>
          ))}

          {/* Route midway hotels (gold) — always pinned to polyline points */}
          {routeHotels.map((h, i) => (
            <Marker key={`route-${h.id || i}`} position={[h.lat, h.lng]} icon={routeHotelIcon}>
              <Popup><HotelPopup h={h} isRoutePoint={true} /></Popup>
            </Marker>
          ))}

          {boundsCoords.length > 0 && <MapFitter coords={boundsCoords} />}
        </MapContainer>
      </div>

      {/* Footer */}
      {!loading && (
        <div className="px-3 py-1.5 border-t border-gray-100 shrink-0 flex items-center justify-between bg-gray-50">
          {allHotels.length > 0 ? (
            <span className="text-[10px] text-gray-500">
              🏨 <strong>{allHotels.length}</strong> live hotels · {routeHotels.length} en route · Click for restaurants
            </span>
          ) : hotelAuthError ? (
            <span className="text-[10px] text-amber-600 flex items-center gap-1">
              ⚠️ Hotel API credentials need update — contact DSA support
            </span>
          ) : (
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-400" />
              No hotels available for these dates
            </span>
          )}
        </div>
      )}
    </div>
  );
}

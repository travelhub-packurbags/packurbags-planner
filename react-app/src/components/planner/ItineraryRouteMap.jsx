import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faSpinner } from '@fortawesome/free-solid-svg-icons';
import 'leaflet/dist/leaflet.css';
import { geocodeCity } from '../../services/places';
import { getRoute } from '../../services/routing';

// ── Custom marker icons ────────────────────────────────────────────
const makeIcon = (emoji, bg = '#121619', border = '#D4B15A') =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;background:${bg};color:#fff;
      border:2.5px solid ${border};border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.35);
    ">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const hotelIcon = makeIcon('🏨', '#0f766e', '#5eead4');
const sightIcon = makeIcon('📍', '#7c3aed', '#c4b5fd');
const mealIcon  = makeIcon('🍽️', '#b45309', '#fcd34d');
const originIcon= makeIcon('🚀', '#1d4ed8', '#93c5fd');
const destIcon  = makeIcon('🏁', '#dc2626', '#fca5a5');

function iconFor(type) {
  if (!type) return sightIcon;
  if (type === 'meal') return mealIcon;
  if (type === 'hotel') return hotelIcon;
  return sightIcon;
}

/**
 * ItineraryRouteMap
 * Renders a read-only Leaflet map for the final itinerary page.
 * Shows: origin → day-stop cities polyline + hotel and key activity pins.
 *
 * Props:
 *   plan         — the parsed AI plan object
 *   fromCity     — trip origin city string
 *   routeInfo    — { distanceKm, durationDisplay, fuelCostInr, polylineCoords }
 *   isVehicle    — bool: if vehicle trip show full route polyline
 */
export default function ItineraryRouteMap({ plan, fromCity, routeInfo, isVehicle, onCaptureSnippet = null, selectedHotel = null }) {
  const [markers, setMarkers] = useState([]);
  const [polyline, setPolyline] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);

  const handleCaptureSnippet = async () => {
    if (!onCaptureSnippet) return;
    setIsCapturing(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';
      const validMarkers = markers.filter(m => m.lat && m.lng);

      let pathParam = '';
      if (polyline.length > 1) {
        const step    = Math.max(1, Math.floor(polyline.length / 100));
        const sampled = polyline.filter((_, i) => i % step === 0);
        pathParam = `&path=color:0x7c3aedff%7Cweight:4%7C${sampled.map(c => `${c[0]},${c[1]}`).join('%7C')}`;
      }

      const originMarkers = validMarkers.filter(m => m.type === 'origin');
      const hotelMarkers  = validMarkers.filter(m => m.type === 'hotel');
      const otherMarkers  = validMarkers.filter(m => m.type !== 'origin' && m.type !== 'hotel');

      const oParam = originMarkers.map(m => `&markers=color:green%7Clabel:O%7C${m.lat},${m.lng}`).join('');
      const hParam = hotelMarkers.slice(0,5).map(m => `&markers=color:blue%7Clabel:H%7C${m.lat},${m.lng}`).join('');
      const pParam = otherMarkers.slice(0,5).map(m => `&markers=color:red%7Csize:small%7C${m.lat},${m.lng}`).join('');
      const markersParam = oParam + hParam + pParam;

      const midMarker  = validMarkers[Math.floor(validMarkers.length / 2)] || { lat: 20.5937, lng: 78.9629 };
      const centerParam = `center=${midMarker.lat},${midMarker.lng}`;
      const zoom = validMarkers.length > 2 ? 6 : validMarkers.length > 1 ? 7 : 12;

      // Backend proxy injects the key — key never exposed in browser
      const rawParams = `${centerParam}&zoom=${zoom}&size=800x450&maptype=roadmap&scale=2${markersParam}${pathParam}`;
      const staticUrl = `${BACKEND_URL}/api/planner/static-map?params=${encodeURIComponent(rawParams)}`;

      onCaptureSnippet({
        image: staticUrl,
        distance: routeInfo?.distanceKm,
        time: routeInfo?.durationStr,
        fuel: isVehicle && routeInfo ? (routeInfo.fuelCostInr * 2) : 0
      });
      toast.success('Map snippet captured and added to itinerary!');
    } catch (err) {
      console.error('Capture failed:', err);
    } finally {
      setIsCapturing(false);
    }
  };
  const mapRef = useRef(null);

  const totalFuel = isVehicle && routeInfo?.fuelCostInr
    ? routeInfo.fuelCostInr * 2
    : null;

  useEffect(() => {
    if (!plan?.days) return;

    const buildMarkers = async () => {
      setLoading(true);
      const pts = [];

      // 1) Origin city
      try {
        const oc = await geocodeCity(fromCity || plan.from_city || 'Delhi');
        if (oc) pts.push({ lat: oc.lat, lng: oc.lng, label: fromCity || plan.from_city, type: 'origin' });
      } catch { /* silent */ }

      // 2) Walk each day – hotels + key sightseeing activities
      for (const day of plan.days) {
        // Hotel for this day
        if (selectedHotel && (selectedHotel.latitude || selectedHotel.lat)) {
          const sLat = Number(selectedHotel.latitude || selectedHotel.lat);
          const sLng = Number(selectedHotel.longitude || selectedHotel.lng);
          pts.push({ lat: sLat, lng: sLng, label: selectedHotel.name || selectedHotel.property_name, subLabel: `★${selectedHotel.hotel_stars || ''} • ₹${(selectedHotel.price_per_night_inr || selectedHotel.price_inr || 0).toLocaleString()}/night`, type: 'hotel' });
        } else if (day.hotel?.name && day.hotel.name !== 'N/A') {
          const hotelAddr = day.hotel.address || `${day.hotel.name}, ${day.city}`;
          try {
            const hc = await geocodeCity(hotelAddr);
            if (hc) pts.push({ lat: hc.lat, lng: hc.lng, label: day.hotel.name, subLabel: `★${day.hotel.rating || ''} • ₹${(day.hotel.price_per_night_inr || 0).toLocaleString()}/night`, type: 'hotel' });
          } catch { /* silent */ }
        }

        // Up to 2 sightseeing or meal highlights per day
        const highlights = (day.schedule || []).filter(s =>
          s.type === 'sightseeing' || s.type === 'meal' || s.type === 'adventure'
        ).slice(0, 2);

        for (const act of highlights) {
          const query = act.place || `${act.activity?.slice(0, 40)}, ${day.city}`;
          try {
            const ac = await geocodeCity(query);
            if (ac) pts.push({ lat: ac.lat, lng: ac.lng, label: act.place || act.activity?.slice(0, 40), subLabel: act.type === 'meal' ? `🍽️ ${act.type}` : `🏛️ ${act.type}`, type: act.type });
          } catch { /* silent */ }
        }
      }

      // 3) Build polyline: use ORS polyline if available, otherwise fetch optimized route
      if (routeInfo?.polylineCoords?.length > 0) {
        setPolyline(routeInfo.polylineCoords);
      } else {
        const validCoords = pts.filter(p => p.lat && p.lng).map(p => [p.lng, p.lat]);
        if (validCoords.length > 1) {
          try {
            const res = await getRoute(validCoords);
            if (res?.polylineCoords?.length > 0) {
              setPolyline(res.polylineCoords);
            } else {
              setPolyline(validCoords.map(c => [c[1], c[0]]));
            }
          } catch {
            setPolyline(validCoords.map(c => [c[1], c[0]]));
          }
        } else {
          setPolyline(validCoords.map(c => [c[1], c[0]]));
        }
      }

      setMarkers(pts);
      setLoading(false);
    };

    buildMarkers();
  }, [plan, fromCity, routeInfo, isVehicle]);

  // Fit bounds once markers are ready
  useEffect(() => {
    if (!mapRef.current || markers.length === 0) return;
    const map = mapRef.current;
    const validPts = markers.filter(m => m.lat && m.lng);
    if (validPts.length > 0) {
      const bounds = L.latLngBounds(validPts.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [markers]);

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg bg-white">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-3 p-4 bg-gray-50 border-b border-gray-200">
        {routeInfo?.distanceKm && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 min-w-[140px]">
            <span className="text-amber-600 text-xl">📏</span>
            <div>
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Distance</p>
              <p className="text-base font-bold text-amber-900">{Number(routeInfo.distanceKm).toLocaleString()} km</p>
            </div>
          </div>
        )}
        {routeInfo?.durationDisplay && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 min-w-[140px]">
            <span className="text-blue-600 text-xl">🕐</span>
            <div>
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Drive Time</p>
              <p className="text-base font-bold text-blue-900">{routeInfo.durationDisplay}</p>
            </div>
          </div>
        )}
        {totalFuel && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2 min-w-[140px]">
            <span className="text-green-600 text-xl">⛽</span>
            <div>
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Total Fuel (Both Ways)</p>
              <p className="text-base font-bold text-green-900">₹{totalFuel.toLocaleString()}</p>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 px-4 py-2 bg-white border-b border-gray-100 text-xs text-gray-600">
        <span>🚀 Origin</span>
        <span>🏨 Hotel</span>
        <span>📍 Attraction</span>
        <span>🍽️ Dining</span>
        {isVehicle && <span className="text-violet-600 font-medium">— Route polyline via ORS</span>}
      </div>

      {/* Map */}
      {loading ? (
        <div className="h-72 flex flex-col items-center justify-center text-gray-400 gap-2">
          <svg className="animate-spin h-7 w-7 text-[#D4B15A]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-sm font-medium">Building route map…</p>
        </div>
      ) : (
        <div id="itinerary-map-container" className="relative w-full z-0">
        <MapContainer
          center={markers[0] ? [markers[0].lat, markers[0].lng] : [20.5937, 78.9629]}
          zoom={6}
          style={{ height: '380px', width: '100%' }}
          ref={mapRef}
          scrollWheelZoom={false}
          attributionControl={true}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            crossOrigin="anonymous"
          />

          {/* Route polyline */}
          {polyline.length > 1 && (
            <Polyline
              positions={polyline}
              color="#7c3aed"
              weight={3}
              opacity={0.75}
              dashArray={isVehicle ? undefined : '8 6'}
            />
          )}

          {/* Markers */}
          {markers.map((m, i) => {
            if (!m.lat || !m.lng) return null;
            const icon = m.type === 'origin' ? originIcon
              : m.type === 'hotel' ? hotelIcon
              : m.type === 'meal' ? mealIcon
              : sightIcon;
            return (
              <Marker key={i} position={[m.lat, m.lng]} icon={icon}>
                <Popup>
                  <div className="text-xs font-semibold">{m.label}</div>
                  {m.subLabel && <div className="text-xs text-gray-500 mt-0.5">{m.subLabel}</div>}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        </div>
      )}
    </div>
  );
}

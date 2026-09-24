import { toast } from 'react-toastify';
import { haversineDistance, calculateETA } from '../utils/haversine';

// All ORS calls go through the backend proxy — no key in the browser bundle.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

/**
 * ROUTING + TIME/DISTANCE
 * Uses the backend /v1/planner/route proxy → OpenRouteService.
 *
 * @param {Array} coordinatesArray - [ [lng, lat], ... ] or [ {lat, lng}, ... ]
 */
export async function getRoute(coordinatesArray) {
  if (!coordinatesArray || coordinatesArray.length < 2) return null;

  // Normalize to [[lng, lat], ...]
  const formattedCoords = coordinatesArray.map(c => {
    if (Array.isArray(c)) return [Number(c[0]), Number(c[1])];
    if (typeof c === 'object' && c.lat !== undefined && c.lng !== undefined)
      return [Number(c.lng), Number(c.lat)];
    return [78.9629, 20.5937];
  });

  try {
    const res = await fetch(`${BACKEND_URL}/v1/planner/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: formattedCoords, instructions: false }),
    });

    if (!res.ok) throw new Error(`Backend route proxy returned ${res.status}`);

    const data = await res.json();
    if (data.code === 'PLANNER_UNAVAILABLE') throw new Error(data.message);

    const routeFeature = data.features?.[0];
    if (!routeFeature) throw new Error('No route feature returned');

    const summary    = routeFeature.properties?.summary || {};
    const distanceKm = Math.round((summary.distance || 0) / 1000 * 10) / 10;

    let durationSec = summary.duration || 0;
    // Cap average speed at 60 km/h for Indian road conditions
    const avgSpeedKmH = distanceKm / (durationSec / 3600);
    if (avgSpeedKmH > 60) durationSec = (distanceKm / 60) * 3600;

    const hours   = Math.floor(durationSec / 3600);
    const minutes = Math.round((durationSec % 3600) / 60);

    // ORS geometry: [[lng,lat],...] → Leaflet needs [[lat,lng],...]
    const rawGeometry   = routeFeature.geometry?.coordinates || [];
    const leafletPolyline = rawGeometry.map(coord => [coord[1], coord[0]]);

    const fuelCostInr = Math.round((distanceKm / 15) * 96);

    return {
      distanceKm,
      durationDisplay: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      durationStr:     hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      durationHours:   Math.round(durationSec / 36) / 100,
      totalMinutes:    Math.round(durationSec / 60),
      fuelCostInr,
      polylineCoords: leafletPolyline,
      source: 'ors',
    };

  } catch (err) {
    console.error('Route proxy failed, using haversine fallback:', err.message || err);
    toast.warn('Routing offline. Time estimates are approximate', { toastId: 'ors-fallback-warn' });
    return getHaversineFallbackRoute(formattedCoords);
  }
}

/**
 * Fallback route using straight-line Haversine formula + 50 km/h average speed
 */
function getHaversineFallbackRoute(formattedCoords) {
  let totalDistanceKm = 0;
  const polylineCoords = [];

  for (let i = 0; i < formattedCoords.length; i++) {
    const [lng, lat] = formattedCoords[i];
    polylineCoords.push([lat, lng]);
    if (i > 0) {
      const [prevLng, prevLat] = formattedCoords[i - 1];
      totalDistanceKm += haversineDistance(prevLat, prevLng, lat, lng);
    }
  }

  const distKm      = Math.round(totalDistanceKm * 10) / 10;
  const eta         = calculateETA(distKm, 50);
  const fuelCostInr = Math.round((distKm / 15) * 96);

  return {
    distanceKm:    distKm,
    durationDisplay: eta.display,
    durationStr:     eta.display,
    durationHours:   Math.round(eta.totalMinutes / 60 * 100) / 100,
    totalMinutes:    eta.totalMinutes,
    fuelCostInr,
    polylineCoords,
    source: 'haversine',
  };
}

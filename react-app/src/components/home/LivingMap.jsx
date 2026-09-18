import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCheckCircle, faUsers, faThumbsUp, faThumbsDown, faLocationArrow } from '@fortawesome/free-solid-svg-icons';

// Custom red circular pin marker
const customPin = L.divIcon({
  className: '',
  html: `<div style="
    width:18px; height:18px;
    background: #121619;
    border: 3px solid #fff;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(21,74,74,0.5);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
});
L.Marker.prototype.options.icon = customPin;

// Custom Heatmap layer component
function HeatmapLayer({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points || !points.length) return;
    
    // Import leaflet.heat dynamically if needed, but assuming it's available globally or via import
    import('leaflet.heat').then(() => {
      const heat = L.heatLayer(
        points.map(p => [p.lat, p.lng, p.intensity || 0.5]),
        { radius: 25, blur: 15, maxZoom: 10 }
      ).addTo(map);
      
      return () => {
        map.removeLayer(heat);
      };
    }).catch(err => console.warn('Heatmap plugin not loaded:', err));
  }, [map, points]);
  return null;
}

export default function LivingMap() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/locations.json`)
      .then(res => res.json())
      .then(data => setLocations(data.slice(0, 20)))
      .catch(err => console.error('Error loading locations:', err));
  }, []);

  const heatmapPoints = locations.filter(l => l.lat && l.lng).map(l => ({
    lat: l.lat,
    lng: l.lng,
    intensity: l.heat_score || 0.5
  }));

  return (
    <section className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4 tracking-wider uppercase">ðŸ—ºï¸ Interactive</span>
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">Living Map</h2>
          <p className="text-gray-500 mt-2">Click any pin to explore traveler reviews for that destination</p>
        </motion.div>

        <div className="h-[560px] w-full rounded-3xl overflow-hidden shadow-2xl ring-1 ring-gray-200 relative z-0">
          <MapContainer 
            center={[22.3511148, 78.6677428]} 
            zoom={4} 
            scrollWheelZoom={false}
            className="w-full h-full"
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={19}
            />
            {heatmapPoints.length > 0 && <HeatmapLayer points={heatmapPoints} />}
            
            {locations.filter(l => l.lat && l.lng).map(loc => (
              <Marker key={loc.location_id} position={[loc.lat, loc.lng]}>
                <Popup className="p-0 custom-popup border-none shadow-none" closeButton={false}>
                  <div className="w-64 overflow-hidden rounded-2xl shadow-xl bg-white flex flex-col relative font-sans">
                    
                    {/* Image Header */}
                    <div className="h-36 w-full relative">
                      <img src={loc.cover_image || '/files/l1.jpg'} alt={loc.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 via-gray-900/20 to-transparent" />
                      
                      {/* Rating Badge */}
                      <div className="absolute bottom-3 left-3 bg-red-500/90 backdrop-blur text-white text-xs px-2 py-1 rounded-md font-bold shadow-md">
                        Rating: {loc.avg_rating || 4.8}/5.0
                      </div>
                    </div>
                    
                    {/* Content Body */}
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 text-lg mb-0.5 leading-tight">{loc.name}</h3>
                      <p className="text-xs text-gray-500 mb-3 font-medium">{loc.state}, {loc.country}</p>
                      
                      {/* Icon Stats List */}
                      <div className="flex items-center gap-4 text-xs text-gray-600 mb-4 border-t border-gray-100 pt-3">
                        <div className="flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faUsers} className="text-blue-500" /> 
                          <span>{(loc.total_reviews || 0).toLocaleString()} visitors</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <FontAwesomeIcon icon={faThumbsUp} className="text-emerald-500" /> 
                          <span>{(loc.heat_score * 100 || 95).toFixed(0)}% positive</span>
                        </div>
                      </div>
                      
                      {/* Action Button */}
                      <button 
                        onClick={() => setSelectedLocation(loc)}
                        className="w-full bg-blue-600 text-white text-sm font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-600/30 flex items-center justify-center gap-2"
                      >
                        Read Reviews <FontAwesomeIcon icon={faLocationArrow} className="text-xs" />
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        {/* Review Modal */}
        <AnimatePresence>
          {selectedLocation && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm cursor-pointer"
                onClick={() => setSelectedLocation(null)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden relative z-10 flex flex-col max-h-[90vh]"
              >
                <div className="h-48 relative shrink-0">
                  <img src={selectedLocation.cover_image || '/files/l1.jpg'} alt={selectedLocation.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-transparent" />
                  <button 
                    onClick={() => setSelectedLocation(null)}
                    className="absolute top-4 right-4 w-8 h-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                  <div className="absolute bottom-4 left-6 text-white">
                    <h2 className="text-3xl font-bold font-display">{selectedLocation.name}</h2>
                    <p className="text-white/80">{selectedLocation.country}</p>
                  </div>
                </div>
                
                <div className="p-6 overflow-y-auto">
                  {selectedLocation.review_data ? (
                    <div className="space-y-6">
                      <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
                          <FontAwesomeIcon icon={faThumbsUp} /> The Good
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {selectedLocation.review_data.good}
                        </p>
                      </div>
                      
                      <div className="bg-red-50 rounded-2xl p-5 border border-red-100">
                        <div className="flex items-center gap-2 text-red-700 font-bold mb-2">
                          <FontAwesomeIcon icon={faThumbsDown} /> The Bad
                        </div>
                        <p className="text-gray-700 text-sm leading-relaxed">
                          {selectedLocation.review_data.bad}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      No detailed reviews available for this location yet.
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

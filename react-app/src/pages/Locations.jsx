import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import WeatherIcon from '../components/global/WeatherIcon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faStar } from '@fortawesome/free-solid-svg-icons';

export default function Locations() {
  const [locations, setLocations] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCountry = searchParams.get('country') || 'All';

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/locations.json`)
      .then(res => res.json())
      .then(data => setLocations(data || []))
      .catch(err => console.error("Error loading locations:", err));
  }, []);

  const countries = ['All', ...new Set(locations.map(l => l.country))];
  const filteredLocations = selectedCountry === 'All' 
    ? locations 
    : locations.filter(l => l.country === selectedCountry);

  return (
    <div className="pt-24 min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        
        <div className="text-center mb-12">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 font-display mb-4"
          >
            Explore Destinations
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 text-lg"
          >
            Find your next adventure from our curated list of beautiful locations
          </motion.p>
        </div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3 mt-8"
          >
            {countries.map(country => (
              <button
                key={country}
                onClick={() => setSearchParams(country === 'All' ? {} : { country })}
                className={`px-5 py-2.5 rounded-full font-medium text-sm transition-all duration-300 shadow-sm ${
                  selectedCountry === country
                    ? 'bg-[#121619] text-white shadow-md scale-105'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {country}
              </button>
            ))}
          </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredLocations.map((loc, i) => (
            <motion.div
              key={loc.id || i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              id={loc.id}
              className="bg-white rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 group flex flex-col relative z-10 hover:z-20"
            >
              <div className="relative h-64 rounded-t-3xl overflow-hidden">
                <img 
                  src={loc.cover_image || '/files/l1.jpg'} 
                  alt={loc.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="absolute top-4 right-4 z-[60]">
                <WeatherIcon city={loc.weather_city || loc.name} lat={loc.lat} lng={loc.lng} className="bg-black/40 backdrop-blur-md !text-white rounded-xl shadow-lg border border-white/20" />
              </div>
              {loc.heat_score > 0.8 && (
                <div className="absolute top-4 left-4 z-[50] bg-[#FFAA00] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
                  🔥 Trending
                </div>
              )}
              
              <div className="p-6">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{loc.name}</h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <FontAwesomeIcon icon={faMapMarkerAlt} className="text-[#121619]" /> {loc.state}, {loc.country}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg text-sm font-bold">
                    <FontAwesomeIcon icon={faStar} /> {loc.avg_rating || 4.8}
                  </div>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {loc.description || `Discover the beauty and culture of ${loc.name}. A perfect destination for your next vacation.`}
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {(loc.tags || ['Nature', 'Relaxation']).map(tag => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full font-medium">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
      </div>
    </div>
  
  );
}

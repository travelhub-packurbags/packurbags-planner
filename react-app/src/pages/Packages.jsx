import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faBolt, faTimes, faMapMarkerAlt } from '@fortawesome/free-solid-svg-icons';

export default function Packages() {
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/packages.json`)
      .then(res => res.json())
      .then(data => setPackages(Array.isArray(data) ? data.slice(0, 4) : []))
      .catch(err => console.error("Error loading packages:", err));
  }, []);

  return (
    <div className="pt-24 min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        
        <div className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 font-display mb-4"
          >
            Travel Packages
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-500 text-lg max-w-2xl mx-auto"
          >
            Choose the perfect package for your next journey. From budget-friendly to absolute luxury.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {packages.map((pkg, i) => (
            <motion.div
              key={pkg.package_id || i}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="group relative h-[450px] rounded-3xl overflow-hidden cursor-pointer shadow-lg"
            >
              <img 
                src={pkg.image_url || '/files/l1.jpg'} 
                alt={pkg.name} 
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-colors duration-500 group-hover:bg-black/70" />
              
              {pkg.tier === 'balanced' && (
                <div className="absolute top-4 left-4 bg-[#FFAA00] text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 z-10">
                  <FontAwesomeIcon icon={faBolt} /> Popular
                </div>
              )}
              
              <div className="absolute bottom-0 left-0 w-full p-6 text-white transform transition-transform duration-500 translate-y-8 group-hover:translate-y-0">
                <h3 className="text-2xl font-bold mb-1">{pkg.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-[#D4B15A]">â‚¹{pkg.price_inr.toLocaleString()}</span>
                  <span className="text-white/70 text-sm"> /person</span>
                </div>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                  <ul className="space-y-2 mb-6">
                    {(pkg.inclusions || []).slice(0, 3).map((feature, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm text-white/90">
                        <FontAwesomeIcon icon={faCheck} className="text-[#D4B15A] text-xs" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedPkg(pkg); }}
                    className="w-full bg-[#121619] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#1e2429] transition-colors shadow-lg"
                  >
                    View Itinerary
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
      </div>

      <AnimatePresence>
        {selectedPkg && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPkg(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden relative z-10 max-h-[90vh] flex flex-col"
            >
              <div className="h-48 relative shrink-0">
                <img src={selectedPkg.image_url} alt={selectedPkg.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-gray-900/90 to-transparent" />
                <button 
                  onClick={() => setSelectedPkg(null)}
                  className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/40 text-white rounded-full flex items-center justify-center backdrop-blur transition-colors"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
                <div className="absolute bottom-4 left-6 text-white pr-6">
                  <h2 className="text-3xl font-bold font-display mb-1">{selectedPkg.name}</h2>
                  <div className="flex items-center gap-4 text-sm font-medium">
                    <span className="flex items-center gap-1.5"><FontAwesomeIcon icon={faMapMarkerAlt} className="text-[#D4B15A]" /> {selectedPkg.days} Days / {selectedPkg.nights} Nights</span>
                    <span className="text-[#D4B15A] font-bold text-lg">â‚¹{selectedPkg.price_inr.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto bg-gray-50">
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                  {selectedPkg.itinerary?.map((day, idx) => (
                    <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-[#121619] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                        <span className="text-sm font-bold">{day.day}</span>
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl shadow-sm border border-gray-100 group-hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between space-x-2 mb-2">
                          <h4 className="font-bold text-gray-900 text-lg">Day {day.day}: {day.title}</h4>
                        </div>
                        <ul className="space-y-2">
                          {day.activities.map((activity, aIdx) => (
                            <li key={aIdx} className="text-gray-600 text-sm flex gap-2">
                              <span className="text-[#D4B15A] mt-0.5">â€¢</span>
                              <span>{activity}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 bg-white border-t flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedPkg(null)}
                  className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

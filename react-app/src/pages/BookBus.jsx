import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VendorCard from '../components/bus/VendorCard';
import BusFilters from '../components/bus/BusFilters';
import DriverDetails from '../components/bus/DriverDetails';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapLocationDot, faCalendarAlt, faUsers, faFilter } from '@fortawesome/free-solid-svg-icons';

export default function BookBus() {
  const [step, setStep] = useState(1); // 1: Search, 2: Select, 3: Details
  const [allVendors, setAllVendors] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [filteredVendors, setFilteredVendors] = useState([]);
  const [searchParams, setSearchParams] = useState({ from: '', to: '', date: '', passengers: 1 });
  const [filters, setFilters] = useState({ ac: 'any', type: 'any', minRating: 0 });
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showDriver, setShowDriver] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/vendors.json`)
      .then(res => res.json())
      .then(data => setAllVendors(data || []))
      .catch(err => console.error("Error loading vendors:", err));
  }, []);

  useEffect(() => {
    // Apply filters
    let result = vendors;
    if (filters.ac !== 'any') {
      result = result.filter(v => v.busType?.toLowerCase().includes(filters.ac));
    }
    if (filters.type !== 'any') {
      result = result.filter(v => v.busType?.toLowerCase().includes(filters.type));
    }
    if (filters.minRating > 0) {
      result = result.filter(v => v.rating >= filters.minRating);
    }
    setFilteredVendors(result);
  }, [filters, vendors]);

  const handleSearch = (e) => {
    e.preventDefault();
    const fromStr = searchParams.from.toLowerCase().trim();
    const toStr = searchParams.to.toLowerCase().trim();
    
    // In our mock data, vendors have "from_city" and "routes" array (e.g. "Delhi-Manali")
    // Let's filter vendors who service this route
    const routePattern = `${fromStr}-${toStr}`;
    
    const matchedVendors = allVendors.filter(v => 
      v.from_city.toLowerCase() === fromStr && 
      v.routes.some(r => r.toLowerCase() === routePattern)
    );
    
    setVendors(matchedVendors);
    setStep(2);
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Progress bar */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-[#FFAA00] text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`h-1 w-16 ${step >= 2 ? 'bg-[#FFAA00]' : 'bg-gray-200'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-[#FFAA00] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <div className={`h-1 w-16 ${step >= 3 ? 'bg-[#FFAA00]' : 'bg-gray-200'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-[#FFAA00] text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-white rounded-3xl p-8 shadow-xl max-w-4xl mx-auto"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center font-display">Where do you want to go?</h2>
              
              <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faMapLocationDot} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none" placeholder="Leaving from" value={searchParams.from} onChange={e => setSearchParams({...searchParams, from: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faMapLocationDot} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none" placeholder="Going to" value={searchParams.to} onChange={e => setSearchParams({...searchParams, to: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date of Journey</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="date" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none" value={searchParams.date} onChange={e => setSearchParams({...searchParams, date: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Passengers</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faUsers} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="number" min="1" max="55" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none" value={searchParams.passengers} onChange={e => setSearchParams({...searchParams, passengers: parseInt(e.target.value)})} />
                  </div>
                </div>
                <div className="md:col-span-2 mt-4">
                  <button type="submit" className="w-full bg-[#121619] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#1e2429] transition-colors shadow-lg shadow-[#121619]/30">
                    Search Buses
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="grid grid-cols-1 lg:grid-cols-4 gap-8"
            >
              <div className="lg:col-span-1">
                <BusFilters filters={filters} setFilters={setFilters} />
              </div>
              
              <div className="lg:col-span-3 space-y-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    {filteredVendors.length} Buses Found
                  </h3>
                  <button onClick={() => setStep(1)} className="text-[#FFAA00] font-medium hover:underline">
                    Modify Search
                  </button>
                </div>

                {filteredVendors.map((vendor, i) => (
                  <VendorCard 
                    key={vendor.id || i} 
                    vendor={vendor} 
                    onSelect={() => { setSelectedVendor(vendor); setStep(3); }} 
                    onViewDriver={() => { setSelectedVendor(vendor); setShowDriver(true); }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && selectedVendor && (
             <motion.div
             key="step3"
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: 20 }}
             className="bg-white rounded-3xl p-8 shadow-xl max-w-4xl mx-auto"
           >
             {/* Payment / Details stub */}
             <h2 className="text-2xl font-bold mb-4">Complete Booking with {selectedVendor.name}</h2>
             <p>Selected route: {searchParams.from} to {searchParams.to}</p>
             <p>Date: {searchParams.date}</p>
             <button onClick={() => alert("Booking functionality coming soon!")} className="mt-6 bg-[#FFAA00] text-white px-8 py-3 rounded-xl font-bold">Pay Now</button>
             <button onClick={() => setStep(2)} className="mt-6 ml-4 text-gray-500 font-medium hover:underline">Back to Options</button>
           </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showDriver && selectedVendor && (
          <DriverDetails vendor={selectedVendor} onClose={() => setShowDriver(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

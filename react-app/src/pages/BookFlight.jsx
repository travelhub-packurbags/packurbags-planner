import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FlightCard from '../components/flight/FlightCard';
import FlightFilters from '../components/flight/FlightFilters';
import FareHeatmap from '../components/flight/FareHeatmap';
import AirlineDetails from '../components/flight/AirlineDetails';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlaneDeparture, faPlaneArrival, faCalendarAlt, faUsers, faExchangeAlt } from '@fortawesome/free-solid-svg-icons';

export default function BookFlight() {
  const [step, setStep] = useState(1);
  const [allRoutes, setAllRoutes] = useState([]);
  const [flights, setFlights] = useState([]);
  const [filteredFlights, setFilteredFlights] = useState([]);
  const [searchParams, setSearchParams] = useState({ from: '', to: '', date: '', passengers: 1, type: 'oneway' });
  const [filters, setFilters] = useState({ stops: 'any', airlines: [], maxPrice: 50000 });
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [showAirline, setShowAirline] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/flights_demo.json`)
      .then(res => res.json())
      .then(data => setAllRoutes(data || []))
      .catch(err => console.error("Error loading flights:", err));
  }, []);

  useEffect(() => {
    let result = flights;
    if (filters.stops !== 'any') {
      result = result.filter(f => f.stops.toString() === filters.stops);
    }
    if (filters.airlines.length > 0) {
      result = result.filter(f => filters.airlines.includes(f.airline));
    }
    if (filters.maxPrice < 50000) {
      result = result.filter(f => f.price <= filters.maxPrice);
    }
    setFilteredFlights(result);
  }, [filters, flights]);

  const handleSearch = (e) => {
    e.preventDefault();
    
    const fromStr = searchParams.from.toLowerCase().trim();
    const toStr = searchParams.to.toLowerCase().trim();
    
    const route = allRoutes.find(r => 
      r.from.toLowerCase() === fromStr && r.to.toLowerCase() === toStr
    );
    
    if (route) {
      const mappedFlights = route.flights.map(f => ({
        id: f.flight_id,
        airline: f.airline,
        flightNumber: f.flight_id,
        departureTime: f.dep_time,
        departure: route.from,
        arrivalTime: f.arr_time,
        arrival: route.to,
        duration: f.duration,
        stops: f.stops,
        price: f.price_inr
      }));
      setFlights(mappedFlights);
    } else {
      // If no direct route found, maybe show an empty list or show returning flights if round trip (omitted for demo)
      setFlights([]);
    }
    
    setStep(2);
  };

  return (
    <div className="pt-20 min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4">
        {/* Progress bar */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-[#121619] text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`h-1 w-16 ${step >= 2 ? 'bg-[#121619]' : 'bg-gray-200'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 2 ? 'bg-[#121619] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <div className={`h-1 w-16 ${step >= 3 ? 'bg-[#121619]' : 'bg-gray-200'}`} />
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 3 ? 'bg-[#121619] text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl p-8 shadow-xl max-w-5xl mx-auto"
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center font-display">Book Your Flight</h2>
              
              <div className="flex justify-center mb-8">
                <div className="bg-gray-100 p-1 rounded-xl flex gap-2">
                  <button className={`px-6 py-2 rounded-lg font-medium transition-colors ${searchParams.type === 'oneway' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`} onClick={() => setSearchParams({...searchParams, type: 'oneway'})}>One Way</button>
                  <button className={`px-6 py-2 rounded-lg font-medium transition-colors ${searchParams.type === 'round' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`} onClick={() => setSearchParams({...searchParams, type: 'round'})}>Round Trip</button>
                </div>
              </div>

              <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">From</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faPlaneDeparture} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none" placeholder="City or Airport" value={searchParams.from} onChange={e => setSearchParams({...searchParams, from: e.target.value})} />
                  </div>
                </div>
                
                <div className="hidden md:flex md:col-span-1 justify-center pb-2">
                  <button type="button" className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500" onClick={() => setSearchParams({...searchParams, from: searchParams.to, to: searchParams.from})}>
                    <FontAwesomeIcon icon={faExchangeAlt} />
                  </button>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">To</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faPlaneArrival} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none" placeholder="City or Airport" value={searchParams.to} onChange={e => setSearchParams({...searchParams, to: e.target.value})} />
                  </div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Departure</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="date" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none" value={searchParams.date} onChange={e => setSearchParams({...searchParams, date: e.target.value})} />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Travelers</label>
                  <div className="relative">
                    <FontAwesomeIcon icon={faUsers} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="number" min="1" max="9" required className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none" value={searchParams.passengers} onChange={e => setSearchParams({...searchParams, passengers: parseInt(e.target.value)})} />
                  </div>
                </div>

                <div className="md:col-span-12 mt-4">
                  <button type="submit" className="w-full bg-[#121619] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#1e2429] transition-colors shadow-lg shadow-[#121619]/30">
                    Search Flights
                  </button>
                </div>
              </form>

              <div className="mt-12">
                <FareHeatmap from={searchParams.from} to={searchParams.to} />
              </div>
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
                <FlightFilters filters={filters} setFilters={setFilters} />
              </div>
              
              <div className="lg:col-span-3 space-y-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900">
                    {filteredFlights.length} Flights Found
                  </h3>
                  <button onClick={() => setStep(1)} className="text-[#121619] font-medium hover:underline">
                    Modify Search
                  </button>
                </div>

                {filteredFlights.map((flight, i) => (
                  <FlightCard 
                    key={flight.id || i} 
                    flight={flight} 
                    onSelect={() => { setSelectedFlight(flight); setStep(3); }} 
                    onViewAirline={() => { setSelectedFlight(flight); setShowAirline(true); }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && selectedFlight && (
             <motion.div
             key="step3"
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             exit={{ opacity: 0, x: 20 }}
             className="bg-white rounded-3xl p-8 shadow-xl max-w-4xl mx-auto"
           >
             <h2 className="text-2xl font-bold mb-4">Complete Booking with {selectedFlight.airline}</h2>
             <p>Flight: {selectedFlight.flightNumber}</p>
             <p>From: {selectedFlight.departure} To: {selectedFlight.arrival}</p>
             <button onClick={() => alert("Booking functionality coming soon!")} className="mt-6 bg-[#121619] text-white px-8 py-3 rounded-xl font-bold">Pay Now</button>
             <button onClick={() => setStep(2)} className="mt-6 ml-4 text-gray-500 font-medium hover:underline">Back to Options</button>
           </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAirline && selectedFlight && (
          <AirlineDetails airline={selectedFlight.airline} onClose={() => setShowAirline(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCarSide, 
  faFilter, 
  faStar, 
  faXmark, 
  faArrowRight, 
  faArrowLeft, 
  faEye,
  faShieldHalved,
  faGasPump,
  faUserTie,
  faWifi,
  faPlug,
  faMusic,
  faChild,
  faCheck
} from '@fortawesome/free-solid-svg-icons';

export default function Step4Rides({ destination, selectedRides = [], onToggleRide, onNext, onBack }) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [category, setCategory] = useState('all');
  const [bookingType, setBookingType] = useState('all');
  const [maxPrice, setMaxPrice] = useState(10000);
  const [hotelPickupOnly, setHotelPickupOnly] = useState(false);
  const [cancellationOnly, setCancellationOnly] = useState(false);

  // Detail Modal
  const [activeRideModal, setActiveRideModal] = useState(null);

  useEffect(() => {
    const fetchRides = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/rides.json`);
        const data = await res.json();

        const targetCity = (destination || '').toLowerCase().trim();
        let filtered = data.filter(r => r.city.toLowerCase().includes(targetCity) || targetCity.includes(r.city.toLowerCase()));
        
        if (filtered.length === 0) {
          filtered = data.slice(0, 30);
        }
        setRides(filtered);
      } catch (err) {
        console.error('Failed to load rides dataset:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchRides();
  }, [destination]);

  // Apply filters
  const filteredRides = rides.filter(r => {
    if (r.price > maxPrice) return false;
    if (category !== 'all' && r.vehicle_category.toLowerCase() !== category.toLowerCase()) return false;
    if (bookingType !== 'all' && !r.booking_type.toLowerCase().includes(bookingType.toLowerCase())) return false;
    if (hotelPickupOnly && r.hotel_pickup.toLowerCase() !== 'yes') return false;
    if (cancellationOnly && !r.cancellation) return false;
    return true;
  });

  const categories = ['all', 'Auto', 'Sedan', 'SUV', 'Premium', 'Bike', 'Jeep'];
  const bookingTypes = ['all', 'Full Day', 'One Way', 'Round Trip'];

  const renderStars = (rating) => {
    const count = Math.min(5, Math.max(1, Math.round(rating)));
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <FontAwesomeIcon key={i} icon={faStar} className={i < count ? "text-[#D4B15A]" : "text-gray-300"} />
      );
    }
    return stars;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      
      {/* Option Banner: Book Ride vs Skip */}
      <div className="mb-8 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-[#D4B15A] uppercase tracking-widest bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
            Step 4: Ground Transportation
          </span>
          <h2 className="text-2xl font-display font-bold text-gray-900 mt-2">
            Book Rides for Your Sightseeing ({selectedRides.length} Booked)
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Choose one or more private cabs, jeeps, or bikes for different sightseeing legs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onNext}
            className="px-6 py-3 bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Dining ({selectedRides.length})</span>
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>

      {/* Selected Rides Banner */}
      {selectedRides.length > 0 && (
        <div className="mb-8 bg-[#121619] text-white p-5 rounded-3xl shadow-xl border border-[#D4B15A]/30">
          <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
            <h4 className="font-bold text-[#D4B15A] text-xs uppercase tracking-widest flex items-center gap-2">
              <FontAwesomeIcon icon={faCarSide} /> Booked Transport Rides ({selectedRides.length})
            </h4>
            <span className="text-xs text-white font-bold">
              Total Ride Cost: ₹{selectedRides.reduce((s, r) => s + r.price, 0).toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedRides.map(r => (
              <div key={r.ride_id} className="bg-white/5 p-3 rounded-2xl border border-white/10 text-xs flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-[#D4B15A] font-bold">{r.vehicle_category} • {r.booking_type}</span>
                  <h5 className="font-bold text-white text-sm">{r.vehicle_model}</h5>
                  <p className="text-[11px] text-gray-400">📍 {r.tourist_place || r.city} • ₹{r.price.toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => onToggleRide(r)}
                  className="text-gray-400 hover:text-rose-400 p-1 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="flex flex-col lg:flex-row gap-8">
        
        {/* Left Sidebar Filters */}
        <aside className="w-full lg:w-72 bg-white rounded-3xl p-6 border border-gray-200 shadow-sm shrink-0 sticky top-36 h-fit">
          <h3 className="font-display font-bold text-gray-900 text-lg mb-6 flex items-center gap-2">
            <FontAwesomeIcon icon={faFilter} className="text-[#D4B15A]" />
            Ride Filters
          </h3>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Vehicle Category
              </label>
              <select 
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 outline-none focus:border-[#D4B15A]"
              >
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'All Vehicle Types' : c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Booking Type
              </label>
              <select 
                value={bookingType}
                onChange={e => setBookingType(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 outline-none focus:border-[#D4B15A]"
              >
                {bookingTypes.map(bt => (
                  <option key={bt} value={bt}>{bt === 'all' ? 'All Booking Types' : bt}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Max Price
                </label>
                <span className="text-xs font-extrabold text-[#D4B15A]">₹{maxPrice.toLocaleString()}</span>
              </div>
              <input 
                type="range"
                min="500"
                max="10000"
                step="500"
                value={maxPrice}
                onChange={e => setMaxPrice(Number(e.target.value))}
                className="w-full accent-[#D4B15A] cursor-pointer"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={hotelPickupOnly}
                  onChange={e => setHotelPickupOnly(e.target.checked)}
                  className="accent-[#D4B15A] w-4 h-4"
                />
                <span className="text-xs font-semibold text-gray-700">Hotel Pickup Available</span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={cancellationOnly}
                  onChange={e => setCancellationOnly(e.target.checked)}
                  className="accent-[#D4B15A] w-4 h-4"
                />
                <span className="text-xs font-semibold text-gray-700">Flexible Cancellation Policy</span>
              </label>
            </div>

          </div>
        </aside>

        {/* Right Ride Stream */}
        <main className="flex-1">
          
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              {filteredRides.length} Vehicles Available in {destination || 'Destination'}
            </h3>
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4B15A]"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredRides.map(ride => {
                const isSelected = selectedRides.some(r => r.ride_id === ride.ride_id);
                return (
                  <div 
                    key={ride.ride_id}
                    className={`bg-white rounded-2xl p-5 border transition-all flex flex-col justify-between group ${
                      isSelected 
                        ? 'border-[#D4B15A] ring-2 ring-[#D4B15A]/30 shadow-lg' 
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4B15A] bg-[#D4B15A]/10 px-2.5 py-0.5 rounded-md">
                            {ride.vehicle_category} • {ride.ride_type}
                          </span>
                          <h4 className="text-lg font-bold text-gray-900 mt-1 group-hover:text-[#D4B15A] transition-colors">
                            {ride.vehicle_model}
                          </h4>
                        </div>
                        
                        {ride.verified.toLowerCase() === 'yes' && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <FontAwesomeIcon icon={faShieldHalved} /> Verified
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mb-3">
                        📍 Destination: <strong>{ride.tourist_place || ride.city}</strong> • {ride.seating_capacity} Seats
                      </p>

                      <div className="flex items-center gap-4 mb-4 text-xs">
                        <div className="flex items-center gap-1 bg-gray-50 px-2.5 py-1 rounded-lg">
                          {renderStars(ride.ride_rating)}
                          <span className="font-bold text-gray-700 ml-1">{ride.ride_rating}</span>
                        </div>
                        <span className="text-emerald-600 font-semibold">{ride.availability}</span>
                      </div>

                      <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                        <span className="text-xs text-gray-500 font-medium">{ride.booking_type}</span>
                        <span className="text-xl font-extrabold text-gray-900">₹{ride.price.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                      <button
                        onClick={() => setActiveRideModal(ride)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-3 py-2.5 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FontAwesomeIcon icon={faEye} />
                        View Details
                      </button>

                      <button
                        onClick={() => onToggleRide(ride)}
                        className={`flex-1 font-bold px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A]'
                        }`}
                      >
                        {isSelected ? 'Booked ✓' : '+ Add Ride'}
                      </button>
                    </div>

                  </div>
                );
              })}

              {filteredRides.length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-gray-100">
                  <FontAwesomeIcon icon={faCarSide} className="text-gray-300 text-5xl mb-3" />
                  <h4 className="text-lg font-bold text-gray-800">No rides match your filter parameters</h4>
                  <p className="text-xs text-gray-400 mt-1">Try expanding your max price or clearing category filters.</p>
                </div>
              )}
            </div>
          )}

          {/* Bottom Nav */}
          <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
            <button
              onClick={onBack}
              className="px-6 py-3 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
              Back
            </button>

            <button
              onClick={onNext}
              className="px-8 py-3 bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <span>Next: Cafes & Restaurants ({selectedRides.length})</span>
              <FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>

        </main>

      </div>

      {/* Ride Details Modal */}
      {activeRideModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 flex flex-col">
            
            <div className="bg-[#121619] text-white p-6 relative">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4B15A] bg-white/10 px-2.5 py-1 rounded-md mb-1 inline-block">
                Ride ID: {activeRideModal.ride_id} • {activeRideModal.vehicle_category}
              </span>
              <h3 className="text-2xl font-bold text-white font-display">
                {activeRideModal.vehicle_model}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Destination: {activeRideModal.tourist_place}, {activeRideModal.city}, {activeRideModal.state}
              </p>

              <button 
                onClick={() => setActiveRideModal(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white bg-white/10 p-2 rounded-full cursor-pointer"
              >
                <FontAwesomeIcon icon={faXmark} className="text-lg" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs text-gray-700">
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px] block">Duration & Distance</span>
                  <span className="font-bold text-gray-900 text-sm">{activeRideModal.duration_hours} hrs • {activeRideModal.distance_covered_km} km</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px] block">Pickup & Drop</span>
                  <span className="font-bold text-gray-900 text-sm">{activeRideModal.pickup_location_type} → {activeRideModal.drop_location_type}</span>
                </div>
                <div>
                  <span className="text-gray-400 uppercase font-semibold text-[10px] block">Hotel Dropoff</span>
                  <span className="font-bold text-gray-900 text-sm">{activeRideModal.hotel_drop}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faUserTie} className="text-[#D4B15A]" /> Driver & Language
                  </h4>
                  <p><strong>Driver Included:</strong> {activeRideModal.driver_included}</p>
                  <p><strong>Driver Rating:</strong> {activeRideModal.driver_rating} ★</p>
                  <p><strong>Languages Spoken:</strong> {activeRideModal.driver_languages}</p>
                  <p><strong>Estimated Arrival:</strong> {activeRideModal.estimated_arrival}</p>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-2">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faGasPump} className="text-[#D4B15A]" /> Fuel & Extra Charges
                  </h4>
                  <p><strong>Fuel Included:</strong> {activeRideModal.fuel_included}</p>
                  <p><strong>Extra Km Charge:</strong> ₹{activeRideModal.extra_km_charge}/km</p>
                  <p><strong>Extra Hour Charge:</strong> ₹{activeRideModal.extra_hour_charge}/hr</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 text-sm mb-2">In-Ride Amenities</h4>
                <div className="flex flex-wrap gap-2">
                  {activeRideModal.charging_port.toLowerCase() === 'yes' && (
                    <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg font-semibold flex items-center gap-1">
                      <FontAwesomeIcon icon={faPlug} /> Charging Port
                    </span>
                  )}
                  {activeRideModal.music_system.toLowerCase() === 'yes' && (
                    <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg font-semibold flex items-center gap-1">
                      <FontAwesomeIcon icon={faMusic} /> Music System
                    </span>
                  )}
                  {activeRideModal.wifi.toLowerCase() === 'yes' && (
                    <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-lg font-semibold flex items-center gap-1">
                      <FontAwesomeIcon icon={faWifi} /> Free WiFi
                    </span>
                  )}
                  {activeRideModal.child_seat.toLowerCase() === 'yes' && (
                    <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg font-semibold flex items-center gap-1">
                      <FontAwesomeIcon icon={faChild} /> Child Seat
                    </span>
                  )}
                </div>
              </div>

            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setActiveRideModal(null)}
                className="px-5 py-2 bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={() => {
                  onToggleRide(activeRideModal);
                  setActiveRideModal(null);
                }}
                className={`px-6 py-2 font-bold text-xs rounded-xl cursor-pointer ${
                  selectedRides.some(r => r.ride_id === activeRideModal.ride_id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#121619] text-[#D4B15A]'
                }`}
              >
                {selectedRides.some(r => r.ride_id === activeRideModal.ride_id) ? 'Booked ✓' : '+ Add Ride'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

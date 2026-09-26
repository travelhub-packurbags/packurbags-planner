import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faStar, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import ReviewModal from '../components/global/ReviewModal';
import PDFSummaryGenerator from '../components/planner/PDFSummaryGenerator';
import SeatChartModal from '../components/global/SeatChartModal';
import { useUser, useClerk } from '@clerk/clerk-react';
import axios from 'axios';
import useAppStore from '../stores/useAppStore';
import HotelCard from '../components/global/HotelCard';

export default function BookingGrid() {
  const [searchParams] = useSearchParams();
  const type = searchParams.get('type') || 'hotels';
  const dest = searchParams.get('to')?.toLowerCase() || '';

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [priceRange, setPriceRange] = useState(50000);
  const [minStars, setMinStars] = useState(0);
  const [fssaiOnly, setFssaiOnly] = useState(false);

  // Modal & Booking
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmedPdfUrl, setConfirmedPdfUrl] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    
    // Process static imported data
    const fetchResults = async () => {
      try {
        let data = [];
        if (type === 'hotels') {
          const res = await fetch(`${import.meta.env.BASE_URL}data/hotels.json`);
          data = await res.json();
          // filter by destination
          if (dest) data = data.filter(h => h.city.toLowerCase() === dest);
        } else if (type === 'flight') {
          const res = await fetch(`${import.meta.env.BASE_URL}data/flights_demo.json`);
          const flightData = await res.json();
          const from = searchParams.get('from')?.toLowerCase() || '';
          
          // Find the route that matches from/to
          const route = flightData.find(r => 
            r.from.toLowerCase() === from && 
            r.to.toLowerCase() === dest
          );
          data = route ? route.flights : [];
        } else if (type === 'bus') {
          const res = await fetch(`${import.meta.env.BASE_URL}data/vendors.json`);
          const vendorData = await res.json();
          const from = searchParams.get('from')?.toLowerCase() || '';
          
          data = vendorData.filter(v => 
            v.from_city.toLowerCase() === from && 
            v.routes.some(r => r.toLowerCase().includes(dest))
          );
        }
        setResults(data);
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [type, dest]);

  // Apply filters
  const filtered = results.filter(item => {
    const price = item.price_per_night_inr || item.price_inr || item.price || (item.price_per_km ? item.price_per_km * 100 : 0);
    if (price > priceRange) return false;
    
    if (type === 'hotels') {
      if ((item.hotel_stars || 3) < minStars) return false;
    }
    return true;
  });

  const { user: clerkUser, isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const storeUser = useAppStore(state => state.user);
  const openLoginModal = useAppStore(state => state.openLoginModal);
  
  const user = clerkUser || storeUser;
  const isAuthed = isSignedIn || !!storeUser;

  const [isSeatChartOpen, setIsSeatChartOpen] = useState(false);
  const [selectedTransportItem, setSelectedTransportItem] = useState(null);

  const passengers = parseInt(searchParams.get('passengers')) || 1;

  const handleBookNow = (item) => {
    if (type === 'bus' || type === 'flight') {
      setSelectedTransportItem(item);
      setIsSeatChartOpen(true);
    } else {
      proceedToReview(item, []);
    }
  };

  const handleSeatConfirm = (seats) => {
    setIsSeatChartOpen(false);
    proceedToReview(selectedTransportItem, seats);
  };

  const handlePayment = async () => {
    if (!isAuthed) {
      openLoginModal();
      return;
    }

    if (!selectedBooking) return;

    setBookingLoading(true);
    try {
      const priceVal = selectedBooking.itemData.price_per_night_inr || selectedBooking.itemData.price_inr || selectedBooking.itemData.price || (selectedBooking.itemData.price_per_km ? selectedBooking.itemData.price_per_km * 100 : 0);
      const transportCost = priceVal * (selectedBooking.seats?.length || 1);

      const hotelId = searchParams.get('hotelId');
      const hotelName = searchParams.get('hotelName');
      const hotelPrice = parseInt(searchParams.get('hotelPrice')) || 0;

      let hotelData = null;
      let hotelTotal = 0;
      if (hotelId && type !== 'hotels') {
        const fromD = new Date(selectedBooking.fromDate);
        const toD = new Date(selectedBooking.toDate);
        const diffTime = Math.abs(toD - fromD);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
        hotelTotal = hotelPrice * diffDays;
        hotelData = {
          hotelId,
          name: hotelName,
          price_per_night_inr: hotelPrice,
          nights: diffDays,
          total_price_inr: hotelTotal
        };
      }

      const totalAmount = transportCost + hotelTotal;

      const bookingData = {
        userId: user?.id,
        email: user?.email || user?.primaryEmailAddress?.emailAddress || 'N/A',
        phone: user?.phone || user?.phoneNumbers?.[0]?.phoneNumber || 'N/A',
        name: user?.name || user?.fullName || user?.username || (user?.email || user?.primaryEmailAddress?.emailAddress || 'Passenger').split('@')[0],
        itemType: type,
        itemData: {
          ...selectedBooking.itemData,
          name: selectedBooking.vendorName,
          price_inr: transportCost,
          from: selectedBooking.from,
          to: selectedBooking.to,
          fromDate: selectedBooking.fromDate,
          toDate: selectedBooking.toDate,
          seats: selectedBooking.seats
        },
        hotelData
      };

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      console.log(`Sending booking request to backend: ${backendUrl}/api/book`);
      const res = await axios.post(`${backendUrl}/api/book`, bookingData);

      if (res.data && res.data.success) {
        setBookingConfirmed(true);
        setConfirmedPdfUrl(res.data.pdfUrl);
        // Show review modal after 2 seconds
        setTimeout(() => {
          setIsReviewOpen(true);
        }, 2000);
      } else {
        alert("Booking failed. Please try again.");
      }
    } catch (err) {
      console.error("Booking error:", err);
      alert("Error confirming booking: " + err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const proceedToReview = (item, seats) => {
    if (!isAuthed) {
      openLoginModal();
      return;
    }

    setBookingConfirmed(false);
    setConfirmedPdfUrl('');
    
    setSelectedBooking({
      id: `FF-${Math.floor(Math.random() * 10000)}`,
      type,
      vendorName: item.property_name || item.name || item.airline || item.vendor_id,
      hotelName: type === 'hotels' ? (item.property_name || item.name) : 'None',
      from: searchParams.get('from') || 'Origin',
      to: searchParams.get('to') || 'Destination',
      fromDate: searchParams.get('fromDate') || 'Today',
      toDate: searchParams.get('toDate') || 'Next Week',
      seats: seats,
      itemData: item
    });
  };

  const hotelId = searchParams.get('hotelId');
  const hotelName = searchParams.get('hotelName');
  const hotelPrice = parseInt(searchParams.get('hotelPrice')) || 0;

  let totalPrice = 0;
  if (selectedBooking) {
    const transportPrice = selectedBooking.itemData.price_per_night_inr || selectedBooking.itemData.price_inr || selectedBooking.itemData.price || (selectedBooking.itemData.price_per_km ? selectedBooking.itemData.price_per_km * 100 : 0);
    const transportTotal = transportPrice * (selectedBooking.seats?.length || 1);
    
    let hotelTotal = 0;
    if (hotelId && type !== 'hotels') {
      const fromD = new Date(selectedBooking.fromDate);
      const toD = new Date(selectedBooking.toDate);
      const diffTime = Math.abs(toD - fromD);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      hotelTotal = hotelPrice * diffDays;
    }
    totalPrice = transportTotal + hotelTotal;
  }

  return (
    <div className="pt-24 min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sticky Left Sidebar Filters */}
      <aside className="w-full md:w-72 bg-white border-r border-gray-200 p-6 md:sticky md:top-16 md:h-[calc(100vh-4rem)] overflow-y-auto shrink-0">
        <div className="flex items-center gap-2 text-gray-900 font-display font-bold text-lg mb-6">
          <FontAwesomeIcon icon={faFilter} className="text-[#FFAA00]" />
          Filters
        </div>

        <div className="space-y-8">
          {/* Price Slider */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Max Price: ₹{priceRange}
            </label>
            <input 
              type="range" 
              min="1000" 
              max="50000" 
              step="500"
              value={priceRange}
              onChange={e => setPriceRange(Number(e.target.value))}
              className="w-full accent-[#FFAA00]"
            />
          </div>

          {/* Hotel Specific Filters */}
          {type === 'hotels' && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Star Rating</label>
                <div className="flex gap-2">
                  {[3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setMinStars(minStars === star ? 0 : star)}
                      className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${
                        minStars === star 
                          ? 'bg-[#121619] text-[#FFAA00] border-[#121619]' 
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#FFAA00]'
                      }`}
                    >
                      {star} <FontAwesomeIcon icon={faStar} className="text-xs" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Health & Safety</label>
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={fssaiOnly}
                    onChange={e => setFssaiOnly(e.target.checked)}
                    className="w-4 h-4 text-[#FFAA00] border-gray-300 rounded focus:ring-[#FFAA00]"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    FSSAI Certified Only
                  </span>
                </label>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Right UI Panel: Results Stream */}
      <main className="flex-1 p-6 lg:p-10">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-[#121619] capitalize">
              {type} Results {dest && `for ${dest}`}
            </h1>
            <p className="text-gray-500 mt-2">{filtered.length} options found matching your criteria.</p>
          </div>
          
        </div>

        {/* Selected Booking Checkout Panel */}
        {selectedBooking && (
          <div className="mb-8 bg-white border border-[#D4B15A]/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#121619] via-[#D4B15A] to-[#121619]" />
            
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-xs font-bold text-[#D4B15A] uppercase tracking-widest bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
                  Selected Booking Review
                </span>
                <h2 className="text-2xl font-bold text-[#121619] mt-3">Confirm Your {type === 'hotels' ? 'Stay' : 'Journey'}</h2>
              </div>
              <button 
                onClick={() => { setSelectedBooking(null); setBookingConfirmed(false); }}
                className="text-gray-400 hover:text-gray-600 font-medium text-sm transition-colors cursor-pointer"
              >
                ✕ Cancel
              </button>
            </div>

            {/* Hotel stay sub-card */}
            {hotelId && type !== 'hotels' && (
              <div className="mb-6 p-4 bg-[#D4B15A]/10 border border-[#D4B15A]/20 rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-[#D4B15A] uppercase tracking-wider block mb-1">🏨 Accommodation reservation</span>
                  <p className="font-bold text-gray-900 text-sm">{hotelName}</p>
                  <p className="text-[11px] text-gray-500">Stay from {selectedBooking.fromDate} to {selectedBooking.toDate}</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-gray-900 text-sm">₹{hotelPrice.toLocaleString()} / night</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Details</p>
                <p className="font-bold text-gray-900 mt-1">{selectedBooking.vendorName}</p>
                {selectedBooking.seats && selectedBooking.seats.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Seats: {selectedBooking.seats.join(', ')}</p>
                )}
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Schedule</p>
                <p className="font-bold text-gray-900 mt-1">{selectedBooking.from} → {selectedBooking.to}</p>
                <p className="text-xs text-gray-500 mt-1">{selectedBooking.fromDate} to {selectedBooking.toDate}</p>
              </div>

              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Total Combined Price</p>
                  <p className="text-2xl font-extrabold text-gray-900 mt-0.5">
                    ₹{totalPrice.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {bookingConfirmed ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-800 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="font-bold">Booking Confirmed successfully!</p>
                    <p className="text-sm text-emerald-700">Check your email, WhatsApp, & SMS notifications.</p>
                  </div>
                </div>
                {confirmedPdfUrl && (
                  <a 
                    href={confirmedPdfUrl} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-sm shrink-0"
                  >
                    Download PDF Ticket 📄
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap gap-4 items-center">
                <button 
                  onClick={handlePayment}
                  disabled={bookingLoading}
                  className="bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold px-8 py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {bookingLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#D4B15A] border-t-transparent" />
                      Processing payment...
                    </>
                  ) : (
                    `Pay Now ₹${totalPrice.toLocaleString()}`
                  )}
                </button>
                <span className="text-xs text-gray-400">Secured via Razorpay/PhonePe Mock. By paying you agree to terms.</span>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#FFAA00]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filtered.map((item, idx) => {
              if (type === 'hotels') {
                return (
                  <HotelCard
                    key={idx}
                    hotel={item}
                    onSelect={(hotel) => handleBookNow(hotel)}
                    selectLabel="Book Stay"
                  />
                );
              }

              return (
                <div key={idx} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-xl transition-all border border-gray-100 flex flex-col sm:flex-row gap-6 group">
                  
                  {/* Image Section */}
                  <div className="sm:w-48 h-48 rounded-xl overflow-hidden shrink-0 relative bg-gray-100">
                    {item.images ? (
                      <img src={item.images[0]} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                    )}
                    {item.star_category && (
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded-lg flex items-center gap-1 text-[#FFAA00] text-xs font-bold">
                        {item.star_category} <FontAwesomeIcon icon={faStar} />
                      </div>
                    )}
                  </div>

                  {/* Content Section */}
                  <div className="flex-1 flex flex-col justify-between py-2">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="text-xl font-bold text-[#121619] leading-tight">
                          {item.name || item.airline || item.vendor_id}
                        </h3>
                        {item.fssai_certified && (
                          <span title="FSSAI Certified" className="text-green-500 text-lg">
                            <FontAwesomeIcon icon={faCheckCircle} />
                          </span>
                        )}
                      </div>
                      
                      {item.address && (
                        <p className="text-gray-500 text-sm mt-1 mb-3 line-clamp-1">{item.address}</p>
                      )}
                      
                      {item.amenities && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {item.amenities.slice(0, 4).map(am => (
                            <span key={am} className="text-[10px] uppercase tracking-wider font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                              {am}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-end justify-between mt-6">
                      <div>
                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Starting from</p>
                        <p className="text-2xl font-bold text-[#121619]">
                          ₹{(item.price_per_night_inr || item.price_inr || item.price || (item.price_per_km ? item.price_per_km * 100 : 0)).toLocaleString()}
                          <span className="text-sm font-normal text-gray-500"> {type === 'hotels' && '/ night'}</span>
                        </p>
                      </div>
                      <button onClick={() => handleBookNow(item)} className="bg-[#121619] hover:bg-[#1e2429] text-[#FFAA00] font-semibold px-6 py-2.5 rounded-xl transition-colors">
                        Book Now
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="text-gray-300 text-6xl mb-4">
                  <FontAwesomeIcon icon={faFilter} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">No results found</h3>
                <p className="text-gray-500">Try adjusting your filters or search criteria.</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Seat Selection Modal */}
      <SeatChartModal 
        isOpen={isSeatChartOpen} 
        onClose={() => setIsSeatChartOpen(false)} 
        type={type} 
        maxSeats={passengers} 
        onConfirm={handleSeatConfirm} 
      />

      {/* Review Modal Post-Checkout */}
      <ReviewModal isOpen={isReviewOpen} onClose={() => setIsReviewOpen(false)} />
    </div>
  );
}

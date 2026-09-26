import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilter, faStar } from '@fortawesome/free-solid-svg-icons';
import useAppStore from '../stores/useAppStore';
import HotelCard from '../components/global/HotelCard';

export default function SelectHotel() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const addToast = useAppStore(state => state.addToast);
  
  const dest = searchParams.get('dest') || 'Goa';
  const fromDate = searchParams.get('from') || '';
  const toDate = searchParams.get('to') || '';
  const travellers = searchParams.get('travellers') || 2;
  const mode = searchParams.get('mode') || 'flight';
  
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedHotel, setSelectedHotel] = useState(null);

  // Filters
  const [priceRange, setPriceRange] = useState(15000);
  const [minStars, setMinStars] = useState(0);

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/hotels.json`);
        const data = await res.json();
        
        // Filter by destination city
        const filteredHotels = data.filter(h => h.city.toLowerCase() === dest.trim().toLowerCase());
        setHotels(filteredHotels);
      } catch (err) {
        console.error('Failed to load hotels', err);
        addToast({ type: 'error', message: 'Could not load hotel inventory' });
      } finally {
        setLoading(false);
      }
    };
    fetchHotels();
  }, [dest]);

  // Apply UI Filters
  const filtered = hotels.filter(hotel => {
    const price = hotel.price_per_night_inr || hotel.price_inr || 0;
    if (price > priceRange) return false;
    if ((hotel.hotel_stars || 3) < minStars) return false;
    return true;
  });

  const handleSelectHotel = (hotel) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('hotelId', hotel.id);
    newParams.set('hotelName', hotel.property_name);
    newParams.set('hotelPrice', hotel.price_per_night_inr || 0);

    addToast({ 
      type: 'success', 
      title: 'Hotel Selected!', 
      message: `Selected ${hotel.property_name}. Now proceeding to book transport.` 
    });

    navigate(`/booking-grid?${newParams.toString()}`);
  };

  return (
    <div className="pt-24 min-h-screen bg-gray-50 flex flex-col md:flex-row pb-12">
      {/* Filters Sidebar */}
      <aside className="w-full md:w-72 bg-white border-r border-gray-200 p-6 md:sticky md:top-16 md:h-[calc(100vh-4rem)] overflow-y-auto shrink-0">
        <div className="flex items-center gap-2 text-gray-900 font-display font-bold text-lg mb-6">
          <FontAwesomeIcon icon={faFilter} className="text-[#D4B15A]" />
          Filters
        </div>

        <div className="space-y-8">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Max Price: ₹{priceRange.toLocaleString()} / night
            </label>
            <input 
              type="range" 
              min="1000" 
              max="25000" 
              step="500"
              value={priceRange}
              onChange={e => setPriceRange(Number(e.target.value))}
              className="w-full accent-[#D4B15A]"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">Star Rating</label>
            <div className="flex gap-2">
              {[3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setMinStars(minStars === star ? 0 : star)}
                  className={`px-3 py-1.5 rounded-lg text-sm border font-medium transition-colors ${
                    minStars === star 
                      ? 'bg-black text-[#D4B15A] border-black' 
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#D4B15A]'
                  }`}
                >
                  {star} <FontAwesomeIcon icon={faStar} className="text-xs" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 lg:p-10">
        <div className="mb-8">
          <span className="text-xs font-bold text-[#D4B15A] uppercase tracking-widest bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
            Step 2: Accommodations
          </span>
          <h1 className="text-3xl font-display font-bold text-[#121619] capitalize mt-3">
            Available Hotels in {dest}
          </h1>
          <p className="text-gray-500 mt-2">Pick your stay before choosing transport details.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4B15A]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {filtered.map((hotel) => (
              <HotelCard 
                key={hotel.id}
                hotel={hotel}
                onSelect={handleSelectHotel}
                selectLabel="Book Hotel"
              />
            ))}

            {filtered.length === 0 && (
              <div className="col-span-full py-20 text-center">
                <div className="text-gray-300 text-6xl mb-4">
                  <FontAwesomeIcon icon={faFilter} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">No hotels found</h3>
                <p className="text-gray-500">Try adjusting your filters or destination criteria.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

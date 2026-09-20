import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLandmark, 
  faHotel, 
  faCarSide, 
  faUtensils, 
  faPlane,
  faWandMagicSparkles, 
  faEdit, 
  faArrowLeft, 
  faWallet,
  faCamera,
  faCalendarCheck,
  faMoon,
  faListOl,
  faCompass,
  faLocationDot
} from '@fortawesome/free-solid-svg-icons';
import RouteMapPanel from './RouteMapPanel';
import { getSelectedImage, saveSelectedImage } from '../../services/supabaseStorage';
import { fetchWikipediaImage, fetchRestaurantImage } from '../../services/wikipedia';

const FALLBACK_PLACE_IMG = 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=600&q=80';
const FALLBACK_HOTEL_IMG = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80';
const FALLBACK_DINING_IMG = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80';


export default function Step6Review({ 
  wizardData, 
  scheduleData = {}, 
  calculateTotalCost, 
  onJumpToStep, 
  onConfirmGenerate, 
  loading,
  travellers = 2,
  validationError,
  onEditDates,
  onCaptureSnippet,
  fromCity = '',
  toCity = ''
}) {
  const totalCost = calculateTotalCost();
  const selectedPlaces = wizardData.selectedPlaces || [];
  const selectedHotels = wizardData.selectedHotels || [];
  const selectedRides = wizardData.selectedRides || [];
  const selectedRestaurants = wizardData.selectedRestaurants || [];
  const selectedCafes = wizardData.selectedCafes || [];
  const sortedHotels = [...selectedHotels].sort((a, b) => (a.stayOrder || 1) - (b.stayOrder || 1));

  const [wikiSpotImages, setWikiSpotImages] = useState({});
  const [diningImages, setDiningImages] = useState({});

  // Hit Wikipedia API to fetch authentic tourist spot images for the review & confirm page
  useEffect(() => {
    if (!selectedPlaces || selectedPlaces.length === 0) return;
    let isCancelled = false;

    const isGenericFallback = (url) => {
      if (!url) return true;
      if (url.includes('1596178065887')) return true; // Generic Unsplash pool/resort photo
      if (url === FALLBACK_PLACE_IMG) return true;
      return false;
    };

    selectedPlaces.forEach(async (place) => {
      const cached = getSelectedImage('place', place.id);

      if (!isGenericFallback(place.image)) {
        setWikiSpotImages(prev => ({ ...prev, [place.id]: place.image }));
        return;
      }
      if (!isGenericFallback(cached)) {
        setWikiSpotImages(prev => ({ ...prev, [place.id]: cached }));
        place.image = cached;
        return;
      }

      // Hit Wikipedia API for genuine tourist attraction photo
      try {
        const wikiUrl = await fetchWikipediaImage(place.name, place.city || toCity);
        if (!isCancelled && wikiUrl) {
          setWikiSpotImages(prev => ({ ...prev, [place.id]: wikiUrl }));
          saveSelectedImage('place', place.id, wikiUrl, { name: place.name, city: place.city });
          place.image = wikiUrl;
        }
      } catch (err) {
        console.warn(`[Wikipedia] Review failed to fetch image for ${place.name}:`, err);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedPlaces, toCity]);

  // Hit Wikimedia API for genuine dining photos
  useEffect(() => {
    const diningList = [...selectedRestaurants, ...selectedCafes];
    if (diningList.length === 0) return;
    let isCancelled = false;

    const isGenericFallback = (url) => {
      if (!url) return true;
      if (url.includes('1517248135467')) return true;
      if (url === FALLBACK_DINING_IMG) return true;
      return false;
    };

    diningList.forEach(async (item) => {
      const cached = getSelectedImage('dining', item.id) || getSelectedImage('restaurant', item.id) || getSelectedImage('cafe', item.id);

      if (!isGenericFallback(item.image)) {
        setDiningImages(prev => ({ ...prev, [item.id]: item.image }));
        return;
      }
      if (!isGenericFallback(cached)) {
        setDiningImages(prev => ({ ...prev, [item.id]: cached }));
        item.image = cached;
        return;
      }

      try {
        const img = await fetchRestaurantImage(item.name, item.city || toCity);
        if (!isCancelled && img) {
          setDiningImages(prev => ({ ...prev, [item.id]: img }));
          saveSelectedImage('dining', item.id, img, { name: item.name, city: item.city });
          item.image = img;
        }
      } catch (_) {}
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedRestaurants, selectedCafes, toCity]);

  const outboundPrice = wizardData.outboundTransport?.price ?? 4000;
  const returnPrice = wizardData.returnTransport?.price ?? 4000;

  const outboundTotal = outboundPrice * travellers;
  const returnTotal = returnPrice * travellers;
  const spotsTotal = selectedPlaces.reduce((sum, p) => sum + (p.entrance_fee_inr || 0) * travellers, 0);
  const hotelsTotal = sortedHotels.reduce((sum, h) => sum + ((h.price_per_night_inr || h.price_inr || 0) * (h.nights || 1) * (h.rooms || 1)), 0);
  const ridesTotal = selectedRides.reduce((sum, r) => sum + (r.price || 0), 0);
  const cafesTotal = selectedCafes.reduce((sum, c) => sum + (c.rate_for_two || 500) * Math.ceil((c.seats || 2) / 2), 0);
  const restTotal = selectedRestaurants.reduce((sum, r) => sum + (r.price || 400) * Math.ceil((r.seats || 2) / 2), 0);
  const diningTotal = cafesTotal + restTotal;

  return (
    <div className="w-full p-4 sm:p-6">
      
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-xs font-bold text-[#f97316] uppercase tracking-widest bg-orange-50 px-3.5 py-1 rounded-full border border-orange-200/80">
          Step 6: Review &amp; Confirm Preferences
        </span>
        <h2 className="text-3xl font-display font-extrabold text-gray-900 mt-2">
          Confirm Your Customized Trip Preferences
        </h2>
        <p className="text-gray-500 text-xs mt-1">
          Review your scheduled spots, multi-hotel stays, ground rides, and dining reservations for {travellers} traveller{travellers > 1 ? 's' : ''}.
        </p>
      </div>

      {/* Grand Total Spending Banner */}
      <div className="bg-gradient-to-r from-[#121619] via-gray-900 to-[#121619] text-white p-6 rounded-3xl shadow-xl border border-amber-500/20 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-[#D4B15A] text-xl">
            <FontAwesomeIcon icon={faWallet} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Total Estimated Spending ({travellers} Travellers)</p>
            <h3 className="text-3xl font-black text-white">₹{totalCost.toLocaleString('en-IN')}</h3>
          </div>
        </div>

        <button
          onClick={onConfirmGenerate}
          disabled={loading}
          className="w-full sm:w-auto bg-[#f97316] hover:bg-[#ea580c] text-white font-extrabold px-8 py-3.5 rounded-2xl transition-all shadow-lg hover:scale-105 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              <span>Generating Custom Itinerary...</span>
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faWandMagicSparkles} />
              <span>CONFIRM &amp; GENERATE ITINERARY</span>
            </>
          )}
        </button>
      </div>

      {/* Validation Error Block */}
      {validationError && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-red-800 font-bold text-lg mb-1">⚠️ Trip Duration Error</h4>
            <p className="text-red-700 text-sm font-medium">{validationError}</p>
          </div>
          <button 
            onClick={onEditDates}
            className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Edit Trip Dates
          </button>
        </div>
      )}

      {/* Interactive OpenRouteService Routing & Google Places Search Panel */}
      <RouteMapPanel 
        initialStops={selectedPlaces} 
        onCaptureSnippet={onCaptureSnippet}
        fromCity={fromCity}
        toCity={toCity}
        restaurants={selectedRestaurants}
      />

      {/* Itemized Calculation Sub-Totals Breakdown Box */}
      <div className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm mb-8">
        <h4 className="text-xs font-extrabold uppercase text-gray-700 tracking-wider mb-3 flex items-center gap-2">
          <FontAwesomeIcon icon={faListOl} className="text-[#f97316]" /> Itemized Total Calculation Summary ({travellers} Travellers)
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-semibold block">Outbound Transport</span>
            <span className="font-extrabold text-gray-900 text-xs">₹{outboundTotal.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-gray-400 block">({travellers} × ₹{outboundPrice.toLocaleString('en-IN')})</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-semibold block">Return Transport</span>
            <span className="font-extrabold text-gray-900 text-xs">₹{returnTotal.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-gray-400 block">({travellers} × ₹{returnPrice.toLocaleString('en-IN')})</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-semibold block">Tourist Spot Fees</span>
            <span className="font-extrabold text-gray-900 text-xs">₹{spotsTotal.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-gray-400 block">({travellers} Travellers)</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-semibold block">Hotel Stays</span>
            <span className="font-extrabold text-gray-900 text-xs">₹{hotelsTotal.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-gray-400 block">({sortedHotels.length} Properties)</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-semibold block">Ground Rides</span>
            <span className="font-extrabold text-gray-900 text-xs">₹{ridesTotal.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-gray-400 block">({selectedRides.length} Bookings)</span>
          </div>
          <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100">
            <span className="text-[10px] text-gray-400 font-semibold block">Dining Reservations</span>
            <span className="font-extrabold text-gray-900 text-xs">₹{diningTotal.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-gray-400 block">({selectedRestaurants.length + selectedCafes.length} Slots)</span>
          </div>
        </div>
      </div>

      {/* Summary Sections */}
      <div className="space-y-6 mb-8">
        
        {/* Section 0: Intercity Transport Tickets */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <FontAwesomeIcon icon={faPlane} className="text-[#f97316]" />
              Intercity Transport Tickets ({travellers} Travellers)
            </h3>
            <button 
              onClick={() => onJumpToStep(2)}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50/70 hover:bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
            >
              <FontAwesomeIcon icon={faEdit} /> Edit Tickets
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Outbound */}
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200/60">
                  Outbound Ticket (Day 1)
                </span>
                <h4 className="font-bold text-gray-900 mt-1">
                  {wizardData.outboundTransport ? `${wizardData.outboundTransport.operator} (${wizardData.outboundTransport.type.toUpperCase()})` : 'Default Economy Transport'}
                </h4>
                <p className="text-gray-500 text-[11px]">
                  {wizardData.outboundTransport ? `${wizardData.outboundTransport.depTime} - ${wizardData.outboundTransport.arrTime}` : 'Standard schedule'}
                </p>
                <span className="text-[10px] text-gray-400 block mt-0.5">₹{outboundPrice.toLocaleString('en-IN')} / seat × {travellers} travellers</span>
              </div>
              <div className="text-right">
                <span className="text-base font-extrabold text-gray-900">
                  ₹{outboundTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* Return */}
            <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 flex justify-between items-center">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200/60">
                  Return Ticket (Last Day)
                </span>
                <h4 className="font-bold text-gray-900 mt-1">
                  {wizardData.returnTransport ? `${wizardData.returnTransport.operator} (${wizardData.returnTransport.type.toUpperCase()})` : 'Default Economy Transport'}
                </h4>
                <p className="text-gray-500 text-[11px]">
                  {wizardData.returnTransport ? `${wizardData.returnTransport.depTime} - ${wizardData.returnTransport.arrTime}` : 'Standard schedule'}
                </p>
                <span className="text-[10px] text-gray-400 block mt-0.5">₹{returnPrice.toLocaleString('en-IN')} / seat × {travellers} travellers</span>
              </div>
              <div className="text-right">
                <span className="text-base font-extrabold text-gray-900">
                  ₹{returnTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Scheduled Spots (Matching review1.jpeg) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#f97316] text-xs">
                <FontAwesomeIcon icon={faCompass} />
              </span>
              <span>Scheduled Tourist Hubs ({selectedPlaces.length})</span>
            </h3>
            <button 
              onClick={() => onJumpToStep(3)}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50/70 hover:bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>Edit Spots &amp; Schedule</span>
            </button>
          </div>

          {selectedPlaces.length === 0 ? (
            <p className="text-xs text-gray-400">No tourist hubs selected. AI will auto-select spots.</p>
          ) : (
            <div className="space-y-3">
              {selectedPlaces.map(p => {
                const sched = scheduleData[p.id] || { day: 'Day 1', timeSlot: 'Morning' };
                const spotTotal = (p.entrance_fee_inr || 0) * travellers;
                const isGenericFallback = (url) => !url || url.includes('1596178065887') || url === FALLBACK_PLACE_IMG;
                const cachedImg = getSelectedImage('place', p.id);
                const placeImg = wikiSpotImages[p.id] || 
                  (!isGenericFallback(p.image) ? p.image : null) || 
                  (!isGenericFallback(cachedImg) ? cachedImg : null) || 
                  FALLBACK_PLACE_IMG;
                const isRealWiki = Boolean(
                  wikiSpotImages[p.id] || 
                  (placeImg && !isGenericFallback(placeImg) && (placeImg.includes('wikimedia') || placeImg.includes('wikipedia')))
                );

                return (
                  <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:border-orange-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden shrink-0 shadow-xs border border-gray-100 bg-gray-100">
                        <img
                          src={placeImg}
                          alt={p.name}
                          crossOrigin="anonymous"
                          className="w-full h-full object-cover transition-all duration-300"
                          onError={(e) => { e.target.src = FALLBACK_PLACE_IMG; }}
                        />
                        {isRealWiki && (
                          <span className="absolute bottom-1 right-1 bg-black/65 backdrop-blur-xs text-[9px] text-white px-1.5 py-0.5 rounded font-bold shadow-xs">
                            Wiki
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold uppercase text-[#f97316] bg-orange-50 border border-orange-200/60 px-2.5 py-0.5 rounded-md inline-block mb-1.5">
                          {sched.day.toUpperCase()} • {sched.timeSlot.toUpperCase()}
                        </span>
                        <h4 className="font-bold text-gray-900 text-base leading-snug line-clamp-1">{p.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 line-clamp-1">
                          <span className="text-rose-500">📍</span> <span>{p.city}, {p.state || p.city}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                      <span className="text-xl font-black text-gray-900 block">
                        ₹{spotTotal.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-400 block mt-0.5">
                        {p.entrance_fee_inr > 0 ? `Fee: ₹${p.entrance_fee_inr} / person (${travellers} travellers)` : 'Free Entry'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Multi-Hotel Stays Sequence (Matching review1.jpeg) */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#f97316] text-xs">
                <FontAwesomeIcon icon={faHotel} />
              </span>
              <span>Accommodations Stay Sequence ({sortedHotels.length})</span>
            </h3>
            <button 
              onClick={() => onJumpToStep(4)}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50/70 hover:bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>Edit Hotels</span>
            </button>
          </div>

          {sortedHotels.length === 0 ? (
            <p className="text-xs text-gray-400">No hotel selected. AI will suggest standard hotels.</p>
          ) : (
            <div className="space-y-3">
              {sortedHotels.map((h, idx) => {
                const stayTotal = (h.price_per_night_inr || h.price_inr || 0) * (h.nights || 1) * (h.rooms || 1);
                const hotelImg = h.image || (h.images && h.images[0]) || getSelectedImage('hotel', h.id) || FALLBACK_HOTEL_IMG;

                return (
                  <div key={h.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:border-orange-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={hotelImg}
                        alt={h.property_name || h.name}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 shadow-xs border border-gray-100"
                        onError={(e) => { e.target.src = FALLBACK_HOTEL_IMG; }}
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold text-[#f97316] bg-orange-50 border border-orange-200/60 px-2.5 py-0.5 rounded-md inline-block mb-1.5">
                          {h.nights || 1} Night(s) • {h.rooms || 1} Room(s)
                        </span>
                        <h4 className="font-bold text-gray-900 text-base leading-snug line-clamp-1">{h.property_name || h.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 line-clamp-1">
                          <span className="text-rose-500">📍</span> <span>{h.address || h.city}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                      <span className="text-xl font-black text-gray-900 block">
                        ₹{stayTotal.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-400 block mt-0.5">
                        ₹{(h.price_per_night_inr || h.price_inr || 0).toLocaleString('en-IN')} / night
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Multi-Ride Bookings */}
        {selectedRides.length > 0 && (
          <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <FontAwesomeIcon icon={faCarSide} className="text-[#f97316]" />
                Booked Transport Rides ({selectedRides.length})
              </h3>
              <button 
                onClick={() => onJumpToStep(4)}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50/70 hover:bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
              >
                <FontAwesomeIcon icon={faEdit} /> Edit Rides
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {selectedRides.map(r => (
                <div key={r.ride_id || r.id} className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200/60">
                      {r.vehicle_category} • {r.booking_type}
                    </span>
                    <h4 className="font-bold text-gray-900 text-sm mt-1">{r.vehicle_model}</h4>
                    <p className="text-gray-500">📍 Destination: {r.tourist_place || r.city}</p>
                  </div>
                  <span className="text-base font-extrabold text-gray-900">
                    ₹{(r.price || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Chosen Restaurants */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#f97316] text-xs">
                <FontAwesomeIcon icon={faUtensils} />
              </span>
              <span>Chosen Restaurants ({selectedRestaurants.length + selectedCafes.length})</span>
            </h3>
            <button 
              onClick={() => onJumpToStep(5)}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50/70 hover:bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>Edit Restaurants</span>
            </button>
          </div>

          {(selectedRestaurants.length === 0 && selectedCafes.length === 0) ? (
            <p className="text-xs text-gray-400">No restaurants chosen yet. AI will curate dining spots.</p>
          ) : (
            <div className="space-y-3">
              {selectedRestaurants.map(r => {
                const restCost = (r.price || 400) * Math.ceil((r.seats || 2) / 2);
                const isGenericFallback = (url) => !url || url.includes('1517248135467') || url === FALLBACK_DINING_IMG;
                const cachedImg = getSelectedImage('dining', r.id) || getSelectedImage('restaurant', r.id);
                const restImg = diningImages[r.id] || 
                  (!isGenericFallback(r.image) ? r.image : null) || 
                  (!isGenericFallback(cachedImg) ? cachedImg : null) || 
                  FALLBACK_DINING_IMG;

                return (
                  <div key={r.bookingId || r.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:border-orange-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={restImg}
                        alt={r.name}
                        crossOrigin="anonymous"
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 shadow-xs border border-gray-100"
                        onError={(e) => { e.target.src = FALLBACK_DINING_IMG; }}
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold text-[#f97316] bg-orange-50 border border-orange-200/60 px-2.5 py-0.5 rounded-md inline-block mb-1.5">
                          CHOSEN DINING
                        </span>
                        <h4 className="font-bold text-gray-900 text-base leading-snug line-clamp-1">{r.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 line-clamp-1">
                          <span className="text-rose-500">📍</span> <span>{r.address || r.locality || r.city} • {r.cuisines || r.cuisine || 'North Indian • Mughlai • BBQ'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                      <span className="text-xl font-black text-gray-900 block">
                        ₹{restCost.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-400 block mt-0.5">
                        Est. for {r.seats || 2} travellers
                      </span>
                    </div>
                  </div>
                );
              })}

              {selectedCafes.map(c => {
                const cafeCost = (c.rate_for_two || 500) * Math.ceil((c.seats || 2) / 2);
                const isGenericFallback = (url) => !url || url.includes('1517248135467') || url === FALLBACK_DINING_IMG;
                const cachedImg = getSelectedImage('dining', c.id) || getSelectedImage('cafe', c.id);
                const cafeImg = diningImages[c.id] || 
                  (!isGenericFallback(c.image) ? c.image : null) || 
                  (!isGenericFallback(cachedImg) ? cachedImg : null) || 
                  FALLBACK_DINING_IMG;

                return (
                  <div key={c.bookingId || c.id} className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm hover:border-orange-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <img
                        src={cafeImg}
                        alt={c.name}
                        crossOrigin="anonymous"
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 shadow-xs border border-gray-100"
                        onError={(e) => { e.target.src = FALLBACK_DINING_IMG; }}
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold text-[#f97316] bg-orange-50 border border-orange-200/60 px-2.5 py-0.5 rounded-md inline-block mb-1.5">
                          CAFE • {c.timeSlot || 'Afternoon'}
                        </span>
                        <h4 className="font-bold text-gray-900 text-base leading-snug line-clamp-1">{c.name}</h4>
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 line-clamp-1">
                          <span className="text-rose-500">📍</span> <span>{c.address || c.locality || c.city} • Coffee &amp; Desserts</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                      <span className="text-xl font-black text-gray-900 block">
                        ₹{cafeCost.toLocaleString('en-IN')}
                      </span>
                      <span className="text-xs text-gray-400 block mt-0.5">
                        Price for {c.seats || 2}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Nav */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          onClick={() => onJumpToStep(5)}
          className="px-6 py-3 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          <span>Back to Dining</span>
        </button>

        <button
          onClick={onConfirmGenerate}
          disabled={loading}
          className="px-8 py-3 bg-[#f97316] hover:bg-[#ea580c] text-white font-extrabold rounded-xl text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} />
          <span>{loading ? 'Generating...' : 'CONFIRM & GENERATE ITINERARY'}</span>
        </button>
      </div>

    </div>
  );
}

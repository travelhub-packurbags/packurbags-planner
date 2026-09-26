import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFilter, faStar, faSearch, faArrowRight, faArrowLeft, faHotel, faXmark,
  faMoon, faListOl, faChevronLeft, faChevronRight, faCheck, faHeart, faSpinner, faCircle, faRotateRight,
} from '@fortawesome/free-solid-svg-icons';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

function LiveSignalBadge({ isLive, loading }) {
  if (loading) return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
      <FontAwesomeIcon icon={faSpinner} spin className="text-amber-500" /> Fetching Live Hotels...
    </span>
  );
  if (isLive) return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
      </span>
      DSA Live Data
    </span>
  );
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-[10px] font-bold">
      <FontAwesomeIcon icon={faCircle} className="text-rose-400 text-[8px]" /> Local Dataset
    </span>
  );
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
];

function HotelCarousel({ images = [], hotelName }) {
  const [idx, setIdx] = useState(0);
  const [wishlist, setWishlist] = useState(false);
  const imgs = images.length > 0 ? images : FALLBACK_IMAGES.slice(0, 3);
  const prev = (e) => { e.stopPropagation(); setIdx((i) => (i === 0 ? imgs.length - 1 : i - 1)); };
  const next = (e) => { e.stopPropagation(); setIdx((i) => (i === imgs.length - 1 ? 0 : i + 1)); };
  return (
    <div className="relative w-full h-52 sm:h-full sm:w-64 shrink-0 rounded-t-2xl sm:rounded-l-2xl sm:rounded-tr-none overflow-hidden bg-gray-100 group">
      <img src={imgs[idx]} alt={hotelName} className="w-full h-full object-cover transition-all duration-500" onError={(e) => { e.target.src = FALLBACK_IMAGES[0]; }} />
      {imgs.length > 1 && (
        <>
          <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-gray-700 text-xs shadow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><FontAwesomeIcon icon={faChevronLeft} /></button>
          <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-gray-700 text-xs shadow opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><FontAwesomeIcon icon={faChevronRight} /></button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {imgs.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }} className={`h-1.5 rounded-full transition-all cursor-pointer bg-white ${i === idx ? 'w-3' : 'w-1.5 opacity-50'}`} />
            ))}
          </div>
        </>
      )}
      <button onClick={(e) => { e.stopPropagation(); setWishlist(w => !w); }} className="absolute top-3 right-3 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-sm shadow cursor-pointer transition-colors">
        <FontAwesomeIcon icon={faHeart} className={wishlist ? 'text-rose-500' : 'text-gray-300 hover:text-gray-500'} />
      </button>
    </div>
  );
}

function HotelCard({ hotel, isSelected, onSelect, stayOrder, onRemove, onUpdateConfig }) {
  const price = hotel.price_per_night_inr || hotel.price_inr || 0;
  const stars = hotel.hotel_stars || 3;
  const ratingNum = hotel.rating || (hotel.hotel_stars ? `${hotel.hotel_stars}.0` : '4.2');
  const reviewCount = hotel.reviews_count || hotel.reviews || 240 + ((hotel.id || 1) * 37) % 300;
  const inclusions = hotel.facilities?.length > 0 ? hotel.facilities : ['Free Breakfast', 'Free Wi-Fi', 'AC Rooms'];
  const images = hotel.images || (hotel.image ? [hotel.image, ...FALLBACK_IMAGES.slice(0,3)] : FALLBACK_IMAGES.slice(0,4));

  return (
    <div className={`flex flex-col sm:flex-row bg-white rounded-2xl border overflow-hidden transition-all shadow-sm hover:shadow-md ${isSelected ? 'border-[#f97316] ring-2 ring-[#f97316]/30' : 'border-gray-200 hover:border-gray-300'}`}>
      <HotelCarousel images={images} hotelName={hotel.property_name || hotel.name} />
      <div className="flex flex-1 flex-col sm:flex-row p-4 sm:p-5 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-bold text-gray-900 text-base leading-snug line-clamp-1">
              {hotel.property_name || hotel.name}
            </h3>
            <span className="shrink-0 inline-flex items-center gap-1 bg-amber-50 border border-amber-200/90 text-amber-900 text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-2xs">
              <FontAwesomeIcon icon={faStar} className="text-amber-500 text-[10px]" />
              <span>{ratingNum}</span>
              <span className="text-amber-700/60 font-normal">({reviewCount})</span>
            </span>
          </div>

          <p className="text-xs text-gray-500 mb-2.5 flex items-center gap-1 line-clamp-1">
            <span>📍</span> <span>{hotel.address || hotel.city}</span>
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
            {hotel.routeCity && (
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-md">
                📍 {hotel.routeCity}
              </span>
            )}
            {hotel.hotelCategory && (
              <span className="text-[10px] font-extrabold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md uppercase tracking-wider border border-gray-200">
                {hotel.hotelCategory}
              </span>
            )}
            <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md uppercase tracking-wider border border-gray-200">
              {hotel.roomType || 'REGULAR'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600 mb-2">
            <span className="flex items-center gap-1 text-indigo-700 font-medium text-[11px]">
              <span className="text-indigo-500">✓</span> {hotel.room_name || 'Deluxe Room'}
            </span>
            {inclusions.slice(0, 3).map((inc, i) => (
              <span key={i} className="flex items-center gap-1 text-gray-600 text-[11px]">
                <span className="text-emerald-500 text-[10px]">✓</span> {inc}
              </span>
            ))}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
              <span className="text-emerald-500">✓</span> Room Only
            </span>
            {hotel.source === 'DSA' && (
              <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                ✓ LIVE
              </span>
            )}
          </div>
        </div>

        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between shrink-0 sm:w-40 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4">
          <div className="text-right">
            <span className="text-[10px] text-gray-400 block font-medium">From</span>
            {price > 0 ? (
              <>
                <span className="text-xl font-extrabold text-gray-900 block leading-none">
                  ₹{price.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-gray-400 block mt-0.5">per room / night</span>
              </>
            ) : (
              <span className="text-sm font-bold text-orange-600">Price on Request</span>
            )}
            <span className="text-[9px] text-gray-400 block mt-0.5">Inclusive of taxes</span>
          </div>

          {isSelected ? (
            <div className="flex flex-col gap-1.5 mt-2 w-full">
              <span className="text-[10px] text-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                ✓ Stay #{stayOrder}
              </span>
              <div className="flex gap-1">
                <select
                  onClick={e => e.stopPropagation()}
                  value={hotel.nights || 1}
                  onChange={e => onUpdateConfig(hotel.id, hotel.stayOrder || stayOrder, parseInt(e.target.value), hotel.rooms || 1)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] px-1 py-1 outline-none font-bold cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 7].map(n => <option key={n} value={n}>{n}N</option>)}
                </select>
                <select
                  onClick={e => e.stopPropagation()}
                  value={hotel.rooms || 1}
                  onChange={e => onUpdateConfig(hotel.id, hotel.stayOrder || stayOrder, hotel.nights || 1, parseInt(e.target.value))}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] px-1 py-1 outline-none font-bold cursor-pointer"
                >
                  {[1, 2, 3, 4].map(r => <option key={r} value={r}>{r}R</option>)}
                </select>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onRemove(hotel); }}
                className="text-[10px] font-bold text-rose-500 hover:text-rose-700 text-center cursor-pointer underline"
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onSelect(hotel); }}
              className="mt-2 w-full bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all cursor-pointer text-center shadow-sm hover:shadow-md"
            >
              View Rooms →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Filter Panel Subcomponent (Matches Image 2) ──────────────────────────────────
function FilterPanelContent({
  searchName,
  setSearchName,
  priceRange,
  setPriceRange,
  selectedStars,
  toggleStar,
  starCounts,
  inclFilter,
  setInclFilter,
  cityList,
  cityFilter,
  setCityFilter,
  hotelsCount,
  filteredCount,
  onClearAll,
  onClose,
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#f97316]">
            <FontAwesomeIcon icon={faFilter} className="text-sm" />
          </div>
          <h3 className="font-extrabold text-gray-900 text-base">Filters</h3>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onClearAll}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer transition-colors"
          >
            Clear All
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
            title="Close filters"
          >
            <FontAwesomeIcon icon={faXmark} className="text-sm" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-6 pt-4 flex-1 overflow-y-auto pr-1">
        {/* SEARCH BY NAME */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            SEARCH BY NAME
          </label>
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Hotel or area..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-medium outline-none focus:border-orange-500 focus:bg-white transition-all shadow-2xs"
            />
            {searchName && (
              <button
                onClick={() => setSearchName('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            )}
          </div>
        </div>

        {/* PRICE PER NIGHT */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              PRICE PER NIGHT
            </label>
            <span className="text-xs font-extrabold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200/60">
              ₹{priceRange >= 20000 ? '20,000+' : priceRange.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 font-semibold mb-1">
            <span>₹0</span>
            <span>₹20,000+</span>
          </div>
          <input
            type="range"
            min="1000"
            max="20000"
            step="500"
            value={priceRange}
            onChange={e => setPriceRange(Number(e.target.value))}
            className="w-full accent-orange-500 cursor-pointer h-1.5 bg-gray-200 rounded-lg"
          />
          <div className="mt-2 flex items-end gap-1 h-7">
            {[15, 30, 55, 80, 95, 90, 70, 50, 30, 15].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className={`flex-1 rounded-sm transition-colors ${
                  (i + 1) / 10 <= priceRange / 20000 ? 'bg-orange-500' : 'bg-orange-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* STAR RATING (Image 2 Checkbox rows) */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">
            STAR RATING
          </label>
          <div className="space-y-1.5">
            {starCounts.map(({ stars, count }) => {
              const isChecked = selectedStars.includes(stars);
              return (
                <div
                  key={stars}
                  onClick={() => toggleStar(stars)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-orange-50/50 border-orange-300 shadow-2xs'
                      : 'bg-white border-gray-150 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center text-[9px] border transition-colors ${
                        isChecked
                          ? 'bg-orange-500 border-orange-500 text-white'
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      {isChecked && <FontAwesomeIcon icon={faCheck} />}
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <div className="flex items-center text-amber-400 text-[11px]">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <FontAwesomeIcon
                            key={i}
                            icon={faStar}
                            className={i < stars ? 'text-amber-400' : 'text-gray-200'}
                          />
                        ))}
                      </div>
                      <span className="font-bold text-gray-700 text-xs ml-1">
                        {stars} Star{stars > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* INCLUSIONS */}
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
            INCLUSIONS
          </label>
          <div className="space-y-1.5">
            {[
              { id: 'all', label: 'All Inclusions' },
              { id: 'breakfast', label: 'Free Breakfast' },
              { id: 'room_only', label: 'Room Only' }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setInclFilter(opt.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  inclFilter === opt.id
                    ? 'bg-[#121619] text-[#D4B15A] border-[#121619]'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>{opt.label}</span>
                {opt.id === 'breakfast' && <span className="text-[10px] text-emerald-600 font-bold">Popular</span>}
              </button>
            ))}
          </div>
        </div>

        {/* ROUTE CITIES (if multi-city) */}
        {cityList.length > 1 && (
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
              🗺️ ROUTE CITY
            </label>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setCityFilter('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  cityFilter === 'all'
                    ? 'bg-[#121619] text-[#D4B15A] border-[#121619]'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span>All Cities</span>
                <span className="text-[10px] opacity-70">{hotelsCount}</span>
              </button>
              {cityList.map(city => (
                <button
                  key={city}
                  type="button"
                  onClick={() => setCityFilter(cityFilter === city ? 'all' : city)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    cityFilter === city
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <span>{city}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Apply */}
      <div className="pt-4 border-t border-gray-100 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="w-full bg-[#121619] hover:bg-[#1e2429] text-white font-bold py-3 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Show {filteredCount} Hotels</span>
        </button>
      </div>
    </div>
  );
}

// ── Step 3 Hotels Main Component ────────────────────────────────────────────────
export default function Step3Hotels({
  destination,
  fromDate,
  toDate,
  totalDays = 3,
  travellers = 2,
  selectedHotels = [],
  onToggleHotel,
  onUpdateHotelConfig,
  onNext,
  onBack,
}) {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dsaSource, setDsaSource] = useState(false);

  // Filters State
  const [showFilters, setShowFilters] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [priceRange, setPriceRange] = useState(20000);
  const [selectedStars, setSelectedStars] = useState([]);
  const [inclFilter, setInclFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [cityFilter, setCityFilter] = useState('all');

  // DOM Target for gliding over LiveRouteCard
  const [targetEl, setTargetEl] = useState(null);
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  const cityList = useMemo(() => {
    return typeof destination === 'string'
      ? destination.split(',').map(c => c.trim()).filter(Boolean)
      : (Array.isArray(destination) ? destination : ['Delhi']);
  }, [destination]);

  useEffect(() => {
    const el = document.getElementById('live-route-overlay-target');
    if (el) setTargetEl(el);

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
      const target = document.getElementById('live-route-overlay-target');
      if (target) setTargetEl(target);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowFilters(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchHotels = useCallback(async () => {
    setLoading(true); setDsaSource(false);

    const checkIn = fromDate || new Date().toISOString().split('T')[0];
    const nights = totalDays || 1;
    const checkOutDate = new Date(checkIn);
    checkOutDate.setDate(checkOutDate.getDate() + nights);
    const checkOut = toDate || checkOutDate.toISOString().split('T')[0];

    const FALLBACK_IMAGES_INITIAL = [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80',
    ];

    try {
      const localRes = await fetch(`${import.meta.env.BASE_URL}data/hotels.json`);
      const localData = await localRes.json();
      let initHotels = [];
      cityList.forEach(city => {
        const cl = city.toLowerCase();
        let cityH = localData.filter(h => (h.city||'').toLowerCase().includes(cl) || cl.includes((h.city||'').toLowerCase()));
        if (!cityH.length) cityH = localData.slice(0, 20);
        initHotels = initHotels.concat(cityH.slice(0, 30).map(h => ({
          ...h, routeCity: city,
          images: h.image ? [h.image, ...FALLBACK_IMAGES_INITIAL.slice(0,2)] : FALLBACK_IMAGES_INITIAL,
          hotelCategory: h.hotel_category || 'HOTEL', roomType: h.room_type || 'Standard Room',
        })));
      });
      setHotels(initHotels);
      setDsaSource(false);
      setLoading(false);
    } catch (_) {}

    // Try DSA API
    let allDsaHotels = [];
    let anyDsaLive = false;
    try {
      for (const city of cityList) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          const res = await fetch(`${BACKEND_URL}/api/planner/dsa/hotels/search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, checkIn, checkOut, rooms: 1, adults: travellers || 2, nights }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          const data = await res.json();
          if (data?.success && data?.results?.length > 0) {
            const tagged = data.results.map(h => ({ ...h, routeCity: city }));
            allDsaHotels = allDsaHotels.concat(tagged);
            if (data.source === 'DSA') anyDsaLive = true;
            setHotels(prev => {
              const existingIds = new Set(prev.filter(h => h.source === 'DSA').map(h => h.id));
              const newLive = tagged.filter(h => !existingIds.has(h.id));
              const rest = prev.filter(h => (h.routeCity || '').toLowerCase() !== city.toLowerCase());
              return [...newLive, ...rest];
            });
            setDsaSource(s => s || data.source === 'DSA');
          }
        } catch (err) {
          if (err.name !== 'AbortError') console.warn(`DSA hotel fetch failed for ${city}:`, err.message);
        }
      }
    } catch (e) {
      console.warn('DSA multi-city hotel fetch wrapper failed:', e.message);
    }

    if (allDsaHotels.length > 0) {
      setHotels(allDsaHotels);
      setDsaSource(anyDsaLive);
      return;
    }

    // Fallback: local dataset
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}data/hotels.json`);
      const data = await res.json();
      let merged = [];
      cityList.forEach(city => {
        const cityLower = city.toLowerCase();
        let cityHotels = data.filter(h => {
          const c = (h.city || '').toLowerCase();
          const a = (h.address || '').toLowerCase();
          return c.includes(cityLower) || cityLower.includes(c) || a.includes(cityLower);
        });
        if (cityHotels.length === 0 && cityList.length === 1) {
          cityHotels = data.slice(0, 30);
        }
        merged = merged.concat(
          cityHotels.map(h => ({
            ...h,
            routeCity: city,
            images: h.image ? [h.image, ...FALLBACK_IMAGES.slice(0, 3)] : FALLBACK_IMAGES.slice(0, 4),
            hotelCategory: h.hotel_category || 'HOTEL',
            roomType: h.room_type || 'Standard Room',
          }))
        );
      });
      if (merged.length === 0) {
        merged = data.slice(0, 30).map(h => ({
          ...h,
          images: h.image ? [h.image, ...FALLBACK_IMAGES.slice(0, 3)] : FALLBACK_IMAGES.slice(0, 4),
          hotelCategory: h.hotel_category || 'HOTEL',
          roomType: h.room_type || 'Standard Room',
        }));
      }
      setHotels(merged);
    } catch (err) {
      console.error('Hotel dataset error:', err);
    }
    setLoading(false);
  }, [cityList, fromDate, toDate, totalDays, travellers]);

  useEffect(() => { fetchHotels(); }, [fetchHotels]);

  // Star Rating Handler
  const toggleStar = (star) => {
    setSelectedStars(prev =>
      prev.includes(star) ? prev.filter(s => s !== star) : [...prev, star]
    );
  };

  const handleClearAll = () => {
    setSearchName('');
    setPriceRange(20000);
    setSelectedStars([]);
    setInclFilter('all');
    setCityFilter('all');
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchName.trim()) count++;
    if (priceRange < 20000) count++;
    if (selectedStars.length > 0) count += selectedStars.length;
    if (inclFilter !== 'all') count++;
    if (cityFilter !== 'all') count++;
    return count;
  }, [searchName, priceRange, selectedStars, inclFilter, cityFilter]);

  let filteredHotels = hotels.filter(h => {
    const price = h.price_per_night_inr || h.price_inr || 0;
    if (price > 0 && price > priceRange) return false;
    if (selectedStars.length > 0) {
      const s = Math.round(h.hotel_stars || 3);
      if (!selectedStars.includes(s)) return false;
    }
    if (searchName.trim() && !(h.property_name||h.name||'').toLowerCase().includes(searchName.toLowerCase()) && !(h.address||'').toLowerCase().includes(searchName.toLowerCase())) return false;
    if (inclFilter === 'breakfast' && !h.facilities?.some(f => f.toLowerCase().includes('breakfast'))) return false;
    if (cityFilter !== 'all' && (h.routeCity || '').toLowerCase() !== cityFilter.toLowerCase()) return false;
    return true;
  });

  if (sortBy === 'price_high_low') filteredHotels.sort((a,b) => (b.price_per_night_inr||0)-(a.price_per_night_inr||0));
  else if (sortBy === 'price_low_high') filteredHotels.sort((a,b) => (a.price_per_night_inr||0)-(b.price_per_night_inr||0));
  else filteredHotels.sort((a,b) => (b.hotel_stars||0)-(a.hotel_stars||0));

  const starCounts = [5, 4, 3, 2, 1].map(s => ({
    stars: s,
    count: hotels.filter(h => Math.round(h.hotel_stars || 3) === s).length
  }));

  const sortedSelected = [...selectedHotels].sort((a,b) => (a.stayOrder||1)-(b.stayOrder||1));

  return (
    <div className="w-full">
      {/* Top Navigation Bar (Image 2) */}
      <div className="flex justify-between items-center mb-4">
        <button
          onClick={onBack}
          className="bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold py-2.5 px-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-2 transition-all cursor-pointer"
        >
          <FontAwesomeIcon icon={faArrowLeft} className="text-gray-400 text-xs" />
          <span>Back to Schedule Time</span>
        </button>

        <button
          onClick={onNext}
          className="bg-[#f97316] hover:bg-[#ea580c] text-white font-bold text-xs py-2.5 px-6 rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>Next: Restaurants</span>
          <FontAwesomeIcon icon={faArrowRight} className="text-white text-xs" />
        </button>
      </div>

      {/* Stay Sequence (if any selected) */}
      {selectedHotels.length > 0 && (
        <div className="mb-5 bg-[#121619] text-white p-5 rounded-3xl shadow-xl border border-[#D4B15A]/30">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faHotel} className="text-[#D4B15A]" />
              <h3 className="font-bold text-white text-base">
                Your Stay Sequence ({selectedHotels.length} Hotel{selectedHotels.length > 1 ? 's' : ''})
              </h3>
            </div>
            <span className="text-xs text-[#D4B15A] font-semibold">
              Total: {selectedHotels.reduce((s, h) => s + (h.nights || 1), 0)} Nights
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedSelected.map((h, idx) => (
              <div key={h.id} className="bg-white/5 p-3 rounded-2xl border border-white/10 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="bg-[#D4B15A] text-black font-extrabold text-[10px] px-2 py-0.5 rounded-md uppercase">
                    Stay #{idx + 1}
                  </span>
                  <button onClick={() => onToggleHotel(h)} className="text-gray-400 hover:text-rose-400 cursor-pointer">
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
                <h4 className="font-bold text-white text-sm line-clamp-1">{h.property_name || h.name}</h4>
                <p className="text-gray-400 text-[11px]">₹{(h.price_per_night_inr || 0).toLocaleString()} / night</p>
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={h.stayOrder || idx + 1}
                    onChange={e => onUpdateHotelConfig(h.id, parseInt(e.target.value), h.nights || 1, h.rooms || 1)}
                    className="bg-white/10 text-white font-bold px-2 py-1 rounded-lg text-[10px] outline-none cursor-pointer"
                  >
                    {selectedHotels.map((_, i) => <option key={i + 1} value={i + 1} className="bg-[#121619]">Order {i + 1}</option>)}
                  </select>
                  <select
                    value={h.nights || 1}
                    onChange={e => onUpdateHotelConfig(h.id, h.stayOrder || idx + 1, parseInt(e.target.value), h.rooms || 1)}
                    className="bg-white/10 text-white font-bold px-2 py-1 rounded-lg text-[10px] outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 7, 10].map(n => <option key={n} value={n} className="bg-[#121619]">{n}N</option>)}
                  </select>
                  <select
                    value={h.rooms || 1}
                    onChange={e => onUpdateHotelConfig(h.id, h.stayOrder || idx + 1, h.nights || 1, parseInt(e.target.value))}
                    className="bg-white/10 text-white font-bold px-2 py-1 rounded-lg text-[10px] outline-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5].map(r => <option key={r} value={r} className="bg-[#121619]">{r}R</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hotel Found Count & Filter Trigger Bar (Image 2) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-display font-black text-gray-900">
              {filteredHotels.length} Hotels Found
            </h3>
            <LiveSignalBadge isLive={dsaSource} loading={loading} />
          </div>
          <p className="text-xs font-semibold text-gray-600 mt-0.5">
            {cityFilter !== 'all'
              ? `across ${cityFilter}`
              : cityList.length > 0 ? `across ${cityList.join(', ')}` : ''
            }
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Select one or more hotels to split your stay.
          </p>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          {/* Filter Toggle Button (Image 2) */}
          <button
            onClick={() => setShowFilters(prev => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              showFilters || activeFilterCount > 0
                ? 'bg-[#f97316] text-white border border-[#ea580c] shadow-sm'
                : 'bg-orange-50/70 hover:bg-orange-100/80 text-[#f97316] border border-orange-200'
            }`}
          >
            <FontAwesomeIcon icon={faFilter} className="text-xs" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${showFilters ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'}`}>
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="popularity">Popularity</option>
              <option value="price_low_high">Price: Low to High</option>
              <option value="price_high_low">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Hotel List */}
      <main className="w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <FontAwesomeIcon icon={faSpinner} spin className="text-[#f97316] text-3xl mb-3" />
            <p className="text-sm text-gray-500 font-medium">Searching live hotels...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredHotels.map(hotel => {
              const sel = selectedHotels.find(h => h.id === hotel.id);
              return (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  isSelected={!!sel}
                  stayOrder={sel?.stayOrder || 1}
                  onSelect={onToggleHotel}
                  onRemove={onToggleHotel}
                  onUpdateConfig={onUpdateHotelConfig}
                />
              );
            })}
            {filteredHotels.length === 0 && (
              <div className="py-20 text-center bg-white rounded-2xl border border-gray-100 shadow-sm">
                <FontAwesomeIcon icon={faHotel} className="text-gray-300 text-5xl mb-3" />
                <h4 className="text-lg font-bold text-gray-800">No hotels match your filters</h4>
                <p className="text-xs text-gray-400 mt-1">Try adjusting your price slider or star rating.</p>
                <button
                  onClick={handleClearAll}
                  className="mt-4 px-4 py-2 bg-orange-50 text-orange-600 text-xs font-bold rounded-xl border border-orange-200 hover:bg-orange-100 cursor-pointer transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
          <button
            onClick={onBack}
            className="px-6 py-3 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>Back</span>
          </button>
          <button
            onClick={onNext}
            className="px-8 py-3 bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Next: Dining &amp; Restaurants ({selectedHotels.length})</span>
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </main>

      {/* ── Filter Card gliding smoothly over Live Route (Desktop Portal) ── */}
      {targetEl && isDesktop && createPortal(
        <AnimatePresence>
          {showFilters && (
            <motion.div
              key="desktopHotelFilters"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full h-full bg-white rounded-3xl border border-gray-200 shadow-2xl p-5 overflow-y-auto pointer-events-auto flex flex-col z-[1100]"
            >
              <FilterPanelContent
                searchName={searchName}
                setSearchName={setSearchName}
                priceRange={priceRange}
                setPriceRange={setPriceRange}
                selectedStars={selectedStars}
                toggleStar={toggleStar}
                starCounts={starCounts}
                inclFilter={inclFilter}
                setInclFilter={setInclFilter}
                cityList={cityList}
                cityFilter={cityFilter}
                setCityFilter={setCityFilter}
                hotelsCount={hotels.length}
                filteredCount={filteredHotels.length}
                onClearAll={handleClearAll}
                onClose={() => setShowFilters(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        targetEl
      )}

      {/* ── Mobile Filter Drawer (< 1024px) ── */}
      {!isDesktop && (
        <AnimatePresence>
          {showFilters && (
            <div className="fixed inset-0 z-[1200] flex justify-end bg-black/40 backdrop-blur-xs">
              <div className="absolute inset-0" onClick={() => setShowFilters(false)} />
              <motion.div
                key="mobileHotelFilters"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="relative w-[88vw] max-w-sm h-full bg-white p-5 overflow-y-auto shadow-2xl flex flex-col z-10"
              >
                <FilterPanelContent
                  searchName={searchName}
                  setSearchName={setSearchName}
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  selectedStars={selectedStars}
                  toggleStar={toggleStar}
                  starCounts={starCounts}
                  inclFilter={inclFilter}
                  setInclFilter={setInclFilter}
                  cityList={cityList}
                  cityFilter={cityFilter}
                  setCityFilter={setCityFilter}
                  hotelsCount={hotels.length}
                  filteredCount={filteredHotels.length}
                  onClearAll={handleClearAll}
                  onClose={() => setShowFilters(false)}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

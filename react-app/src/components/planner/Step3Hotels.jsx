import { useState, useEffect, useCallback } from 'react';
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
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold">
      <FontAwesomeIcon icon={faCircle} className="text-red-400 text-[8px]" /> Local Dataset
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
    <div className="relative w-full h-52 sm:h-full sm:w-64 shrink-0 rounded-l-2xl overflow-hidden bg-gray-100 group">
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

function HotelCard({ hotel, isSelected, onSelect, stayOrder, onRemove, onUpdateConfig, selectedHotels }) {
  const price = hotel.price_per_night_inr || hotel.price_inr || 0;
  const stars = hotel.hotel_stars || 3;
  const inclusions = hotel.facilities?.length > 0 ? hotel.facilities : ['Room Only'];
  const images = hotel.images || (hotel.image ? [hotel.image, ...FALLBACK_IMAGES.slice(0,3)] : FALLBACK_IMAGES.slice(0,4));
  return (
    <div className={`flex flex-col sm:flex-row bg-white rounded-2xl border overflow-hidden transition-all shadow-sm hover:shadow-md ${isSelected ? 'border-[#D4B15A] ring-2 ring-[#D4B15A]/40' : 'border-gray-200 hover:border-gray-300'}`}>
      <HotelCarousel images={images} hotelName={hotel.property_name || hotel.name} />
      <div className="flex flex-1 flex-col sm:flex-row p-4 gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 mb-1">{hotel.property_name || hotel.name}</h3>
          <div className="flex items-center gap-0.5 mb-2">
            {Array.from({ length: 5 }).map((_, i) => (<FontAwesomeIcon key={i} icon={faStar} className={`text-xs ${i < stars ? 'text-yellow-400' : 'text-gray-200'}`} />))}
          </div>
          <p className="text-[11px] text-gray-500 mb-2 line-clamp-1">&#x1F4CD; {hotel.address || hotel.city}</p>
          {hotel.routeCity && (
            <span className="inline-block text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full mb-2">
              ðŸ“ {hotel.routeCity}
            </span>
          )}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {hotel.hotelCategory && <span className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md uppercase border border-gray-200">{hotel.hotelCategory}</span>}
            <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">&#x1F6CF;&#xFE0F; {hotel.roomType || 'Standard Room'}</span>
          </div>
          {inclusions.slice(0, 2).map((inc, i) => (
            <span key={i} className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold mb-0.5">
              <FontAwesomeIcon icon={faCheck} className="text-emerald-500 text-[10px]" />{inc}
            </span>
          ))}
          {hotel.source === 'DSA' && <span className="mt-1.5 inline-block text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-1.5 py-0.5 rounded-full">&#x2713; LIVE</span>}
        </div>
        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between shrink-0 sm:w-36 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-3">
          <div className="text-right">
            <span className="text-[10px] text-gray-400 block">From</span>
            {price > 0
              ? <><span className="text-lg font-extrabold text-gray-900">&#x20B9;{price.toLocaleString()}</span><span className="text-[9px] text-gray-400 block">per room / night</span></>
              : <span className="text-sm font-bold text-[#D4B15A]">Price on Request</span>
            }
            <span className="text-[9px] text-gray-400 block">Incl. Taxes</span>
          </div>
          {isSelected ? (
            <div className="flex flex-col gap-1.5 mt-2 w-full">
              <span className="text-[10px] text-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">&#x2713; Stay #{stayOrder}</span>
              <div className="flex gap-1">
                <select onClick={e => e.stopPropagation()} value={hotel.nights || 1} onChange={e => onUpdateConfig(hotel.id, hotel.stayOrder || stayOrder, parseInt(e.target.value), hotel.rooms || 1)} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] px-1 py-1 outline-none font-bold cursor-pointer">
                  {[1,2,3,4,5,7].map(n => <option key={n} value={n}>{n}N</option>)}
                </select>
                <select onClick={e => e.stopPropagation()} value={hotel.rooms || 1} onChange={e => onUpdateConfig(hotel.id, hotel.stayOrder || stayOrder, hotel.nights || 1, parseInt(e.target.value))} className="flex-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] px-1 py-1 outline-none font-bold cursor-pointer">
                  {[1,2,3,4].map(r => <option key={r} value={r}>{r}R</option>)}
                </select>
              </div>
              <button onClick={e => { e.stopPropagation(); onRemove(hotel); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-700 text-center cursor-pointer underline">Remove</button>
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); onSelect(hotel); }} className="mt-2 w-full bg-[#E87722] hover:bg-[#d06a1a] text-white font-bold text-xs py-2.5 px-3 rounded-xl transition-colors cursor-pointer text-center shadow-sm">View Rooms</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Step3Hotels({ destination, fromDate, toDate, totalDays = 3, travellers = 2, selectedHotels = [], onToggleHotel, onUpdateHotelConfig, onNext, onBack }) {
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dsaSource, setDsaSource] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [priceRange, setPriceRange] = useState(20000);
  const [minStars, setMinStars] = useState(0);
  const [inclFilter, setInclFilter] = useState('all');
  const [sortBy, setSortBy] = useState('popularity');
  const [cityFilter, setCityFilter] = useState('all'); // filter by route stop city

  const cityList = typeof destination === 'string'
    ? destination.split(',').map(c => c.trim()).filter(Boolean)
    : (Array.isArray(destination) ? destination : []);

  const fetchHotels = useCallback(async () => {
    setLoading(true); setDsaSource(false);

    // Parse ALL cities from the destination string e.g. "Jaipur, Udaipur, Jodhpur"
    const cityList = typeof destination === 'string'
      ? destination.split(',').map(c => c.trim()).filter(Boolean)
      : (Array.isArray(destination) ? destination : ['Delhi']);

    const checkIn = fromDate || new Date().toISOString().split('T')[0];
    const nights = totalDays || 1;
    const checkOutDate = new Date(checkIn);
    checkOutDate.setDate(checkOutDate.getDate() + nights);
    const checkOut = toDate || checkOutDate.toISOString().split('T')[0];

    // Show local fallback hotels IMMEDIATELY so page is never blank
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
      setLoading(false); // page is usable immediately
    } catch (_) {}

    // --- 1. Try DSA API for EVERY city in the route, sequentially (max 12s per city) ---
    let allDsaHotels = [];
    let anyDsaLive = false;
    try {
      for (const city of cityList) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000); // 12s hard limit per city
          const res = await fetch(`${BACKEND_URL}/api/dsa/hotels/search`, {
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
            // Progressive update: overlay DSA results on top of local fallback
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
      // Final definitive update with all DSA cities combined
      setHotels(allDsaHotels);
      setDsaSource(anyDsaLive);
      return;
    }


    // --- 2. Fallback: local dataset filtered for all route cities ---
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
      // If nothing matched any city, show first 30 generic
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
  }, [destination, fromDate, toDate, totalDays, travellers]);

  useEffect(() => { fetchHotels(); }, [fetchHotels]);

  let filteredHotels = hotels.filter(h => {
    const price = h.price_per_night_inr || h.price_inr || 0;
    if (price > 0 && price > priceRange) return false; // only filter by price if price is known
    if ((h.hotel_stars||3) < minStars) return false;
    if (searchName.trim() && !(h.property_name||h.name||'').toLowerCase().includes(searchName.toLowerCase()) && !(h.address||'').toLowerCase().includes(searchName.toLowerCase())) return false;
    if (inclFilter === 'breakfast' && !h.facilities?.some(f => f.toLowerCase().includes('breakfast'))) return false;
    if (cityFilter !== 'all' && (h.routeCity || '').toLowerCase() !== cityFilter.toLowerCase()) return false;
    return true;
  });
  if (sortBy === 'price_high_low') filteredHotels.sort((a,b) => (b.price_per_night_inr||0)-(a.price_per_night_inr||0));
  else if (sortBy === 'price_low_high') filteredHotels.sort((a,b) => (a.price_per_night_inr||0)-(b.price_per_night_inr||0));
  else filteredHotels.sort((a,b) => (b.hotel_stars||0)-(a.hotel_stars||0));

  const starCounts = [5,4,3,2,1].map(s => ({ stars: s, count: hotels.filter(h => Math.round(h.hotel_stars||0)===s).length }));
  const sortedSelected = [...selectedHotels].sort((a,b) => (a.stayOrder||1)-(b.stayOrder||1));

  return (
    <div className="w-full p-4 sm:p-6">
      {selectedHotels.length > 0 && (
        <div className="mb-6 bg-[#121619] text-white p-5 rounded-3xl shadow-xl border border-[#D4B15A]/30">
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2"><FontAwesomeIcon icon={faHotel} className="text-[#D4B15A]" /><h3 className="font-bold text-white text-base">Your Stay Sequence ({selectedHotels.length} Hotel{selectedHotels.length>1?'s':''})</h3></div>
            <span className="text-xs text-[#D4B15A] font-semibold">Total: {selectedHotels.reduce((s,h)=>s+(h.nights||1),0)} Nights</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedSelected.map((h,idx) => (
              <div key={h.id} className="bg-white/5 p-3 rounded-2xl border border-white/10 text-xs">
                <div className="flex justify-between items-start mb-1">
                  <span className="bg-[#D4B15A] text-black font-extrabold text-[10px] px-2 py-0.5 rounded-md uppercase">Stay #{idx+1}</span>
                  <button onClick={() => onToggleHotel(h)} className="text-gray-400 hover:text-rose-400 cursor-pointer"><FontAwesomeIcon icon={faXmark} /></button>
                </div>
                <h4 className="font-bold text-white text-sm line-clamp-1">{h.property_name||h.name}</h4>
                <p className="text-gray-400 text-[11px]">&#x20B9;{(h.price_per_night_inr||0).toLocaleString()} / night</p>
                <div className="mt-2 flex items-center gap-2">
                  <select value={h.stayOrder||idx+1} onChange={e=>onUpdateHotelConfig(h.id,parseInt(e.target.value),h.nights||1,h.rooms||1)} className="bg-white/10 text-white font-bold px-2 py-1 rounded-lg text-[10px] outline-none cursor-pointer">
                    {selectedHotels.map((_,i)=><option key={i+1} value={i+1} className="bg-[#121619]">Order {i+1}</option>)}
                  </select>
                  <select value={h.nights||1} onChange={e=>onUpdateHotelConfig(h.id,h.stayOrder||idx+1,parseInt(e.target.value),h.rooms||1)} className="bg-white/10 text-white font-bold px-2 py-1 rounded-lg text-[10px] outline-none cursor-pointer">
                    {[1,2,3,4,5,7,10].map(n=><option key={n} value={n} className="bg-[#121619]">{n}N</option>)}
                  </select>
                  <select value={h.rooms||1} onChange={e=>onUpdateHotelConfig(h.id,h.stayOrder||idx+1,h.nights||1,parseInt(e.target.value))} className="bg-white/10 text-white font-bold px-2 py-1 rounded-lg text-[10px] outline-none cursor-pointer">
                    {[1,2,3,4,5].map(r=><option key={r} value={r} className="bg-[#121619]">{r}R</option>)}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-36">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2"><FontAwesomeIcon icon={faFilter} className="text-[#D4B15A]" /> Filters</h3>
              <button onClick={() => { setSearchName(''); setPriceRange(20000); setMinStars(0); setInclFilter('all'); setCityFilter('all'); }} className="text-xs text-gray-400 hover:text-gray-600 underline cursor-pointer">Clear All</button>
            </div>
            <div className="space-y-5">

              {/* City Tabs â€” only shown for multi-city routes */}
              {cityList.length > 1 && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">&#x1F5FA;&#xFE0F; Route City</label>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => setCityFilter('all')} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs border font-semibold transition-all cursor-pointer ${cityFilter==='all'?'bg-[#121619] text-[#D4B15A] border-[#121619]':'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4B15A]'}`}>
                      <span>All Cities</span>
                      <span className="text-[10px] opacity-70">{hotels.length}</span>
                    </button>
                    {cityList.map(city => (
                      <button key={city} onClick={() => setCityFilter(cityFilter === city ? 'all' : city)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs border font-semibold transition-all cursor-pointer ${cityFilter===city?'bg-indigo-700 text-white border-indigo-700':'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-400'}`}>
                        <span>{city}</span>
                        <span className="text-[10px] opacity-70">{hotels.filter(h=>(h.routeCity||'').toLowerCase()===city.toLowerCase()).length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">Search by name</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                  <input type="text" placeholder="Hotel or area..." value={searchName} onChange={e=>setSearchName(e.target.value)} className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#D4B15A]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Price per night</label>
                  <span className="text-[10px] font-bold text-[#D4B15A]">&#x20B9;{priceRange.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>&#x20B9;0</span><span>&#x20B9;20,000+</span></div>
                <input type="range" min="0" max="20000" step="500" value={priceRange} onChange={e=>setPriceRange(Number(e.target.value))} className="w-full accent-[#D4B15A] cursor-pointer" />
                <div className="mt-1 flex items-end gap-0.5 h-5">
                  {[15,30,55,80,95,90,70,50,30,15].map((h,i) => (
                    <div key={i} style={{height:`${h}%`,width:'10%'}} className={`rounded-sm ${i/10 < priceRange/20000 ? 'bg-[#D4B15A]' : 'bg-gray-200'}`} />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">Star Rating</label>
                <div className="space-y-1">
                  {starCounts.map(({stars,count}) => (
                    <button key={stars} onClick={() => setMinStars(minStars===stars?0:stars)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs border font-semibold transition-all cursor-pointer ${minStars===stars?'bg-[#121619] text-[#D4B15A] border-[#121619]':'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4B15A]'}`}>
                      <span className="flex items-center gap-0.5">
                        {Array.from({length:5}).map((_,i)=><FontAwesomeIcon key={i} icon={faStar} className={`text-[9px] ${i<stars?'text-yellow-400':'text-gray-300'}`} />)}
                      </span>
                      <span className="text-[10px] font-bold opacity-70">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-2">Inclusions</label>
                <div className="space-y-1">
                  {[{id:'all',label:'All',count:hotels.length},{id:'room_only',label:'Room Only',count:hotels.filter(h=>!h.facilities?.some(f=>f.toLowerCase().includes('breakfast'))).length},{id:'breakfast',label:'Free Breakfast',count:hotels.filter(h=>h.facilities?.some(f=>f.toLowerCase().includes('breakfast'))).length}].map(opt=>(
                    <button key={opt.id} onClick={()=>setInclFilter(opt.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs border font-semibold transition-all cursor-pointer ${inclFilter===opt.id?'bg-[#121619] text-[#D4B15A] border-[#121619]':'bg-gray-50 text-gray-700 border-gray-200 hover:border-[#D4B15A]'}`}>
                      <span>{opt.label}</span><span className="text-[10px] opacity-70">{opt.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
            <div>
              <h3 className="text-lg font-display font-bold text-gray-900">
                {filteredHotels.length} Hotels Found
                {cityFilter !== 'all'
                  ? ` in ${cityFilter}`
                  : cityList.length > 0 ? ` across ${cityList.join(', ')}` : ''
                }
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">Select one or more hotels to split your stay.</p>
            </div>
            <div className="flex items-center gap-3">
              <LiveSignalBadge isLive={dsaSource} loading={loading} />
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Sort by:</span>
                <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-[#D4B15A] cursor-pointer">
                  <option value="popularity">Popularity</option>
                  <option value="price_low_high">Price: Low to High</option>
                  <option value="price_high_low">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-gray-200">
              <FontAwesomeIcon icon={faSpinner} spin className="text-[#D4B15A] text-3xl mb-3" />
              <p className="text-sm text-gray-500 font-medium">Searching live hotels...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredHotels.map(hotel => {
                const sel = selectedHotels.find(h=>h.id===hotel.id);
                return <HotelCard key={hotel.id} hotel={hotel} isSelected={!!sel} stayOrder={sel?.stayOrder||1} onSelect={onToggleHotel} onRemove={onToggleHotel} onUpdateConfig={onUpdateHotelConfig} selectedHotels={selectedHotels} />;
              })}
              {filteredHotels.length === 0 && (
                <div className="py-20 text-center bg-white rounded-2xl border border-gray-100">
                  <FontAwesomeIcon icon={faHotel} className="text-gray-300 text-5xl mb-3" />
                  <h4 className="text-lg font-bold text-gray-800">No hotels match your filters</h4>
                  <p className="text-xs text-gray-400 mt-1">Try adjusting your price slider or star rating.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
            <button onClick={onBack} className="px-6 py-3 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2"><FontAwesomeIcon icon={faArrowLeft} /> Back</button>
            <button onClick={onNext} className="px-8 py-3 bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer">
              <span>Next: Dining &amp; Restaurants ({selectedHotels.length})</span><FontAwesomeIcon icon={faArrowRight} />
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

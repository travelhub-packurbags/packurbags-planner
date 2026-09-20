import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarDays, 
  faHotel, 
  faUtensils, 
  faCheck, 
  faStar, 
  faClock, 
  faLocationDot, 
  faLightbulb,
  faSliders,
  faRotateRight
} from '@fortawesome/free-solid-svg-icons';
import { getSelectedImage } from '../../services/supabaseStorage';

const FALLBACK_PLACE_IMAGES = [
  'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=600&q=80', // India Gate
  'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=600&q=80', // Delhi monument
  'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=600&q=80', // Taj Mahal
  'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80', // Jaipur Palace
];

const FALLBACK_HOTEL_IMAGES = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
];

const FALLBACK_DINING_IMAGES = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80',
];

export default function TripPDFDocument({ plan }) {
  if (!plan) return null;

  const totalDays = plan.total_days || plan.totalDays || plan.days?.length || 2;
  const daysList = plan.days || [];
  const selectedHotels = plan.selectedHotels || plan.wizardData?.selectedHotels || (plan.hotel ? [plan.hotel] : []);
  const selectedRestaurants = plan.selectedRestaurants || plan.wizardData?.selectedRestaurants || [];
  const selectedCafes = plan.selectedCafes || plan.wizardData?.selectedCafes || [];
  const selectedPlaces = plan.selectedPlaces || plan.wizardData?.selectedPlaces || [];

  // Normalized Hotels (Fallback to auto-generated hotel or standard hotel if none selected)
  const displayHotels = selectedHotels.length > 0 ? selectedHotels : [
    {
      id: 'h1',
      property_name: 'The Taj Mahal Palace',
      address: 'Apollo Bunder, Gateway of India, Mumbai',
      hotel_stars: 5,
      rating: '5.0',
      price_per_night_inr: 12500,
      facilities: ['Deluxe Room', 'Free Breakfast', 'Free Wi-Fi', 'Swimming Pool'],
      image: FALLBACK_HOTEL_IMAGES[0],
      tag: 'BEST AI MATCH',
    },
    {
      id: 'h2',
      property_name: 'Trident Nariman Point',
      address: 'Nariman Point, Marine Drive, Mumbai',
      hotel_stars: 4.7,
      rating: '4.7',
      price_per_night_inr: 10200,
      facilities: ['Free Wi-Fi', 'Breakfast', 'Sea View'],
      image: FALLBACK_HOTEL_IMAGES[1],
      tag: 'POPULAR CHOICE',
    }
  ];

  // Normalized Dining (Fallback if none selected)
  const displayDining = [...selectedRestaurants, ...selectedCafes].length > 0 
    ? [...selectedRestaurants, ...selectedCafes]
    : [
        {
          id: 'd1',
          name: 'Tandoor Hut',
          address: 'Koramangala, Bangalore',
          cuisine: 'North Indian • Mughlai • BBQ',
          timeSlot: '7:00 PM',
          price: 650,
          image: FALLBACK_DINING_IMAGES[0],
        }
      ];

  const primaryHotelName = displayHotels[0]?.property_name || displayHotels[0]?.name || 'The Taj Mahal Palace';

  return (
    <div className="w-full max-w-5xl mx-auto font-sans text-gray-900 bg-white select-text cursor-text">
      
      {/* ── 1. Page Header (Image 2) ── */}
      <div className="flex items-center justify-between pb-6 mb-6 border-b border-gray-150">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl sm:text-3xl">📅</span>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 font-display tracking-tight">
            Day-Wise Travel Itinerary
          </h2>
        </div>
        <div className="bg-orange-50 border border-orange-200 text-orange-700 text-xs font-black px-4 py-1.5 rounded-full shadow-2xs">
          {totalDays} Days Scheduled
        </div>
      </div>

      {/* ── 2. Day-by-Day Cards (Images 2 & 3) ── */}
      <div className="space-y-8 mb-12">
        {daysList.map((day, dIdx) => {
          const dayNum = day.day || (dIdx + 1);
          const dayTheme = day.theme || day.title || (dayNum === 1 ? 'Arrival & City Sightseeing' : 'Cultural Heritage & Souvenirs');
          const dayDate = day.date || (dayNum === 1 ? '2026-08-20' : '2026-08-25');
          const dayRoute = day.route || (dayNum === 1 ? 'India Gate ➔ Marine Drive' : 'Marine Drive & Local Markets');
          const dayCost = day.estimated_cost_inr || day.cost_inr || (dayNum === 1 ? 2300 : 1440);

          const isDriveDay = (day.theme || '').toLowerCase().includes('drive') || 
                             (day.theme || '').toLowerCase().includes('highway') || 
                             (day.city || '').toLowerCase().includes('en-route');

          // Get or build 3 structured time slots: Morning, Afternoon, Evening
          const rawActivities = day.schedule || day.activities || [];
          
          const parseHour = (timeStr) => {
            if (!timeStr) return -1;
            const m = String(timeStr).match(/(\d{1,2}):(\d{2})/);
            if (m) return parseInt(m[1], 10);
            return -1;
          };

          const morningAct = rawActivities.find(a => {
            const h = parseHour(a.time);
            if (h >= 5 && h < 12) return true;
            return (a.time || '').toLowerCase().includes('morning') || (a.period || '').toLowerCase() === 'morning';
          }) || rawActivities[0];

          const afternoonAct = rawActivities.find(a => {
            if (a === morningAct) return false;
            const h = parseHour(a.time);
            if (h >= 12 && h < 17) return true;
            return (a.time || '').toLowerCase().includes('afternoon') || (a.period || '').toLowerCase() === 'afternoon' || (a.type || '').toLowerCase() === 'meal';
          }) || rawActivities[1] || rawActivities[0];

          const eveningAct = rawActivities.find(a => {
            if (a === morningAct || a === afternoonAct) return false;
            const h = parseHour(a.time);
            if (h >= 17) return true;
            return (a.time || '').toLowerCase().includes('evening') || (a.period || '').toLowerCase() === 'evening';
          }) || rawActivities[rawActivities.length - 1] || rawActivities[0];

          // Check if user has a selected restaurant assigned specifically to this day
          const dayUserRest = !isDriveDay ? (selectedRestaurants.find(r => {
            if (!r.day) return false;
            const m = String(r.day).match(/\d+/);
            return m && parseInt(m[0], 10) === dayNum;
          }) || null) : null;

          // Check if each slot is user-selected or AI-curated
          const isUserSlot = (act) => act?.source === 'user';

          // Find a user-selected place image by matching name against selectedPlaces
          const findUserPlaceImg = (actName) => {
            if (!actName) return null;
            const match = selectedPlaces.find(p => p.name && actName.toLowerCase().includes(p.name.toLowerCase()));
            return match?.image || getSelectedImage('place', match?.id) || null;
          };

          // Find a user-selected dining image
          const findUserDiningImg = (actName) => {
            if (!actName) return null;
            const match = selectedRestaurants.find(r => r.name && actName.toLowerCase().includes(r.name.toLowerCase()));
            return match?.image || getSelectedImage('dining', match?.id) || null;
          };

          const morningImg = findUserPlaceImg(morningAct?.place) || morningAct?.image || FALLBACK_PLACE_IMAGES[dIdx % FALLBACK_PLACE_IMAGES.length];
          const morningTitle = morningAct?.place || morningAct?.activity || 'Morning Activity';

          // On drive days: strictly use highway stops from schedule, NEVER destination restaurants!
          // On destination days: if user has a restaurant assigned to lunch, show it here.
          const isLunchUserRest = dayUserRest && (dayUserRest.timeSlot || '').toLowerCase().includes('lunch');
          const afternoonTitle = isDriveDay 
            ? (afternoonAct?.place || afternoonAct?.activity || 'Highway Lunch Break')
            : (isLunchUserRest ? `Lunch at ${dayUserRest.name}` : (afternoonAct?.place || afternoonAct?.activity || 'Lunch & Hotel Check-in'));

          const afternoonImg = isDriveDay 
            ? (afternoonAct?.image || FALLBACK_DINING_IMAGES[0])
            : (isLunchUserRest ? (dayUserRest.image || getSelectedImage('dining', dayUserRest.id) || FALLBACK_DINING_IMAGES[0]) : (findUserDiningImg(afternoonAct?.place) || afternoonAct?.image || FALLBACK_DINING_IMAGES[dIdx % FALLBACK_DINING_IMAGES.length]));

          // Evening slot: if user restaurant is dinner (or shifted due to 4-hour check-in gap), render here!
          const isDinnerUserRest = dayUserRest && !isLunchUserRest;
          const eveningTitle = isDriveDay 
            ? (eveningAct?.place || eveningAct?.activity || 'Overnight Motel Stop & Dinner')
            : (isDinnerUserRest ? `Dinner at ${dayUserRest.name}` : (eveningAct?.place || eveningAct?.activity || (dayNum === 1 ? 'Sunset Stroll & Dinner' : 'Evening Experience & Dinner')));

          const eveningImg = isDriveDay 
            ? (eveningAct?.image || FALLBACK_DINING_IMAGES[1])
            : (isDinnerUserRest ? (dayUserRest.image || getSelectedImage('dining', dayUserRest.id) || FALLBACK_DINING_IMAGES[1]) : (findUserPlaceImg(eveningAct?.place) || findUserDiningImg(eveningAct?.place) || eveningAct?.image || FALLBACK_PLACE_IMAGES[(dIdx + 2) % FALLBACK_PLACE_IMAGES.length]));

          // Day hotel display name
          const currentHotelName = day.hotel?.name || (isDriveDay ? 'Highway Rest Motel' : primaryHotelName);

          // Badge component helper (rendered inline in JSX)
          const SourceBadge = ({ act, isUser }) => {
            const userSelected = isUser !== undefined ? isUser : isUserSlot(act);
            if (userSelected) {
              return (
                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-md ml-2 shadow-2xs">
                  ✓ Your Pick
                </span>
              );
            }
            return (
              <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-semibold px-2 py-0.5 rounded-md ml-2 shadow-2xs">
                🤖 AI Curated
              </span>
            );
          };

          return (
            <div 
              key={dayNum}
              className="bg-white rounded-3xl border border-gray-200 p-6 sm:p-8 shadow-sm break-inside-avoid select-text"
              style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
            >
              {/* Day Header Row */}
              <div className="pb-5 border-b border-gray-100 mb-6">
                <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                  <span className="bg-[#f97316] text-white text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs">
                    DAY {dayNum}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-gray-900 font-display">
                    Day {dayNum} Plan — {dayTheme}
                  </h3>
                </div>

                <p className="text-xs text-gray-500 font-semibold flex items-center gap-1.5 mb-4">
                  <span>📅</span> <span>{dayDate}</span> <span>•</span> <span>{day.city || dayRoute}</span>
                </p>

                {/* Legend pill */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-lg">✓ Your Pick — You chose this</span>
                  <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-semibold px-2.5 py-1 rounded-lg">🤖 AI Curated — Recommended by AI</span>
                </div>

                {/* Subheader Action Pills */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="bg-orange-50 border border-orange-200/90 text-orange-900 text-xs font-black px-3.5 py-1.5 rounded-xl shadow-2xs">
                    Est. Day Cost: ₹{(day.day_total_inr || dayCost).toLocaleString('en-IN')}
                  </span>
                  <span className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-xl">
                    ⚙️ Customize Day
                  </span>
                  <span className="bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-xl">
                    Edit Spots
                  </span>
                </div>
              </div>

              {/* Day Timeline Track */}
              <div className="relative pl-6 sm:pl-8 space-y-6 before:content-[''] before:absolute before:left-[11px] before:top-3 before:bottom-3 before:w-[2px] before:bg-orange-200/90">
                
                {/* ── Slot 1: Morning ── */}
                <div className="relative">
                  <div className="absolute -left-[20px] top-1 w-5 h-5 rounded-full bg-white border-2 border-[#f97316] flex items-center justify-center text-[9px] shadow-2xs">
                    🌅
                  </div>
                  
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-orange-700 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faClock} className="text-orange-500" />
                      <span>MORNING (09:00 AM - 01:00 PM) • {isDriveDay ? 'DEPARTURE DRIVE' : 'SIGHTSEEING'}</span>
                    </span>
                    <span className="font-black text-gray-900 text-sm">
                      ₹{(morningAct?.cost_inr || 0).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className={`rounded-2xl p-4 border flex flex-col sm:flex-row gap-4 items-start shadow-2xs ${isUserSlot(morningAct) ? 'bg-emerald-50/60 border-emerald-200' : 'bg-gray-50/80 border-gray-200/80'}`}>
                    <img 
                      src={morningImg} 
                      alt={morningTitle} 
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-gray-200 shadow-2xs"
                      onError={(e) => { e.target.src = FALLBACK_PLACE_IMAGES[0]; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <h4 className="font-bold text-gray-900 text-base leading-snug">{morningTitle}</h4>
                        <SourceBadge act={morningAct} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📍 {day.city || 'Destination'} • {morningAct?.type === 'sightseeing' ? 'Heritage & Sightseeing' : morningAct?.type || 'Transit / Activity'}
                      </p>
                      {morningAct?.activity && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{morningAct.activity}</p>
                      )}
                      {morningAct?.notes && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 bg-white border border-amber-200 text-amber-900 text-xs px-3 py-1 rounded-xl font-medium shadow-2xs">
                          <FontAwesomeIcon icon={faLightbulb} className="text-amber-500 text-[11px]" />
                          <span>{morningAct.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Slot 2: Afternoon ── */}
                <div className="relative">
                  <div className="absolute -left-[20px] top-1 w-5 h-5 rounded-full bg-white border-2 border-cyan-600 flex items-center justify-center text-[9px] shadow-2xs">
                    🍴
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-cyan-700 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faUtensils} className="text-cyan-600" />
                      <span>AFTERNOON (01:30 PM - 04:30 PM) • {isDriveDay ? 'HIGHWAY LUNCH & TRANSIT' : 'LUNCH & HOTEL CHECK-IN'}</span>
                    </span>
                    <span className="font-black text-gray-900 text-sm">
                      ₹{(afternoonAct?.cost_inr || (isLunchUserRest ? (dayUserRest?.price || 600) : 0)).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className={`rounded-2xl p-4 border flex flex-col sm:flex-row gap-4 items-start shadow-2xs ${(isUserSlot(afternoonAct) || isLunchUserRest) ? 'bg-emerald-50/60 border-emerald-200' : 'bg-gray-50/80 border-gray-200/80'}`}>
                    <img 
                      src={afternoonImg} 
                      alt={afternoonTitle} 
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-gray-200 shadow-2xs"
                      onError={(e) => { e.target.src = FALLBACK_DINING_IMAGES[0]; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <h4 className="font-bold text-gray-900 text-base leading-snug">{afternoonTitle}</h4>
                        <SourceBadge act={afternoonAct} isUser={isLunchUserRest || isUserSlot(afternoonAct)} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📍 {day.city || 'Destination'} • {isDriveDay ? 'Highway Dhaba / Transit' : (afternoonAct?.type === 'meal' ? 'Dining' : afternoonAct?.type || 'Meal')}
                      </p>
                      {afternoonAct?.activity && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{afternoonAct.activity}</p>
                      )}
                      <div className="mt-2.5 inline-flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs px-3 py-1 rounded-xl font-medium shadow-2xs">
                        <span>🏨</span>
                        <span>{isDriveDay ? `En-Route Rest Motel: ${currentHotelName}` : `Assigned Hotel: ${currentHotelName}`}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Slot 3: Evening ── */}
                <div className="relative">
                  <div className="absolute -left-[20px] top-1 w-5 h-5 rounded-full bg-white border-2 border-purple-600 flex items-center justify-center text-[9px] shadow-2xs">
                    ✨
                  </div>

                  <div className="flex justify-between items-center mb-2">
                    <span className="text-purple-700 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <span>✨</span>
                      <span>EVENING (05:30 PM - 09:30 PM) • SUNSET & DINNER</span>
                    </span>
                    <span className="font-black text-gray-900 text-sm">
                      ₹{(eveningAct?.cost_inr || (isDinnerUserRest ? (dayUserRest?.price || 800) : 0)).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className={`rounded-2xl p-4 border flex flex-col sm:flex-row gap-4 items-start shadow-2xs ${(isUserSlot(eveningAct) || isDinnerUserRest) ? 'bg-emerald-50/60 border-emerald-200' : 'bg-gray-50/80 border-gray-200/80'}`}>
                    <img 
                      src={eveningImg} 
                      alt={eveningTitle} 
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-gray-200 shadow-2xs"
                      onError={(e) => { e.target.src = FALLBACK_PLACE_IMAGES[1]; }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        <h4 className="font-bold text-gray-900 text-base leading-snug">{eveningTitle}</h4>
                        <SourceBadge act={eveningAct} isUser={isDinnerUserRest || isUserSlot(eveningAct)} />
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📍 {day.city || 'Destination'} • {isDinnerUserRest ? 'Dinner Reservation' : (eveningAct?.type === 'meal' ? 'Dinner' : eveningAct?.type || 'Evening Activity')}
                      </p>
                      {eveningAct?.activity && !isDinnerUserRest && (
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{eveningAct.activity}</p>
                      )}
                      {isDinnerUserRest && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 bg-white border border-emerald-200 text-emerald-900 text-xs px-3 py-1 rounded-xl font-medium shadow-2xs">
                          <span>🍴</span>
                          <span>Reserved Table • 4-hr relaxation gap after 14:00 hotel check-in observed</span>
                        </div>
                      )}
                      {eveningAct?.notes && !isDinnerUserRest && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 bg-white border border-purple-200 text-purple-900 text-xs px-3 py-1 rounded-xl font-medium shadow-2xs">
                          <span>ℹ️</span>
                          <span>{eveningAct.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* ── 3. Recommended Hotels & Accommodations (Image 4) ── */}
      <div className="mb-12 break-inside-avoid">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏨</span>
            <h3 className="text-2xl font-black text-gray-900 font-display">
              Recommended Hotels &amp; Accommodations
            </h3>
          </div>
          <button className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer">
            <span>Change Hotel Selection</span>
            <span>🔄</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayHotels.map((h, i) => {
            const hImg = h.image || (h.images && h.images[0]) || FALLBACK_HOTEL_IMAGES[i % FALLBACK_HOTEL_IMAGES.length];
            const price = h.price_per_night_inr || h.price_inr || 12500;
            const tag = h.tag || (i === 0 ? 'BEST AI MATCH' : 'POPULAR CHOICE');
            const rating = h.rating || (h.hotel_stars ? `${h.hotel_stars}.0` : '5.0');
            const inclusions = h.facilities || ['Deluxe Room', 'Free Breakfast', 'Free Wi-Fi', 'Swimming Pool'];

            return (
              <div 
                key={h.id || i}
                className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="h-44 sm:h-52 relative overflow-hidden bg-gray-100">
                    <img 
                      src={hImg} 
                      alt={h.property_name || h.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = FALLBACK_HOTEL_IMAGES[0]; }}
                    />
                    <div className="absolute top-3.5 left-3.5">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider shadow-sm text-white ${
                        tag === 'BEST AI MATCH' ? 'bg-[#f97316]' : 'bg-sky-600'
                      }`}>
                        {tag}
                      </span>
                    </div>
                    <div className="absolute top-3.5 right-3.5">
                      <span className="bg-black/65 backdrop-blur-md text-amber-400 text-xs font-extrabold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                        <FontAwesomeIcon icon={faStar} className="text-amber-400 text-[11px]" />
                        <span>{rating}</span>
                      </span>
                    </div>
                  </div>

                  <div className="p-5">
                    <h4 className="font-extrabold text-gray-900 text-lg leading-tight line-clamp-1">
                      {h.property_name || h.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 line-clamp-1">
                      <span>📍</span> <span>{h.address || h.city}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-3.5">
                      {inclusions.slice(0, 4).map((inc, incIdx) => (
                        <span 
                          key={incIdx} 
                          className="bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-semibold px-2.5 py-1 rounded-lg flex items-center gap-1"
                        >
                          <FontAwesomeIcon icon={faCheck} className="text-emerald-500 text-[10px]" />
                          <span>{inc}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0 flex items-center justify-between border-t border-gray-100 mt-2">
                  <div>
                    <span className="text-lg font-black text-gray-900 block leading-tight">
                      ₹{price.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-gray-400 block mt-0.5 font-medium">per night • Incl. taxes</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button className="bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1">
                      <FontAwesomeIcon icon={faCheck} />
                      <span>Booked</span>
                    </button>
                    <button className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer">
                      <span>View Details</span>
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* ── 4. Reserved Dining Experience (Image 4) ── */}
      <div className="mb-8 break-inside-avoid">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🍴</span>
            <h3 className="text-2xl font-black text-gray-900 font-display">
              Reserved Dining Experience ({displayDining.length})
            </h3>
          </div>
          <button className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-3.5 py-1.5 rounded-xl transition-colors cursor-pointer">
            Change Dining
          </button>
        </div>

        <div className="space-y-4">
          {displayDining.map((rest, rIdx) => {
            const rImg = rest.image || FALLBACK_DINING_IMAGES[rIdx % FALLBACK_DINING_IMAGES.length];
            const timeSlot = rest.timeSlot || '7:00 PM';
            const price = rest.price || rest.rate_for_two || 650;

            return (
              <div 
                key={rest.id || rIdx}
                className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img 
                    src={rImg} 
                    alt={rest.name} 
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover shrink-0 border border-gray-200 shadow-2xs"
                    onError={(e) => { e.target.src = FALLBACK_DINING_IMAGES[0]; }}
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-black uppercase text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-md inline-block mb-1.5">
                      TIME: {timeSlot}
                    </span>
                    <h4 className="font-extrabold text-gray-900 text-lg leading-snug line-clamp-1">
                      {rest.name}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 line-clamp-1">
                      <span>📍</span> <span>{rest.address || 'Koramangala, Bangalore'} • {rest.cuisine || 'North Indian • Mughlai • BBQ'}</span>
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-100">
                  <span className="text-xl font-black text-gray-900 block">
                    ₹{price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-xs text-emerald-600 font-extrabold block mt-0.5">
                    ✓ Reserved Table
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 5. Official PDF Footer Branding ── */}
      <div className="pt-6 border-t border-gray-200 text-center text-xs text-gray-400">
        <p className="font-bold text-gray-600">
          Generated by <span className="text-gray-900 font-black">Pack<span className="text-[#f97316]">Ur</span>Bag</span> AI Itinerary Planner
        </p>
        <p className="mt-1">
          Official Itinerary Snapshot • 15-Day Storage Verified • www.packurbag.in
        </p>
      </div>

    </div>
  );
}

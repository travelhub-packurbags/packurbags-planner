import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarDays, 
  faClock, 
  faArrowRight, 
  faArrowLeft, 
  faSun, 
  faCloudSun, 
  faMoon, 
  faClockRotateLeft 
} from '@fortawesome/free-solid-svg-icons';
import { fetchWikipediaImage } from '../../services/wikipedia';
import { saveSelectedImage, getSelectedImage } from '../../services/supabaseStorage';

export default function Step2SchedulePlaces({ selectedPlaces, scheduleData, onUpdateSchedule, onNext, onBack, totalDays = 3, outboundTransport = null, returnTransport = null }) {
  const [placeImages, setPlaceImages] = useState({});

  const timeSlots = [
    { id: 'Morning', label: 'Morning (9:00 AM)', icon: faSun, color: 'text-amber-500' },
    { id: 'Afternoon', label: 'Afternoon (2:00 PM)', icon: faCloudSun, color: 'text-orange-500' },
    { id: 'Evening', label: 'Evening (5:00 PM)', icon: faClockRotateLeft, color: 'text-[#D4B15A]' },
    { id: 'Night', label: 'Night (8:00 PM)', icon: faMoon, color: 'text-indigo-400' },
  ];

  const daysList = Array.from({ length: totalDays }, (_, i) => `Day ${i + 1}`);

  // Fetch or retrieve missing place photos from 15-day storage or Wikipedia
  useEffect(() => {
    selectedPlaces.forEach(async (place) => {
      const isGenericFallback = (url) => !url || url.includes('1596178065887');
      const cached = getSelectedImage('place', place.id);

      if (!isGenericFallback(cached)) {
        place.image = cached;
        setPlaceImages(prev => ({ ...prev, [place.id]: cached }));
        return;
      }
      if (!isGenericFallback(place.image)) {
        setPlaceImages(prev => ({ ...prev, [place.id]: place.image }));
        saveSelectedImage('place', place.id, place.image, { name: place.name, city: place.city });
        return;
      }

      // Fetch authentic Wikipedia photo
      try {
        const img = await fetchWikipediaImage(place.name, place.city);
        if (img) {
          place.image = img;
          saveSelectedImage('place', place.id, img, { name: place.name, city: place.city });
          setPlaceImages(prev => ({ ...prev, [place.id]: img }));
        }
      } catch (_) {}
    });
  }, [selectedPlaces]);

  const getRecommendedTime = (place) => {
    const type = (place.type || '').toLowerCase();
    const name = (place.name || '').toLowerCase();
    const desc = (place.description || '').toLowerCase();

    if (type.includes('temple') || type.includes('religious') || type.includes('spiritual') || name.includes('mandir')) {
      return {
        slot: 'Morning',
        note: 'Morning hours are ideal for peaceful darshan, quiet prayers, and pleasant temperatures.'
      };
    }
    if (type.includes('fort') || type.includes('monument') || type.includes('memorial') || type.includes('tomb') || name.includes('gate') || name.includes('fort')) {
      return {
        slot: 'Morning',
        note: 'Morning hours are ideal for a pleasant visit.'
      };
    }
    if (type.includes('beach') || type.includes('viewpoint') || type.includes('sunset') || type.includes('lake') || name.includes('drive') || name.includes('beach')) {
      return {
        slot: 'Evening',
        note: 'Evening hours offer breathtaking sunset views, pleasant breeze, and vibrant strolls.'
      };
    }
    if (type.includes('museum') || type.includes('gallery') || type.includes('planetarium')) {
      return {
        slot: 'Afternoon',
        note: 'Afternoon hours are ideal for air-conditioned indoor exhibits and detailed galleries.'
      };
    }
    if (type.includes('market') || type.includes('bazaar') || type.includes('food') || type.includes('street')) {
      return {
        slot: 'Evening',
        note: 'Evening hours bring bustling local stalls, lively vibes, and freshly prepared food.'
      };
    }
    return {
      slot: 'Morning',
      note: 'Morning hours are ideal for a pleasant visit.'
    };
  };

  return (
    <div className="w-full p-4 sm:p-6">
      
      {/* Header */}
      <div className="mb-6 text-center sm:text-left">
        <span className="text-xs font-bold text-[#D4B15A] uppercase tracking-widest bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
          <FontAwesomeIcon icon={faClock} className="mr-1" /> Step 3: Time & Schedule Assignment
        </span>
        <h2 className="text-3xl font-display font-bold text-gray-900 mt-2">
          Schedule Your Selected Attractions
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Tell us which day and time slot you would like to visit each tourist hub.
        </p>
      </div>

      {/* Booked Transport Banner */}
      {(outboundTransport || returnTransport) && (
        <div className="mb-6 bg-[#121619] text-white p-4 rounded-2xl border border-[#D4B15A]/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
          <div>
            <span className="text-[10px] font-extrabold text-[#D4B15A] uppercase tracking-wider block mb-0.5">
              Booked Flight / Bus Timings
            </span>
            <p className="text-gray-300 font-medium">
              {outboundTransport ? `🛫 Day 1 Arrival: ${outboundTransport.arrTime} (${outboundTransport.operator})` : ''}
              {outboundTransport && returnTransport ? '  |  ' : ''}
              {returnTransport ? `🛬 Last Day Departure: ${returnTransport.depTime} (${returnTransport.operator})` : ''}
            </p>
          </div>
          <span className="text-[11px] text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-lg border border-emerald-500/30">
            Schedule your spots after arrival time
          </span>
        </div>
      )}

      {selectedPlaces.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <p className="text-gray-500 mb-4">No tourist hubs selected yet.</p>
          <button 
            onClick={onBack}
            className="bg-[#121619] text-[#D4B15A] px-6 py-2.5 rounded-xl font-bold text-xs cursor-pointer"
          >
            ← Go Back to Select Places
          </button>
        </div>
      ) : (
        <div className="space-y-6 mb-8">
          {selectedPlaces.map((place, idx) => {
            const currentSched = scheduleData[place.id] || { day: `Day ${(idx % totalDays) + 1}`, timeSlot: 'Morning' };
            const rec = getRecommendedTime(place);
            const photoUrl = place.image || placeImages[place.id] || 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=400&q=80';

            return (
              <div 
                key={place.id}
                className="relative bg-white rounded-3xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6"
              >
                {/* Floating Category & Index Badge (Image 4) */}
                <div className="absolute -top-3 left-6 z-10 flex items-center gap-1.5">
                  <div className="bg-[#1f2937] text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-md flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full bg-[#D4B15A] text-[#121619] inline-flex items-center justify-center text-[10px] font-black">{idx + 1}</span>
                    <span>{place.type || 'ATTRACTION'}</span>
                  </div>
                </div>

                {/* Left & Middle: Photo + Place Details */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 min-w-0 pt-2 lg:pt-0">
                  {/* Photo thumbnail */}
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden shrink-0 bg-gray-100 border border-gray-200 shadow-sm">
                    <img 
                      src={photoUrl} 
                      alt={place.name}
                      className="w-full h-full object-cover"
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=400&q=80'; }}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xl font-bold text-gray-900 leading-snug">
                      {place.name}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
                      <span>📍 {place.city ? `${place.city}, ${place.state || place.city}` : 'Destination'}</span>
                      <span>•</span>
                      <span className="bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded-md">
                        Approx {place.time_needed_to_visit_hrs || 5} hrs visit
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2.5 line-clamp-2 leading-relaxed">
                      {place.description || `An iconic destination landmark in ${place.city || 'the region'}, perfect for history lovers, sightseeing, and evening walks.`}
                    </p>
                  </div>
                </div>

                {/* Right: Selectors & Recommended Time Slot Box (Image 4) */}
                <div className="w-full lg:w-84 shrink-0 bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Day Picker */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        DAY
                      </label>
                      <div className="relative">
                        <select
                          value={currentSched.day}
                          onChange={(e) => onUpdateSchedule(place.id, e.target.value, currentSched.timeSlot)}
                          className="w-full pl-3 pr-7 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#D4B15A] appearance-none cursor-pointer shadow-sm"
                        >
                          {daysList.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▼</span>
                      </div>
                    </div>

                    {/* Time Slot Picker */}
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                        TIME SLOT
                      </label>
                      <div className="relative">
                        <select
                          value={currentSched.timeSlot}
                          onChange={(e) => onUpdateSchedule(place.id, currentSched.day, e.target.value)}
                          className="w-full pl-3 pr-7 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 outline-none focus:border-[#D4B15A] appearance-none cursor-pointer shadow-sm"
                        >
                          {timeSlots.map(t => (
                            <option key={t.id} value={t.id}>{t.label}</option>
                          ))}
                        </select>
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-xs">▼</span>
                      </div>
                    </div>
                  </div>

                  {/* Recommended time slot alert box (Image 4) */}
                  <div className="mt-3 bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                      <FontAwesomeIcon icon={faClock} className="text-emerald-600 text-[11px]" />
                      <span>Recommended time slot</span>
                    </div>
                    <p className="text-emerald-700 mt-1 text-[11px] leading-relaxed">
                      {rec.note}
                    </p>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-4 border-t border-gray-200">
        <button
          onClick={onBack}
          className="px-6 py-3 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to Flight/Bus Tickets
        </button>

        <button
          onClick={onNext}
          className="px-8 py-3 bg-[#e65c00] hover:bg-[#cf5300] text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer"
        >
          <span>Next: Hotel Selection</span>
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>

    </div>
  );
}

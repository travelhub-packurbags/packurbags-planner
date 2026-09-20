import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faStar, 
  faInfoCircle, 
  faCheck, 
  faArrowRight, 
  faSearch, 
  faCamera, 
  faClock, 
  faMoneyBillWave, 
  faPlane, 
  faCalendarCheck, 
  faXmark,
  faLandmark,
  faCloudSun,
  faShieldHeart,
  faFilter,
  faUmbrella,
  faSun,
  faTemperatureHigh
} from '@fortawesome/free-solid-svg-icons';
import { fetchWeather, getPrecautions } from '../../services/weather';
import { searchPlaces, getPlaceDetails, fetchGoogleAttractions } from '../../services/places';
import { faSpinner, faLocationDot } from '@fortawesome/free-solid-svg-icons';
import { fetchFoursquareImage } from '../../services/foursquare'; // Google Places â€” restaurants only (Step5)
import { fetchWikipediaImage } from '../../services/wikipedia';    // Wikipedia — tourist places
import { geocodeCityORS, fetchORSTouristPlaces, fetchNearestCityORS } from '../../services/orsPlaces'; // ORS fallback
import { saveSelectedImage, getSelectedImage } from '../../services/supabaseStorage';

export default function Step1Places({ destination, selectedPlaces, onTogglePlace, onNext, tripType = 'Family Trip' }) {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [googleSuggestions, setGoogleSuggestions] = useState([]);
  const [searchingGoogle, setSearchingGoogle] = useState(false);
  const [activeModalPlace, setActiveModalPlace] = useState(null);
  
  // Per-hub weather map { [cityName]: weatherData }
  const [cityWeatherMap, setCityWeatherMap] = useState({});
  const [filterByVibe, setFilterByVibe] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [placeImages, setPlaceImages] = useState({});

  const CATEGORIES = [
    'All',
    'Historical',
    'Temples',
    'Beaches',
    'Nature',
    'Museums',
    'Adventure',
    'Food'
  ];

  const matchesCategory = (place, cat) => {
    if (cat === 'All') return true;
    const name = (place.name || '').toLowerCase();
    const type = (place.type || '').toLowerCase();
    const sig = (place.significance || '').toLowerCase();
    const desc = (place.description || '').toLowerCase();
    const catIds = place.category_ids || [];
    const osm = place.osm_tags || {};
    const osmHistoric = (osm.historic || '').toLowerCase();
    const osmTourism = (osm.tourism || '').toLowerCase();
    const osmAmenity = (osm.amenity || '').toLowerCase();
    const osmNatural = (osm.natural || '').toLowerCase();
    const osmLeisure = (osm.leisure || '').toLowerCase();
    const osmSport = (osm.sport || '').toLowerCase();

    if (cat === 'Historical') {
      if (catIds.includes(268) || catIds.includes(150)) return true;
      if (osmHistoric || osmTourism === 'monument' || osmHistoric === 'fort' || osmHistoric === 'monument' || osmHistoric === 'castle') return true;
      return type.includes('historic') || type.includes('fort') || type.includes('monument') || type.includes('memorial') || type.includes('tomb') || type.includes('palace') || type.includes('ruins') || type.includes('heritage') || type.includes('gate') || sig.includes('historic') || name.includes('fort') || name.includes('palace') || name.includes('gate') || name.includes('tomb') || desc.includes('history') || desc.includes('historic');
    }

    if (cat === 'Temples') {
      if (catIds.includes(550)) return true;
      if (osmAmenity === 'place_of_worship' || osm.religion || osmTourism === 'temple') return true;
      return type.includes('temple') || type.includes('mandir') || type.includes('mosque') || type.includes('masjid') || type.includes('church') || type.includes('cathedral') || type.includes('gurudwara') || type.includes('shrine') || type.includes('ashram') || type.includes('spiritual') || type.includes('religious') || sig.includes('religious') || name.includes('temple') || name.includes('mandir') || name.includes('church') || name.includes('mosque') || name.includes('gurudwara') || desc.includes('temple') || desc.includes('worship') || desc.includes('spiritual');
    }

    if (cat === 'Beaches') {
      if (catIds.includes(380) && osmNatural === 'beach') return true;
      if (osmNatural === 'beach' || osmTourism === 'beach') return true;
      return type.includes('beach') || type.includes('coast') || type.includes('sea') || type.includes('shore') || name.includes('beach') || desc.includes('beach');
    }

    if (cat === 'Nature') {
      if (catIds.includes(390) || catIds.includes(380) || catIds.includes(344)) return true;
      if (['park', 'nature_reserve', 'garden'].includes(osmLeisure) || osmTourism === 'viewpoint') return true;
      return type.includes('park') || type.includes('garden') || type.includes('lake') || type.includes('waterfall') || type.includes('falls') || type.includes('valley') || type.includes('hill') || type.includes('viewpoint') || type.includes('wildlife') || type.includes('sanctuary') || type.includes('forest') || type.includes('nature') || type.includes('river') || name.includes('lake') || name.includes('park') || name.includes('garden') || name.includes('falls') || name.includes('waterfall') || desc.includes('nature') || desc.includes('scenic');
    }

    if (cat === 'Museums') {
      if (catIds.includes(267) || catIds.includes(191)) return true;
      if (osmTourism === 'museum' || osmAmenity === 'arts_centre') return true;
      return type.includes('museum') || type.includes('gallery') || type.includes('exhibition') || type.includes('planetarium') || type.includes('art') || name.includes('museum') || name.includes('gallery') || desc.includes('museum') || desc.includes('exhibit');
    }

    if (cat === 'Adventure') {
      if (catIds.includes(530)) return true;
      if (osmSport || osmLeisure === 'water_park' || osmTourism === 'theme_park') return true;
      return type.includes('adventure') || type.includes('trek') || type.includes('trekking') || type.includes('water park') || type.includes('safari') || type.includes('rafting') || type.includes('camping') || type.includes('thrill') || name.includes('adventure') || name.includes('trek') || desc.includes('adventure') || desc.includes('trekking');
    }

    if (cat === 'Food') {
      if (osmAmenity === 'restaurant' || osmAmenity === 'cafe' || osmAmenity === 'fast_food' || osmAmenity === 'food_court') return true;
      return type.includes('food') || type.includes('dining') || type.includes('market') || type.includes('bazaar') || type.includes('cafe') || type.includes('restaurant') || type.includes('street food') || name.includes('market') || name.includes('bazaar') || name.includes('bazar') || desc.includes('food') || desc.includes('cuisine') || desc.includes('market');
    }

    return true;
  };

  // StrictMode guard â€” prevents the double-invoke from firing loadPlacesAndWeather twice.
  // Reset when destination changes so a real city change re-fetches correctly.
  const loadingRef = useRef(false);
  const lastDestinationRef = useRef(null);

  useEffect(() => {
    // Skip the StrictMode duplicate invocation
    if (loadingRef.current && lastDestinationRef.current === destination) return;
    loadingRef.current = true;
    lastDestinationRef.current = destination;

    const loadPlacesAndWeather = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}data/tourist_places.json`);
        const data = await res.json();

        const targetCity = (destination || '').toLowerCase().trim();
        let filtered = data.filter(p => p.city.toLowerCase().includes(targetCity) || targetCity.includes(p.city.toLowerCase()));

        if (filtered.length < 3) {
          const fallback = data.filter(p =>
            p.state.toLowerCase().includes(targetCity) ||
            p.zone.toLowerCase().includes(targetCity) ||
            targetCity.includes(p.state.toLowerCase()) ||
            targetCity.includes(p.zone.toLowerCase())
          );
          if (fallback.length > 0) {
            filtered = [...filtered, ...fallback];
            filtered = Array.from(new Set(filtered.map(a => a.id))).map(id => filtered.find(a => a.id === id));
          }
        }

        // Call fetchGoogleAttractions to supplement place data when local JSON has < 5 results.
        // Photos are NOT fetched here â€” Wikipedia handles them in the useEffect below.
        const finalCity = (destination || '').split(',').pop().trim();
        let googlePlaces = [];
        try {
          googlePlaces = await fetchGoogleAttractions(finalCity);
        } catch (err) {
          console.error("Failed to load places from Google:", err);
        }

        if (googlePlaces.length > 0 && filtered.length < 5) {
          if (filtered.length === 0) {
            filtered = googlePlaces;
          } else {
            const existingNames = new Set(filtered.map(p => (p.name || '').toLowerCase()));
            const newFromGoogle = googlePlaces.filter(p => !existingNames.has((p.name || '').toLowerCase()));
            filtered = [...filtered, ...newFromGoogle];
          }
        }

        // â”€â”€ ORS POI Fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Only runs when local dataset + Google both returned nothing.
        // Hard cap: max 2 places. Two ORS calls max (geocode + POI, or +reverse).
        // Any failure is silent â€” falls through to empty state.
        if (filtered.length === 0) {
          try {
            const coords = await geocodeCityORS(finalCity);
            if (coords) {
              // Attempt 1: 5km radius
              let orsPlaces = await fetchORSTouristPlaces(coords.lat, coords.lng, 2, 5000);

              // Attempt 2: widen to 20km if nothing found (small towns like Pilkhuwa)
              if (orsPlaces.length === 0) {
                orsPlaces = await fetchORSTouristPlaces(coords.lat, coords.lng, 2, 20000);
              }

              // Attempt 3: reverse-geocode to nearest city, fetch that city's POIs
              if (orsPlaces.length === 0) {
                const nearest = await fetchNearestCityORS(coords.lat, coords.lng);
                if (nearest) {
                  orsPlaces = await fetchORSTouristPlaces(nearest.lat, nearest.lng, 2, 5000);
                  // Label so the user knows these aren't from their exact destination
                  orsPlaces = orsPlaces.map(p => ({
                    ...p,
                    city: nearest.cityName,
                    nearbyNote: `Near ${nearest.cityName}`,
                  }));
                }
              }

              filtered = orsPlaces.slice(0, 2);
            }
          } catch (orsErr) {
            console.warn('[ORS Fallback] Skipped:', orsErr.message);
            // filtered stays [] â†’ empty state UI renders below
          }
        }
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


        setPlaces(filtered);

        // Fetch live XWeather data for each unique city represented in the hubs
        const uniqueCities = Array.from(new Set(filtered.map(p => p.city).filter(Boolean)));
        const wMap = {};
        await Promise.all(
          uniqueCities.map(async (city) => {
            try {
              const wData = await fetchWeather(city);
              wMap[city] = wData;
            } catch (e) {
              console.warn(`Weather load failed for ${city}:`, e);
            }
          })
        );
        setCityWeatherMap(wMap);
      } catch (err) {
        console.error("Failed to load tourist places or weather:", err);
      } finally {
        setLoading(false);
      }
    };
    loadPlacesAndWeather();
    // Reset guard on cleanup so a real destination change re-fetches
    return () => { loadingRef.current = false; };
  }, [destination]);

  // â”€â”€â”€ Wikipedia photo loader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Runs after places are set. Fetches Wikipedia thumbnail for each place
  // that doesn't already have an image. Wikipedia is free, no auth, 200 req/s
  // limit â€” completely immune to 429. Uses ctrl-cancel for StrictMode safety.
  useEffect(() => {
    if (!places || places.length === 0) return;
    const ctrl = { cancelled: false };

    (async () => {
      await new Promise(r => setTimeout(r, 50));
      if (ctrl.cancelled) return;

      let loaded = 0;
      for (const place of places) {
        if (ctrl.cancelled) break;
        const isGenericFallback = (url) => !url || url.includes('1596178065887');

        // Check if already in storage
        const cached = getSelectedImage('place', place.id);
        if (!isGenericFallback(cached)) {
          place.image = cached;
          setPlaceImages(prev => ({ ...prev, [`${place.name}::${place.city}`]: cached }));
          continue;
        }

        if (place.image && !isGenericFallback(place.image)) {
          saveSelectedImage('place', place.id, place.image, { name: place.name, city: place.city });
          continue;
        }

        const img = await fetchWikipediaImage(place.name, place.city);
        if (ctrl.cancelled) break;
        if (img) {
          place.image = img;
          saveSelectedImage('place', place.id, img, { name: place.name, city: place.city });
          setPlaceImages(prev => ({ ...prev, [`${place.name}::${place.city}`]: img }));
          loaded++;
        }
        await new Promise(r => setTimeout(r, 60));
      }

      if (!ctrl.cancelled && loaded > 0) {
        toast.success(
          `📸 ${loaded} tourist spot photo${loaded > 1 ? 's' : ''} loaded via Wikipedia!`,
          { position: 'bottom-right', autoClose: 3000 }
        );
      }
    })();

    return () => { ctrl.cancelled = true; };
  }, [places]);


  // Live Google Places Search Autocomplete


  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setGoogleSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingGoogle(true);
      try {
        const results = await searchPlaces(searchQuery);
        setGoogleSuggestions(results);
      } catch (e) {
        console.warn("Live places search failed:", e);
      } finally {
        setSearchingGoogle(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectGooglePlace = async (suggestion) => {
    setSearchingGoogle(true);
    setGoogleSuggestions([]);
    try {
      const details = await getPlaceDetails(suggestion.placeId);
      if (details) {
        const placeName = details.displayName || details.name;
        const placeCity = destination || 'India';
        const newPlaceObj = {
          id: details.id || details.placeId || `p_${Date.now()}`,
          name: placeName,
          city: placeCity,
          type: 'Tourist Hub',
          entrance_fee_inr: details.entrance_fee_inr ?? 0,
          dslr_allowed: details.dslr_allowed || 'Yes',
          weekly_off: details.weekly_off || 'None',
          rating: details.rating || 4.5,
          lat: details.lat,
          lng: details.lng,
          image: null, // will be set below
          description: details.formattedAddress || 'Popular destination landmark.'
        };

        setPlaces(prev => [newPlaceObj, ...prev]);
        onTogglePlace(newPlaceObj);
        setSearchQuery('');

        // Fetch Wikipedia photo for the newly searched/selected spot
        const wikiImg = await fetchWikipediaImage(placeName, placeCity);
        if (wikiImg) {
          setPlaceImages(prev => ({ ...prev, [`${placeName}::${placeCity}`]: wikiImg }));
          toast.success(`ðŸ“¸ Photo loaded for "${placeName}" via Wikipedia!`, {
            position: 'bottom-right',
            autoClose: 2500,
          });
        }
      }
    } catch (e) {
      console.error("Error adding place from Google suggestion:", e);
    } finally {
      setSearchingGoogle(false);
    }
  };


  // Fetch weather on-the-fly when modal is opened if not available
  const handleOpenModal = async (place) => {
    setActiveModalPlace(place);
    if (place?.city && !cityWeatherMap[place.city]) {
      try {
        const wData = await fetchWeather(place.city);
        setCityWeatherMap(prev => ({ ...prev, [place.city]: wData }));
      } catch (e) {
        console.warn(`On-demand weather load failed for ${place.city}:`, e);
      }
    }
  };

  // Relevance score by trip type
  const getSpotRelevanceScore = (place) => {
    const t = (place.type || '').toLowerCase();
    const sig = (place.significance || '').toLowerCase();
    const desc = (place.description || '').toLowerCase();
    
    if (tripType.includes('Family')) {
      if (sig.includes('religious') || sig.includes('historical') || sig.includes('cultural')) return 3;
      if (t.includes('temple') || t.includes('fort') || t.includes('garden') || t.includes('museum') || t.includes('monument') || t.includes('park') || t.includes('lake')) return 2;
      if (t.includes('adventure') || desc.includes('extreme')) return 0;
      return 1;
    }
    if (tripType.includes('Friends')) {
      if (t.includes('adventure') || t.includes('trekking') || t.includes('beach') || t.includes('water') || t.includes('viewpoint') || t.includes('fort') || t.includes('waterfall') || desc.includes('thrill')) return 3;
      if (t.includes('market') || t.includes('lake') || t.includes('park')) return 2;
      return 1;
    }
    if (tripType.includes('Couples') || tripType.includes('Romantic')) {
      if (t.includes('beach') || t.includes('viewpoint') || t.includes('sunset') || t.includes('lake') || t.includes('hill') || t.includes('garden') || t.includes('island') || t.includes('boating') || desc.includes('scenic') || desc.includes('sunset')) return 3;
      if (t.includes('fort') || t.includes('resort') || t.includes('monument')) return 2;
      return 1;
    }
    if (tripType.includes('Solo')) {
      if (t.includes('museum') || t.includes('cultural') || t.includes('spiritual') || t.includes('temple') || t.includes('trekking') || t.includes('fort') || desc.includes('peaceful') || desc.includes('art')) return 3;
      return 2;
    }
    // Corporate / Business
    if (t.includes('memorial') || t.includes('iconic') || t.includes('monument') || t.includes('museum') || t.includes('park') || t.includes('mall')) return 3;
    return 1;
  };

  const sortedAndFilteredPlaces = [...places]
    .map(p => ({ ...p, vibeScore: getSpotRelevanceScore(p) }))
    .filter(p => !filterByVibe || p.vibeScore >= 1)
    .filter(p => matchesCategory(p, selectedCategory))
    .sort((a, b) => b.vibeScore - a.vibeScore);

  const displayedPlaces = sortedAndFilteredPlaces.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    <div className="w-full p-4 sm:p-5">
      
      {/* Step Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <span className="text-xs font-bold text-[#D4B15A] uppercase tracking-widest bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
            Step 1: Sightseeing Selection
          </span>
          <h2 className="text-3xl font-display font-bold text-gray-900 mt-2">
            Popular Tourist Hubs in {destination || 'Destination'}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Choose the attractions you wish to visit during your trip.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
            <input 
              type="text" 
              placeholder="Search spots (Google Places)..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#D4B15A]"
            />
            {searchingGoogle && (
              <FontAwesomeIcon icon={faSpinner} spin className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D4B15A] text-xs" />
            )}

            {/* Google Places Autocomplete Dropdown */}
            {googleSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-56 overflow-y-auto">
                {googleSuggestions.map((item, i) => (
                  <button
                    key={item.placeId || i}
                    onClick={() => handleSelectGooglePlace(item)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-amber-50 border-b border-gray-50 last:border-none flex items-center justify-between transition-colors text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={faLocationDot} className="text-[#D4B15A] shrink-0" />
                      <span className="font-semibold text-gray-800 truncate">{item.text || item.displayName}</span>
                    </div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {item.source === 'google' ? 'Google' : 'Offline'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onNext}
            disabled={selectedPlaces.length === 0}
            className="bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] disabled:bg-gray-300 disabled:text-gray-500 font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 text-sm shadow-md shrink-0 cursor-pointer"
          >
            <span>Schedule ({selectedPlaces.length})</span>
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>

      {/* Trip Vibe Curator Banner */}
      <div className="mb-4 bg-amber-500/10 border border-[#D4B15A]/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-base">✨</span>
          <div>
            <span className="font-extrabold text-[#D4B15A] uppercase tracking-wider block">
              Curated for {tripType}
            </span>
            <p className="text-gray-700 font-medium">
              Showing tourist hotspots best suited for your {tripType.toLowerCase()} experience.
            </p>
          </div>
        </div>

        <button
          onClick={() => setFilterByVibe(!filterByVibe)}
          className="bg-white hover:bg-gray-50 text-gray-900 px-3.5 py-1.5 rounded-xl font-bold border border-gray-200 shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <FontAwesomeIcon icon={faFilter} className="text-[#D4B15A]" />
          <span>{filterByVibe ? 'Show All Spots' : `Filter by ${tripType}`}</span>
        </button>
      </div>

      {/* Category Filter Pills (Image 1 & 2) */}
      <div className="flex items-center gap-2.5 overflow-x-auto pb-2 mb-6 scrollbar-none">
        {CATEGORIES.map(cat => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm cursor-pointer ${
                isActive
                  ? 'bg-[#f97316] text-white shadow-orange-300/40 font-bold'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/90'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#D4B15A]"></div>
        </div>
      ) : displayedPlaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="text-5xl mb-4">🗺️</div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">No Tourist Hotspots Found</h3>
          <p className="text-gray-500 text-sm max-w-md">
            {selectedCategory !== 'All' 
              ? `No "${selectedCategory}" spots found for ${destination}. Try selecting "All" or searching manually.` 
              : `We don't have curated tourist spots for ${destination} in our dataset yet. You can still use the Search bar above to find and add specific attractions manually.`}
          </p>
          {selectedCategory !== 'All' && (
            <button
              onClick={() => setSelectedCategory('All')}
              className="mt-3 text-xs font-bold text-[#D4B15A] bg-[#121619] px-4 py-2 rounded-xl"
            >
              Show All Spots
            </button>
          )}
          <p className="text-xs text-gray-400 mt-3">
            You can skip this step and proceed directly by clicking <strong>"Schedule (0)"</strong> → the AI will still plan your trip.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayedPlaces.map(place => {
            const isSelected = selectedPlaces.some(p => p.id === place.id);
            const hubWeather = cityWeatherMap[place.city]?.dailySummary?.[0];
            return (
              <div 
                key={place.id}
                className={`group relative bg-white rounded-2xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                  isSelected 
                    ? 'border-[#D4B15A] ring-2 ring-[#D4B15A]/30 shadow-lg' 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Place Image — Google photo (for searched places) or Wikipedia fallback */}
                  {(place.image || placeImages[`${place.name}::${place.city}`]) && (
                    <div className="mb-3 rounded-xl overflow-hidden h-40 w-full">
                      <img
                        src={place.image || placeImages[`${place.name}::${place.city}`]}
                        alt={place.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                  )}
                  {/* Category & Badge */}
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-white bg-[#1f2937] px-3 py-1 rounded-md shadow-sm">
                        {place.type || 'Attraction'}
                      </span>
                      {place.nearbyNote && (
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-md">
                          📍 {place.nearbyNote}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-lg text-xs">
                      {renderStars(place.google_review_rating)}
                      <span className="font-bold text-gray-700 ml-1">{place.google_review_rating}</span>
                    </div>
                  </div>

                  {/* Title & City with Weather Pill */}
                  <h3 
                    onClick={() => handleOpenModal(place)}
                    className="text-xl font-bold text-gray-900 group-hover:text-[#D4B15A] transition-colors leading-tight mb-1 cursor-pointer"
                  >
                    {place.name}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-3">
                    <span>ðŸ“ {place.city}, {place.state}</span>
                    {hubWeather && (
                      <span className="bg-amber-500/10 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-500/20 flex items-center gap-1">
                        ðŸŒ¤ï¸ {hubWeather.maxTemp}Â°C â€¢ Rain: {hubWeather.maxRain}%
                      </span>
                    )}
                  </div>

                  {/* Description preview */}
                  <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed mb-4">
                    {place.description || `Famous ${place.type} in ${place.city}.`}
                  </p>
                </div>

                {/* Card Footer Actions */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button 
                    onClick={() => handleOpenModal(place)}
                    className="text-xs font-semibold text-gray-600 hover:text-[#121619] bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faInfoCircle} className="text-[#D4B15A]" />
                    Know More
                  </button>

                  <button
                    onClick={() => {
                      const spotImg = place.image || placeImages[`${place.name}::${place.city}`];
                      onTogglePlace({ ...place, image: spotImg || place.image });
                    }}
                    className={`text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A]'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <FontAwesomeIcon icon={faCheck} />
                        Selected
                      </>
                    ) : (
                      '+ Add to Trip'
                    )}
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Know More Modal */}
      {activeModalPlace && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-[#121619] text-white p-6 relative">
              <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#D4B15A] bg-white/10 px-2.5 py-1 rounded-md mb-2 inline-block">
                {activeModalPlace.type} â€¢ {activeModalPlace.city}
              </span>
              <h3 className="text-2xl font-bold text-white font-display">
                {activeModalPlace.name}
              </h3>
              <p className="text-xs text-gray-400 mt-1">{activeModalPlace.significance} Significance</p>
              
              <button 
                onClick={() => setActiveModalPlace(null)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white bg-white/10 p-2 rounded-full transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faXmark} className="text-lg" />
              </button>
            </div>

            {/* Modal Specs & Hub-Specific Weather */}
            <div className="p-6 overflow-y-auto space-y-6">

              {/* Hub Specific Weather Update Card */}
              {(() => {
                const hubWeather = cityWeatherMap[activeModalPlace.city];
                const daySummary = hubWeather?.dailySummary?.[0];
                const hubPrecautions = hubWeather?.alerts ? getPrecautions(hubWeather.alerts) : [];

                return (
                  <div className="bg-gradient-to-r from-[#121619] via-gray-900 to-[#121619] text-white p-5 rounded-2xl border border-[#D4B15A]/30 shadow-lg">
                    <div className="flex items-center justify-between gap-3 mb-3 border-b border-white/10 pb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#D4B15A]/20 border border-[#D4B15A]/30 flex items-center justify-center text-lg text-[#D4B15A]">
                          <FontAwesomeIcon icon={faCloudSun} />
                        </div>
                        <div>
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4B15A]">
                            XWeather Live Update â€¢ {activeModalPlace.name}
                          </span>
                          <h4 className="font-bold text-white text-sm">
                            ðŸ“ {activeModalPlace.city} Weather Conditions
                          </h4>
                        </div>
                      </div>
                      {daySummary && (
                        <div className="text-right">
                          <span className="text-base font-extrabold text-[#D4B15A] block">
                            {daySummary.maxTemp}Â°C / {daySummary.minTemp}Â°C
                          </span>
                          <span className="text-[10px] text-gray-400 font-semibold uppercase">{daySummary.mainWeather}</span>
                        </div>
                      )}
                    </div>

                    {daySummary ? (
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                          <span className="text-gray-400 block text-[10px] uppercase font-semibold">Rain Probability</span>
                          <span className="font-bold text-amber-300 text-xs">{daySummary.maxRain}% Chance</span>
                        </div>
                        <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
                          <span className="text-gray-400 block text-[10px] uppercase font-semibold">Condition</span>
                          <span className="font-bold text-white text-xs">{daySummary.mainWeather}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Fetching live weather updates for {activeModalPlace.city}...</p>
                    )}

                    {hubPrecautions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <span className="text-[10px] font-extrabold text-[#D4B15A] uppercase tracking-wider block mb-1.5">
                          Weather Precautions
                        </span>
                        <div className="flex flex-wrap gap-2 text-xs">
                          {hubPrecautions.map((p, pIdx) => (
                            <span key={pIdx} className="bg-[#D4B15A]/15 text-[#D4B15A] px-2.5 py-1 rounded-lg border border-[#D4B15A]/30 font-semibold flex items-center gap-1.5">
                              <span>{p.icon}</span>
                              <span>{p.text}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <FontAwesomeIcon icon={faClock} className="text-[#D4B15A]" /> Visit Duration
                  </p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{activeModalPlace.time_needed_to_visit_hrs} Hours</p>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <FontAwesomeIcon icon={faMoneyBillWave} className="text-[#D4B15A]" /> Entrance Fee
                  </p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">
                    {activeModalPlace.entrance_fee_inr > 0 ? `â‚¹${activeModalPlace.entrance_fee_inr}` : 'Free Entry'}
                  </p>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <FontAwesomeIcon icon={faCamera} className="text-[#D4B15A]" /> DSLR Allowed
                  </p>
                  <p className={`font-bold text-sm mt-0.5 ${activeModalPlace.dslr_allowed.toLowerCase().includes('yes') ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {activeModalPlace.dslr_allowed}
                  </p>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <FontAwesomeIcon icon={faCalendarCheck} className="text-[#D4B15A]" /> Weekly Off
                  </p>
                  <p className="font-bold text-rose-600 text-sm mt-0.5">{activeModalPlace.weekly_off}</p>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <FontAwesomeIcon icon={faPlane} className="text-[#D4B15A]" /> Airport &lt; 50km
                  </p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{activeModalPlace.airport_within_50km}</p>
                </div>

                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1">
                    <FontAwesomeIcon icon={faLandmark} className="text-[#D4B15A]" /> Best Time
                  </p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{activeModalPlace.best_time_to_visit}</p>
                </div>
              </div>

              {/* Detailed Description */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2">Description & History</h4>
                <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  {activeModalPlace.description}
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setActiveModalPlace(null)}
                className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>

              <button
                onClick={() => {
                  const spotImg = activeModalPlace.image || placeImages[`${activeModalPlace.name}::${activeModalPlace.city}`];
                  onTogglePlace({ ...activeModalPlace, image: spotImg || activeModalPlace.image });
                  setActiveModalPlace(null);
                }}
                className={`px-5 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  selectedPlaces.some(p => p.id === activeModalPlace.id)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#121619] text-[#D4B15A]'
                }`}
              >
                {selectedPlaces.some(p => p.id === activeModalPlace.id) ? 'Remove Spot' : '+ Select Spot'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

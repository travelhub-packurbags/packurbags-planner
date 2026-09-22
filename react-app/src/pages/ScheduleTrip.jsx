import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faWandMagicSparkles, 
  faMapLocationDot, 
  faCalendarAlt, 
  faCarSide, 
  faWallet, 
  faUsers,
  faSliders,
  faArrowRight,
  faRotateLeft,
  faSpinner,
  faLocationDot
} from '@fortawesome/free-solid-svg-icons';
import { generateTripPlan } from '../services/gemini';
import { searchPlaces, geocodeCity } from '../services/places';
import { getRoute } from '../services/routing';
import useAppStore from '../stores/useAppStore';
import TripOutput from '../components/planner/TripOutput';
import DraftHistory from '../components/planner/DraftHistory';

import CustomizationHeader from '../components/planner/CustomizationHeader';
import Step1Places from '../components/planner/Step1Places';
import Step2SchedulePlaces from '../components/planner/Step2SchedulePlaces';
import Step3Hotels from '../components/planner/Step3Hotels';
import Step4Rides from '../components/planner/Step4Rides';
import Step5Dining from '../components/planner/Step5Dining';
import StepTransport from '../components/planner/StepTransport';
import Step6Review from '../components/planner/Step6Review';
import LiveRouteCard from '../components/planner/LiveRouteCard';
import gatewayBg from '../assets/gateway_india_bg.jpg';
import marineDriveBg from '../assets/marine_drive_bg.jpg';
import { saveSelectedImage, getSelectedImage, saveItinerarySnapshot } from '../services/supabaseStorage';
import { fetchWikipediaImage } from '../services/wikipedia';

export default function ScheduleTrip() {
  const [params, setParams] = useState(() => {
    const saved = sessionStorage.getItem('ff_trip_params');
    return saved ? JSON.parse(saved) : { 
      fromCity: 'Delhi',
      locations: 'Mumbai', 
      fromDate: '', 
      toDate: '', 
      mode: 'Bus / Coach', 
      budget: 'balanced',
      budgetNumeric: 50000,
      travellers: 2,
      tripType: 'Family Trip'
    };
  });

  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(() => {
    const saved = sessionStorage.getItem('ff_trip_plan');
    return saved ? JSON.parse(saved) : null;
  });
  const [apiError, setApiError] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [durationModalData, setDurationModalData] = useState(null);
  const { addToast, addDraft } = useAppStore();

  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [searchingFrom, setSearchingFrom] = useState(false);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [searchingDest, setSearchingDest] = useState(false);
  const [hasAlertedBudget, setHasAlertedBudget] = useState(false);

  const isSelectingFromRef = useRef(false);
  const isSelectingDestRef = useRef(false);
  // Prevent autocomplete firing on mount when values are pre-loaded from sessionStorage
  const fromMountedRef = useRef(false);
  const destMountedRef = useRef(false);

  useEffect(() => {
    // Skip first run — value may be pre-filled from sessionStorage
    if (!fromMountedRef.current) { fromMountedRef.current = true; return; }
    if (isSelectingFromRef.current) { isSelectingFromRef.current = false; return; }
    if (!params.fromCity.trim() || params.fromCity.trim().length < 2) {
      setFromSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingFrom(true);
      try {
        const results = await searchPlaces(params.fromCity);
        setFromSuggestions(results);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingFrom(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [params.fromCity]);

  useEffect(() => {
    // Skip first run — value may be pre-filled from sessionStorage
    if (!destMountedRef.current) { destMountedRef.current = true; return; }
    if (isSelectingDestRef.current) { isSelectingDestRef.current = false; return; }
    if (!params.locations.trim() || params.locations.trim().length < 2) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingDest(true);
      try {
        const results = await searchPlaces(params.locations);
        setDestSuggestions(results);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchingDest(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [params.locations]);

  // Navigation Pages: 'input' | 'modeChoice' | 'wizard' | 'result'
  const [pageState, setPageState] = useState(() => {
    return sessionStorage.getItem('ff_trip_page_state') || 'input';
  });
  
  // Customization Wizard Step (1..7)
  const [wizardStep, setWizardStep] = useState(() => {
    const saved = sessionStorage.getItem('ff_trip_wizard_step');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Wizard State
  const [wizardData, setWizardData] = useState(() => {
    const saved = sessionStorage.getItem('ff_trip_wizard_data');
    return saved ? JSON.parse(saved) : {
      selectedPlaces: [],
      scheduleData: {},
      selectedHotels: [],
      selectedRides: [],
      selectedCafes: [],
      selectedRestaurants: [],
      outboundTransport: null,
      returnTransport: null
    };
  });

  // Sync state to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('ff_trip_params', JSON.stringify(params));
  }, [params]);

  useEffect(() => {
    sessionStorage.setItem('ff_trip_page_state', pageState);
  }, [pageState]);

  useEffect(() => {
    sessionStorage.setItem('ff_trip_wizard_step', wizardStep.toString());
  }, [wizardStep]);

  useEffect(() => {
    sessionStorage.setItem('ff_trip_wizard_data', JSON.stringify(wizardData));
  }, [wizardData]);

  useEffect(() => {
    if (plan) {
      sessionStorage.setItem('ff_trip_plan', JSON.stringify(plan));
    } else {
      sessionStorage.removeItem('ff_trip_plan');
    }
  }, [plan]);

  const resetTripForm = () => {
    setParams({ 
      fromCity: 'Delhi',
      locations: 'Mumbai', 
      fromDate: '', 
      toDate: '', 
      mode: 'Bus / Coach', 
      budget: 'balanced',
      travellers: 2,
      tripType: 'Family Trip'
    });
    setWizardStep(1);
    setWizardData({
      selectedPlaces: [],
      scheduleData: {},
      selectedHotels: [],
      selectedRides: [],
      selectedCafes: [],
      selectedRestaurants: [],
      outboundTransport: null,
      returnTransport: null
    });
    setPlan(null);
    setPageState('input');
    sessionStorage.removeItem('ff_trip_params');
    sessionStorage.removeItem('ff_trip_page_state');
    sessionStorage.removeItem('ff_trip_wizard_step');
    sessionStorage.removeItem('ff_trip_wizard_data');
    sessionStorage.removeItem('ff_trip_plan');
  };

  // Calculate Days count between fromDate and toDate
  const calculateTotalDays = (p = params) => {
    if (!p.fromDate || !p.toDate) return 3;
    const f = new Date(p.fromDate);
    const t = new Date(p.toDate);
    const diff = Math.round(Math.abs(t - f) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  // Check if travel mode involves road/driving transit
  const isRoadTripMode = (mode = '') => {
    const m = String(mode).toLowerCase();
    return m.includes('car') || m.includes('bus') || m.includes('coach') ||
           m.includes('bike') || m.includes('drive') || m.includes('vehicle') ||
           m.includes('personal') || m.includes('rental') || m.includes('road');
  };

  // Validate Trip Duration for road travel (max 8-10 hours travel per day)
  const checkTripDuration = async (currentParams = params) => {
    const fromCity = (currentParams.fromCity || 'Delhi').trim();
    const toCity = (currentParams.locations || 'Mumbai').split(',')[0].trim();
    const mode = currentParams.mode || '';

    if (!isRoadTripMode(mode)) {
      return { ok: true, travelDays: 0, routeInfo: null };
    }

    const totalDays = calculateTotalDays(currentParams);

    let distanceKm = 0;
    let drivingHours = 0;
    let durationDisplay = '';
    let routeInfo = null;

    try {
      const [fromCoords, toCoords] = await Promise.all([
        geocodeCity(fromCity),
        geocodeCity(toCity)
      ]);

      if (fromCoords && toCoords) {
        try {
          const r = await getRoute([[fromCoords.lng, fromCoords.lat], [toCoords.lng, toCoords.lat]]);
          if (r && r.durationHours) {
            routeInfo = r;
            distanceKm = r.distanceKm || Math.round((r.distanceMeters || 0) / 1000);
            drivingHours = r.durationHours;
            durationDisplay = r.durationDisplay || `${Math.round(drivingHours)} hrs`;
          }
        } catch (err) {
          console.warn('[checkTripDuration] Route calculation fallback:', err);
        }

        if (!drivingHours) {
          const R = 6371;
          const dLat = (toCoords.lat - fromCoords.lat) * Math.PI / 180;
          const dLon = (toCoords.lng - fromCoords.lng) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(fromCoords.lat * Math.PI / 180) * Math.cos(toCoords.lat * Math.PI / 180) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const straightKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
          distanceKm = Math.round(straightKm * 1.28);
          drivingHours = Math.round((distanceKm / 55) * 10) / 10;
          const h = Math.floor(drivingHours);
          const m = Math.round((drivingHours % 1) * 60);
          durationDisplay = `${h}h ${m}m`;
          routeInfo = { distanceKm, durationHours: drivingHours, durationDisplay };
        }
      }
    } catch (err) {
      console.warn('[checkTripDuration] Geocoding error:', err);
    }

    // Well-known Indian intercity distance fallback if geocoding completely failed
    if (!drivingHours && fromCity.toLowerCase().includes('delhi') && toCity.toLowerCase().includes('mumbai')) {
      distanceKm = 1415;
      drivingHours = 24.5;
      durationDisplay = '24h 30m';
      routeInfo = { distanceKm, durationHours: drivingHours, durationDisplay };
    }

    // Safety rule: max 8-10 hours of driving possible per day
    if (drivingHours >= 8) {
      const travelDays = Math.ceil(drivingHours / 8);
      const minDays = (travelDays * 2) + 2; // Round-trip transit days + min 2 days at destination

      if (totalDays <= minDays) {
        return {
          ok: false,
          minDays,
          travelDays,
          totalDays,
          fromCity,
          toCity,
          distanceKm,
          drivingHours: durationDisplay || `${drivingHours.toFixed(1)} hrs`,
          routeInfo
        };
      }
    }

    return {
      ok: true,
      travelDays: drivingHours >= 8 ? Math.ceil(drivingHours / 8) : 0,
      routeInfo
    };
  };

  // Form Submit on Page 1
  const handleInputSubmit = async (e) => {
    e.preventDefault();
    if (!params.locations.trim()) {
      addToast({ type: 'error', message: 'Please enter a destination city.' });
      return;
    }

    const check = await checkTripDuration(params);
    if (!check.ok) {
      const msg = `Travel time too long! You need at least ${check.minDays} days for this distance (${check.travelDays} days each way). Please provide more days or switch travel mode.`;
      addToast({ type: 'error', message: msg, title: 'Trip Too Short for Road Travel' });
      setValidationError(msg);
      setDurationModalData(check);
      return;
    }

    setValidationError(null);
    setPageState('modeChoice');
  };

  // Auto-Plan Generator Trigger
  const handleAutoPlan = async () => {
    setLoading(true);
    setPlan(null);
    setApiError(null);
    setValidationError(null);

    // Validate Trip Duration for road travel
    const check = await checkTripDuration(params);
    if (!check.ok) {
      const msg = `Travel time too long! You need at least ${check.minDays} days for this distance (${check.travelDays} days each way). Please provide more days or switch travel mode.`;
      addToast({ type: 'error', message: msg, title: 'Trip Too Short for Road Travel' });
      setValidationError(msg);
      setDurationModalData(check);
      setLoading(false);
      return;
    }

    try {
      const locList = params.locations.split(',').map(s => s.trim()).filter(Boolean);
      
      // Calculate Route Info before hitting Gemini (use route from check if available)
      let routeInfo = check.routeInfo || null;
      if (!routeInfo) {
        try {
          const fromCoords = await geocodeCity(params.fromCity || 'Delhi');
          const destCoords = await Promise.all(locList.map(l => geocodeCity(l)));
          const allCoords = [fromCoords, ...destCoords].filter(Boolean);
          if (allCoords.length >= 2) routeInfo = await getRoute(allCoords);
        } catch (err) { console.warn('Failed to calculate pre-route info:', err); }
      }

      // ── LIVE DSA Transport Fetch based on travel mode ──
      let liveTransport = null;
      const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      try {
        const modeStr = params.mode?.toLowerCase() || '';
        const isFlight = modeStr.includes('flight');
        const isBus    = modeStr.includes('bus');
        if (isFlight || isBus) {
          const transportRes = await fetch(`${BACKEND}/api/dsa/auto-transport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: params.fromCity,
              to: locList[0],
              date: params.fromDate,
              returnDate: params.toDate,
              mode: isFlight ? 'flight' : 'bus',
              adults: params.travellers,
            }),
          });
          const tData = await transportRes.json();
          if (tData.success && (tData.outbound || tData.return)) {
            liveTransport = tData;
            console.log('[AutoPlan] Live DSA transport loaded:', tData.source, tData.outbound?.operator);
          }
        }
      } catch (err) { console.warn('DSA auto-transport fetch failed:', err.message); }

      const generated = await generateTripPlan({
        locations: locList,
        fromDate: params.fromDate,
        toDate: params.toDate,
        mode: params.mode,
        budget: params.budgetNumeric ? `Strict maximum total budget of ₹${params.budgetNumeric}` : params.budget,
        budgetNumeric: params.budgetNumeric,
        fromCity: params.fromCity || 'Delhi',
        travellerCount: params.travellers,
        tripType: params.tripType,
        routeInfo,
        liveTransport,  // Pass DSA live transport data to the AI
      });

      if (generated.error) {
        setApiError(generated.error);
        addToast({ type: 'error', message: generated.error });
      } else {
        if (wizardData.mapSnippet) generated.mapSnippet = wizardData.mapSnippet;
        if (wizardData.liveMapSnippet) generated.liveMapSnippet = wizardData.liveMapSnippet;
        if (liveTransport) generated.liveTransport = liveTransport;
        setPlan(generated);
        setPageState('result');
        addDraft({ params, plan: generated, date: new Date().toISOString() });
        addToast({ type: 'success', title: 'Auto-Plan Ready!', message: liveTransport ? `AI generated with live DSA ${liveTransport.source} data!` : 'AI generated your itinerary.' });
      }
    } catch (err) {
      setApiError(err.message);
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Trigger Custom Itinerary Generation
  const handleCustomPlanGenerate = async () => {
    setLoading(true);
    setPlan(null);
    setApiError(null);
    setValidationError(null);

    // Validate Trip Duration for road travel
    const check = await checkTripDuration(params);
    if (!check.ok) {
      const msg = `Travel time too long! You need at least ${check.minDays} days for this distance (${check.travelDays} days each way). Please provide more days or switch travel mode.`;
      addToast({ type: 'error', message: msg, title: 'Trip Too Short for Road Travel' });
      setValidationError(msg);
      setDurationModalData(check);
      setLoading(false);
      return;
    }

    try {
      const locList = params.locations.split(',').map(s => s.trim()).filter(Boolean);

      // Calculate Route Info before hitting Gemini (use route from check if available)
      let routeInfo = check.routeInfo || null;
      if (!routeInfo) {
        try {
          const fromCoords = await geocodeCity(params.fromCity || 'Delhi');
          const destCoords = await Promise.all(locList.map(l => geocodeCity(l)));
          const allCoords = [fromCoords, ...destCoords].filter(Boolean);
          if (allCoords.length >= 2) {
            routeInfo = await getRoute(allCoords);
          }
        } catch (err) {
          console.warn("Failed to calculate pre-route info:", err);
        }
      }

      let travelDays = check.travelDays || 0;

      // Ensure all customPlaces have authentic Wikipedia images
      const isGenericPlaceFallback = (url) => !url || url.includes('1596178065887');
      const enrichedPlaces = (wizardData.selectedPlaces || []).map(p => {
        const cached = getSelectedImage('place', p.id);
        const img = !isGenericPlaceFallback(p.image) ? p.image : (!isGenericPlaceFallback(cached) ? cached : p.image);
        return { ...p, image: img };
      });

      // Auto-shift destination restaurants and cafes for trips with multi-day travel
      // Ensures user-selected destination restaurants never appear on en-route drive days
      // and maintains a 4-hour gap between 14:00 hotel check-in and restaurant reservation.
      const arrivalDayNum = (travelDays >= 1) ? (travelDays + 1) : 1;
      const arrivalDayStr = `Day ${arrivalDayNum}`;

      const adjustedRestaurants = (wizardData.selectedRestaurants || []).map(r => {
        let dayNum = 1;
        if (r.day) {
          const m = String(r.day).match(/\d+/);
          if (m) dayNum = parseInt(m[0], 10);
        }
        // If assigned to an en-route drive day before reaching destination:
        if (dayNum < arrivalDayNum) {
          return {
            ...r,
            day: arrivalDayStr,
            timeSlot: 'Dinner (07:30 PM)',
            notes: 'Auto-scheduled for arrival day dinner (4-hour gap after 14:00 hotel check-in)'
          };
        }
        // On arrival/check-in day: ensure at least a 4-hour gap after standard 14:00 check-in
        if (dayNum === arrivalDayNum) {
          const slot = (r.timeSlot || '').toLowerCase();
          if (!slot || slot.includes('lunch') || slot.includes('afternoon')) {
            return {
              ...r,
              timeSlot: 'Dinner (07:30 PM)',
              notes: 'Scheduled for dinner to maintain 4-hour gap after 14:00 hotel check-in'
            };
          }
        }
        return r;
      });

      const adjustedCafes = (wizardData.selectedCafes || []).map(c => {
        let dayNum = 1;
        if (c.day) {
          const m = String(c.day).match(/\d+/);
          if (m) dayNum = parseInt(m[0], 10);
        }
        if (dayNum < arrivalDayNum) {
          return {
            ...c,
            day: arrivalDayStr,
            timeSlot: 'Evening (06:30 PM)',
            notes: 'Auto-scheduled for destination arrival evening'
          };
        }
        return c;
      });

      const generated = await generateTripPlan({
        locations: locList,
        fromDate: params.fromDate,
        toDate: params.toDate,
        mode: params.mode,
        budget: params.budgetNumeric ? `Strict maximum total budget of ₹${params.budgetNumeric}` : params.budget,
        budgetNumeric: params.budgetNumeric,
        fromCity: params.fromCity || 'Delhi',
        travellerCount: params.travellers,
        tripType: params.tripType,
        selectedHotels: wizardData.selectedHotels,
        customPlaces: enrichedPlaces,
        scheduleData: wizardData.scheduleData,
        selectedRides: wizardData.selectedRides,
        selectedCafes: adjustedCafes,
        selectedRestaurants: adjustedRestaurants,
        outboundTransport: wizardData.outboundTransport,
        returnTransport: wizardData.returnTransport,
        routeInfo
      });

      if (generated.error) {
        setApiError(generated.error);
        addToast({ type: 'error', message: generated.error });
      } else {
        if (wizardData.mapSnippet) {
          generated.mapSnippet = wizardData.mapSnippet;
        }
        if (wizardData.liveMapSnippet) {
          generated.liveMapSnippet = wizardData.liveMapSnippet;
        }
        generated.wizardData = {
          ...wizardData,
          selectedRestaurants: adjustedRestaurants,
          selectedCafes: adjustedCafes
        };
        generated.selectedHotels = wizardData.selectedHotels;
        generated.selectedRestaurants = adjustedRestaurants;
        generated.selectedCafes = adjustedCafes;
        generated.selectedPlaces = wizardData.selectedPlaces;
        
        saveItinerarySnapshot(generated.id || `itin_${Date.now()}`, {
          wizardData: generated.wizardData,
          generatedPlan: generated,
          params
        });

        setPlan(generated);
        setPageState('result');
        addDraft({ params, plan: generated, date: new Date().toISOString() });
        addToast({ type: 'success', title: 'Customized Itinerary Ready!', message: 'Your tailored trip plan has been generated.' });
      }
    } catch (err) {
      setApiError(err.message);
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  // State Updaters for Wizard Data
  const togglePlace = (place) => {
    const isUnsplashFallback = (url) => !url || url.includes('1596178065887');
    const cachedImg = getSelectedImage('place', place.id);
    const existingReal = !isUnsplashFallback(place.image) ? place.image : (!isUnsplashFallback(cachedImg) ? cachedImg : null);

    const placeImg = existingReal || place.image || cachedImg || 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?auto=format&fit=crop&w=600&q=80';
    if (existingReal) {
      saveSelectedImage('place', place.id, existingReal, { name: place.name, city: place.city });
    }
    const placeWithImg = { ...place, image: placeImg };

    // Asynchronously fetch authentic Wikipedia image if missing or fallback
    if (!existingReal) {
      fetchWikipediaImage(place.name, place.city).then(wikiUrl => {
        if (wikiUrl) {
          saveSelectedImage('place', place.id, wikiUrl, { name: place.name, city: place.city });
          setWizardData(prev => ({
            ...prev,
            selectedPlaces: prev.selectedPlaces.map(p => p.id === place.id ? { ...p, image: wikiUrl } : p)
          }));
        }
      }).catch(e => console.warn('Could not fetch wiki image for place:', place.name, e));
    }

    setWizardData(prev => {
      const exists = prev.selectedPlaces.some(p => p.id === place.id);
      let updatedPlaces;
      if (exists) {
        updatedPlaces = prev.selectedPlaces.filter(p => p.id !== place.id);
      } else {
        updatedPlaces = [...prev.selectedPlaces, placeWithImg];
      }
      return { ...prev, selectedPlaces: updatedPlaces };
    });
  };

  const updateSchedule = (placeId, day, timeSlot) => {
    setWizardData(prev => ({
      ...prev,
      scheduleData: {
        ...prev.scheduleData,
        [placeId]: { day, timeSlot }
      }
    }));
  };

  const toggleHotel = (hotel) => {
    const cachedImg = getSelectedImage('hotel', hotel.id);
    const hotelImg = hotel.image || (hotel.images && hotel.images[0]) || cachedImg || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80';
    saveSelectedImage('hotel', hotel.id, hotelImg, { name: hotel.property_name || hotel.name });
    const hotelWithImg = { ...hotel, image: hotelImg };

    setWizardData(prev => {
      const exists = prev.selectedHotels.some(h => h.id === hotel.id);
      let updated;
      if (exists) {
        updated = prev.selectedHotels.filter(h => h.id !== hotel.id);
      } else {
        const nextOrder = prev.selectedHotels.length + 1;
        updated = [...prev.selectedHotels, { ...hotelWithImg, stayOrder: nextOrder, nights: 1, rooms: 1 }];
      }
      return { ...prev, selectedHotels: updated };
    });
  };

  const updateHotelConfig = (hotelId, stayOrder, nights, rooms = 1) => {
    setWizardData(prev => ({
      ...prev,
      selectedHotels: prev.selectedHotels.map(h => h.id === hotelId ? { ...h, stayOrder, nights, rooms } : h)
    }));
  };

  const toggleRide = (ride) => {
    setWizardData(prev => {
      const exists = prev.selectedRides.some(r => r.ride_id === ride.ride_id);
      let updated;
      if (exists) {
        updated = prev.selectedRides.filter(r => r.ride_id !== ride.ride_id);
      } else {
        updated = [...prev.selectedRides, ride];
      }
      return { ...prev, selectedRides: updated };
    });
  };

  // Multi-reservation Cafe Handlers
  const addCafeReservation = (cafe, day = 'Day 1', timeSlot = 'Lunch') => {
    const cafeImg = cafe.image || getSelectedImage('dining', cafe.id) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80';
    saveSelectedImage('dining', cafe.id, cafeImg, { name: cafe.name });
    const cafeWithImg = { ...cafe, image: cafeImg };

    setWizardData(prev => {
      const bookingId = `c_${cafe.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      const newEntry = { ...cafeWithImg, bookingId, seats: params.travellers || 2, day, timeSlot };
      return { ...prev, selectedCafes: [...prev.selectedCafes, newEntry] };
    });
  };

  const removeCafeReservation = (bookingId) => {
    setWizardData(prev => ({
      ...prev,
      selectedCafes: prev.selectedCafes.filter(c => c.bookingId !== bookingId && c.id !== bookingId)
    }));
  };

  const updateCafeConfig = (bookingId, seats, day, timeSlot) => {
    setWizardData(prev => ({
      ...prev,
      selectedCafes: prev.selectedCafes.map(c => (c.bookingId === bookingId || c.id === bookingId) ? { ...c, seats, day, timeSlot } : c)
    }));
  };

  // Restaurant Toggle Handler (Choose / Remove)
  const toggleRestaurant = (rest) => {
    const isGenericFallback = (url) => !url || url.includes('1517248135467');
    const cachedImg = getSelectedImage('dining', rest.id) || getSelectedImage('restaurant', rest.id);
    const existingReal = !isGenericFallback(rest.image) ? rest.image : (!isGenericFallback(cachedImg) ? cachedImg : null);
    const restImg = existingReal || rest.image || cachedImg || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80';
    if (existingReal) {
      saveSelectedImage('dining', rest.id, existingReal, { name: rest.name });
    }
    const restWithImg = { ...rest, image: restImg, seats: params.travellers || 2, price: rest.price || 400 };

    setWizardData(prev => {
      const exists = prev.selectedRestaurants.some(r => r.id === rest.id || (r.bookingId && r.bookingId.startsWith(`r_${rest.id}_`)));
      let updated;
      if (exists) {
        updated = prev.selectedRestaurants.filter(r => r.id !== rest.id && (!r.bookingId || !r.bookingId.startsWith(`r_${rest.id}_`)));
      } else {
        updated = [...prev.selectedRestaurants, restWithImg];
      }
      return { ...prev, selectedRestaurants: updated };
    });
  };

  // Multi-reservation Restaurant Handlers
  const addRestaurantReservation = (rest, day = 'Day 1', timeSlot = 'Dinner') => {
    const restImg = rest.image || getSelectedImage('dining', rest.id) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80';
    saveSelectedImage('dining', rest.id, restImg, { name: rest.name });
    const restWithImg = { ...rest, image: restImg };

    setWizardData(prev => {
      const bookingId = `r_${rest.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      const newEntry = { ...restWithImg, bookingId, seats: params.travellers || 2, day, timeSlot };
      return { ...prev, selectedRestaurants: [...prev.selectedRestaurants, newEntry] };
    });
  };


  const removeRestaurantReservation = (bookingId) => {
    setWizardData(prev => ({
      ...prev,
      selectedRestaurants: prev.selectedRestaurants.filter(r => r.bookingId !== bookingId && r.id !== bookingId)
    }));
  };

  const updateRestaurantConfig = (bookingId, seats, day, timeSlot) => {
    setWizardData(prev => ({
      ...prev,
      selectedRestaurants: prev.selectedRestaurants.map(r => (r.bookingId === bookingId || r.id === bookingId) ? { ...r, seats, day, timeSlot } : r)
    }));
  };

  const selectOutboundTransport = (item) => {
    setWizardData(prev => ({ ...prev, outboundTransport: item }));
  };

  const selectReturnTransport = (item) => {
    setWizardData(prev => ({ ...prev, returnTransport: item }));
  };

  return (
    <div className="pt-16 min-h-screen bg-gray-50 pb-20">
      
      {/* Sticky Customization Header (Visible inside Wizard mode) */}
      {pageState === 'wizard' && (
        <CustomizationHeader
          currentStep={wizardStep}
          setStep={(s) => setWizardStep(s)}
          wizardData={wizardData}
          calculateTotalCost={calculateTotalCost}
        />
      )}

      <div className="max-w-[1550px] mx-auto px-4 sm:px-6 lg:px-10 mt-6">

        {/* Global Styles for Hero Strip & Magic Icon (Image 3) */}
        <style>{`
          .hero-strip {
            height: 190px;
            background:
              linear-gradient(rgba(15, 23, 42, 0.22), rgba(15, 23, 42, 0.35)),
              url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80');
            background-size: cover;
            background-position: center;
            position: relative;
          }

          .planner-header {
            text-align: center;
            margin-top: -54px;
            margin-bottom: 34px;
          }

          .magic-icon {
            width: 82px;
            height: 82px;
            margin: 0 auto 18px;
            background: #111827;
            color: #D4B15A;
            border-radius: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 34px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.25);
            border: 6px solid #ffffff;
            transition: transform 0.3s ease;
            cursor: pointer;
          }
          .magic-icon:hover {
            transform: rotate(6deg) scale(1.05);
          }
        `}</style>

        {/* PAGE 1: INPUT FORM */}
        {pageState === 'input' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-xl max-w-4xl mx-auto mb-10 border border-gray-100 overflow-hidden"
          >
            {/* Hero Strip (Image 3) */}
            <div className="hero-strip rounded-t-3xl">
              <div className="absolute top-4 right-5 bg-black/35 backdrop-blur-md text-white text-xs font-semibold px-4 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5 shadow-sm">
                <span>✨</span> AI Powered Itinerary Builder
              </div>
            </div>

            <div className="p-8 pt-0">
              <div className="planner-header">
                <div className="magic-icon">✨</div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display">AI Trip Planner</h1>
                <p className="text-gray-500 text-sm mt-2 font-medium">Plan your custom itinerary in 60 seconds.</p>
              </div>

              <form onSubmit={handleInputSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">From Location (Origin City)</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMapLocationDot} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Delhi, Mumbai, Bangalore, Jaipur"
                    value={params.fromCity}
                    onChange={e => setParams({...params, fromCity: e.target.value})}
                    className="w-full pl-12 pr-10 py-3.5 rounded-xl border border-gray-200 focus:border-[#121619] outline-none text-sm font-medium"
                  />
                  {searchingFrom && (
                    <FontAwesomeIcon icon={faSpinner} spin className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4B15A]" />
                  )}
                </div>
                {fromSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-56 overflow-y-auto">
                    {fromSuggestions.map((item, i) => (
                      <button
                        type="button"
                        key={item.placeId || i}
                        onClick={() => {
                          isSelectingFromRef.current = true;
                          setParams({...params, fromCity: item.displayName || item.text});
                          setFromSuggestions([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-amber-50 border-b border-gray-50 last:border-none flex items-center justify-between transition-colors text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faLocationDot} className="text-[#D4B15A] shrink-0" />
                          <span className="font-semibold text-gray-800 truncate">{item.text || item.displayName}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Destination City / Cities</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faMapLocationDot} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4B15A]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mumbai, Jaipur, Manali, Goa"
                    value={params.locations}
                    onChange={e => setParams({...params, locations: e.target.value})}
                    className="w-full pl-12 pr-10 py-3.5 rounded-xl border border-gray-200 focus:border-[#121619] focus:ring-1 focus:ring-[#121619] outline-none transition-all text-sm font-medium"
                  />
                  {searchingDest && (
                    <FontAwesomeIcon icon={faSpinner} spin className="absolute right-4 top-1/2 -translate-y-1/2 text-[#D4B15A]" />
                  )}
                </div>
                {destSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden max-h-56 overflow-y-auto">
                    {destSuggestions.map((item, i) => (
                      <button
                        type="button"
                        key={item.placeId || i}
                        onClick={() => {
                          isSelectingDestRef.current = true;
                          setParams({...params, locations: item.displayName || item.text});
                          setDestSuggestions([]);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-amber-50 border-b border-gray-50 last:border-none flex items-center justify-between transition-colors text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon icon={faLocationDot} className="text-[#D4B15A] shrink-0" />
                          <span className="font-semibold text-gray-800 truncate">{item.text || item.displayName}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">From Date</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={params.fromDate}
                    onChange={e => {
                      const newFromDate = e.target.value;
                      const newParams = { ...params, fromDate: newFromDate };
                      if (params.toDate && new Date(newFromDate) > new Date(params.toDate)) {
                        newParams.toDate = newFromDate;
                      }
                      setParams(newParams);
                    }}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] outline-none text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">To Date</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="date"
                    required
                    min={params.fromDate || new Date().toISOString().split('T')[0]}
                    value={params.toDate}
                    onChange={e => setParams({...params, toDate: e.target.value})}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] outline-none text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Travel Mode</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faCarSide} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <select 
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] outline-none text-sm font-medium appearance-none" 
                    value={params.mode} 
                    onChange={e => setParams({...params, mode: e.target.value})}
                  >
                    <option value="Bus / Coach">Bus / Coach</option>
                    <option value="Flight">Flight</option>
                    <option value="Train">Train</option>
                    <option value="Personal/Rental Car">Personal/Rental Car</option>
                    <option value="Bike / Personal Vehicle">Bike / Personal Vehicle 🏍️</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Trip Category / Vibe</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faUsers} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#D4B15A]" />
                  <select 
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] outline-none text-sm font-medium appearance-none" 
                    value={params.tripType} 
                    onChange={e => setParams({...params, tripType: e.target.value})}
                  >
                    <option value="Family Trip">👨‍👩‍👧‍👦 Family Trip</option>
                    <option value="Friends Trip">🧑‍🤝‍🧑 Friends Trip</option>
                    <option value="Couples / Romantic Trip">❤️ Couples / Romantic Trip</option>
                    <option value="Solo Trip">🎒 Solo Trip</option>
                    <option value="Corporate / Business Trip">💼 Corporate / Business Trip</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Travellers</label>
                <div className="relative">
                  <FontAwesomeIcon icon={faUsers} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={params.travellers}
                    onChange={e => setParams({...params, travellers: parseInt(e.target.value) || 1})}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[#121619] outline-none text-sm font-medium"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Maximum Total Budget (INR)</label>
                <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <FontAwesomeIcon icon={faWallet} className="text-[#D4B15A]" />
                  <input
                    type="range"
                    min="5000"
                    max="500000"
                    step="5000"
                    value={params.budgetNumeric || 50000}
                    onChange={e => setParams({...params, budgetNumeric: parseInt(e.target.value)})}
                    className="flex-1 accent-[#D4B15A] cursor-pointer"
                  />
                  <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 font-bold text-[#121619] min-w-[100px] text-center shadow-sm">
                    ₹{(params.budgetNumeric || 50000).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 mt-4">
                <button 
                  type="submit" 
                  className="w-full bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] py-4 rounded-xl font-bold text-lg transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Proceed to Planning Options</span>
                  <FontAwesomeIcon icon={faArrowRight} />
                </button>
              </div>

            </form>
            </div>
          </motion.div>
        )}

        {/* PAGE 2: MODE CHOICE (IMAGE 2 & 3: FULL PAGE BACKGROUND WITH GATEWAY + MARINE DRIVE + ORANGE DASHED LINE DECORATION + 3 CARDS SIDE BY SIDE) */}
        {pageState === 'modeChoice' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative py-6 min-h-[720px]"
          >
            {/* Page Background Layer: Gateway of India (Left) + Marine Drive (Right) */}
            <div 
              className="absolute inset-y-0 left-0 w-[42%] pointer-events-none opacity-[0.22] bg-no-repeat bg-left-center bg-contain mix-blend-multiply z-0"
              style={{ backgroundImage: `url(${gatewayBg})` }}
            />
            <div 
              className="absolute inset-y-0 right-0 w-[48%] pointer-events-none opacity-[0.25] bg-no-repeat bg-right-center bg-cover mix-blend-multiply z-0"
              style={{ backgroundImage: `url(${marineDriveBg})` }}
            />

            {/* Orange Curved Line Decoration with Birds (Image 2 & 3) */}
            <div className="absolute top-12 left-[15%] right-[15%] h-24 pointer-events-none z-0 overflow-visible hidden md:block">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 600 80" fill="none">
                <path d="M 0,65 Q 300,5 600,65" stroke="#f97316" strokeWidth="1.5" strokeDasharray="6,6" opacity="0.65" />
                {/* Decorative birds along the flight path */}
                <path d="M 170,30 Q 175,25 180,30 Q 185,25 190,30" stroke="#9ca3af" strokeWidth="1.2" fill="none" />
                <path d="M 420,30 Q 425,25 430,30 Q 435,25 440,30" stroke="#9ca3af" strokeWidth="1.2" fill="none" />
              </svg>
            </div>

            {/* Typography Watermarks in Page Background (Image 2 & 3) */}
            <div className="absolute top-2 left-2 pointer-events-none z-0">
              <span className="font-serif italic text-amber-900/75 text-base font-bold leading-tight block">
                Better Trips<br />Happier You
              </span>
            </div>

            <div className="absolute top-2 right-2 pointer-events-none text-right z-0">
              <div className="text-[10px] uppercase tracking-[0.22em] font-extrabold text-gray-500/80 leading-tight">
                Explore<br />Plan<br />Travel<br />Repeat
              </div>
            </div>

            <div className="absolute bottom-2 left-2 pointer-events-none z-0">
              <span className="text-gray-400/35 text-xs font-semibold tracking-wider block">From</span>
              <span className="text-gray-400/25 text-3xl sm:text-4xl font-black tracking-widest uppercase block -mt-1 select-none">
                GATEWAY
              </span>
              <span className="text-gray-400/60 text-xs font-medium block">Plans to Memories</span>
              <span className="text-gray-400/30 text-[10px] tracking-widest font-bold uppercase block mt-1">
                MUMBAI, INDIA
              </span>
            </div>

            <div className="absolute bottom-2 right-2 pointer-events-none text-right z-0">
              <span className="text-gray-400/25 text-xs tracking-widest uppercase font-bold block select-none">
                THE QUEEN'S NECKLACE
              </span>
              <span className="text-amber-800/70 font-serif italic text-base font-bold leading-tight block mt-1">
                Same World<br />New Stories
              </span>
            </div>

            {/* Top Bar: Back Button */}
            <div className="relative z-10 flex items-center justify-between mb-4">
              <button 
                onClick={() => setPageState('input')}
                className="bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl border border-gray-200/90 shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>← Back to Trip Details</span>
              </button>
            </div>

            {/* Center Heading */}
            <div className="relative z-10 text-center mb-10 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-[#D4B15A]/30 text-[#b58b29] text-[10px] font-extrabold uppercase tracking-widest px-4 py-1.5 rounded-full mb-3 shadow-2xs">
                <span>✨ CHOOSE PLANNING EXPERIENCE</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 font-display leading-tight">
                How would you like to build your trip to {params.locations}?
              </h2>
              <p className="text-gray-500 text-sm mt-2.5 leading-relaxed">
                Select automatic generation or customize tourist spots, hotels, rides, and dining step-by-step.
              </p>
            </div>

            {validationError && (
              <div className="relative z-10 bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 max-w-2xl mx-auto shadow-sm">
                <div className="text-left">
                  <h4 className="text-red-800 font-bold text-lg mb-1">⚠️ Cannot Generate</h4>
                  <p className="text-red-700 text-sm font-medium">{validationError}</p>
                </div>
                <button 
                  onClick={() => setPageState('input')}
                  className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm cursor-pointer"
                >
                  Edit Dates
                </button>
              </div>
            )}

            {/* 3 Columns Layout: Card 1 + Card 2 + Card 3 (Image 2 & 3) */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 xl:gap-8 items-stretch max-w-[1450px] mx-auto">
              
              {/* Card 1: AI Auto Plan */}
              <div 
                onClick={handleAutoPlan}
                className="bg-white rounded-3xl p-7 sm:p-8 border border-gray-100 shadow-xl hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-200/70 flex items-center justify-center text-[#D4B15A] text-2xl mb-5 group-hover:scale-110 transition-transform">
                    <FontAwesomeIcon icon={faWandMagicSparkles} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 group-hover:text-[#D4B15A] transition-colors mb-2">
                    Let AI Auto-Plan for You ✨
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-6">
                    Our AI instantly generates a complete day-by-day itinerary with sightseeing, accommodation, and travel tips based on your budget tier.
                  </p>

                  <div className="space-y-2.5 text-xs text-gray-700 font-medium border-t border-gray-100 pt-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span>
                      <span>Complete day-by-day itinerary</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span>
                      <span>Smart hotel recommendations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span>
                      <span>Top attractions & travel tips</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span>
                      <span>Optimized for your budget</span>
                    </div>
                  </div>
                </div>

                <button 
                  disabled={loading}
                  className="w-full bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold py-3.5 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? 'Generating...' : 'Generate Auto-Itinerary ✨ →'}
                </button>
              </div>

              {/* Card 2: Customize Your Trip */}
              <div 
                onClick={async () => {
                  const check = await checkTripDuration(params);
                  if (!check.ok) {
                    const msg = `Travel time too long! You need at least ${check.minDays} days for this distance (${check.travelDays} days each way). Please provide more days or switch travel mode.`;
                    addToast({ type: 'error', message: msg, title: 'Trip Too Short for Road Travel' });
                    setValidationError(msg);
                    setDurationModalData(check);
                    return;
                  }
                  setValidationError(null);
                  setPageState('wizard');
                  setWizardStep(1);
                }}
                className="bg-white rounded-3xl p-7 sm:p-8 border border-gray-100 shadow-xl hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-2xl mb-5 group-hover:scale-110 transition-transform">
                    <FontAwesomeIcon icon={faSliders} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2">
                    Customize Your Trip 🎨
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-6">
                    Handpick popular tourist hubs, schedule visit times, pick your hotel, book private ground rides, and reserve dining table seats step-by-step.
                  </p>

                  <div className="space-y-2.5 text-xs text-gray-700 font-medium border-t border-gray-100 pt-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-600 font-bold">✓</span>
                      <span>Choose tourist spots & activities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-600 font-bold">✓</span>
                      <span>Plan visit times</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-600 font-bold">✓</span>
                      <span>Pick and book hotels</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-600 font-bold">✓</span>
                      <span>Book rides</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-indigo-600 font-bold">✓</span>
                      <span>Reserve dining spots</span>
                    </div>
                  </div>
                </div>

                <button className="w-full bg-[#6366f1] hover:bg-[#4f46e5] text-white font-bold py-3.5 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer">
                  <span>Start Step-by-Step Customization 🎨 →</span>
                </button>
              </div>

              {/* Card 3: Live Route Map (Image 2 & 3) */}
              <div className="h-full min-h-[480px]">
                <LiveRouteCard
                  fromCity={params.fromCity}
                  destinations={params.locations}
                  fromDate={params.fromDate}
                  toDate={params.toDate}
                  onCaptureSnippet={(data) => setWizardData(prev => ({ ...prev, liveMapSnippet: data }))}
                />
              </div>

            </div>
          </motion.div>
        )}

        {/* PAGES 3: CUSTOMIZATION WIZARD STEPS — two-column layout with sticky map card */}
        {pageState === 'wizard' && (
          <div className="flex flex-col lg:flex-row gap-8 lg:gap-10 xl:gap-12 items-start">
            {/* Left: main wizard step content */}
            <div className="flex-1 min-w-0 py-6">
              {wizardStep === 1 && (
                    <Step1Places
                      destination={params.locations}
                      selectedPlaces={wizardData.selectedPlaces}
                      onTogglePlace={togglePlace}
                      tripType={params.tripType}
                      onNext={() => setWizardStep(2)}
                    />
                  )}
                  {wizardStep === 2 && (
                    <StepTransport
                      fromCity={params.fromCity}
                      destination={params.locations}
                      fromDate={params.fromDate}
                      toDate={params.toDate}
                      outboundTransport={wizardData.outboundTransport}
                      returnTransport={wizardData.returnTransport}
                      onSelectOutbound={selectOutboundTransport}
                      onSelectReturn={selectReturnTransport}
                      travellers={params.travellers}
                      onNext={() => setWizardStep(3)}
                      onBack={() => setWizardStep(1)}
                    />
                  )}
                  {wizardStep === 3 && (
                    <Step2SchedulePlaces
                      selectedPlaces={wizardData.selectedPlaces}
                      scheduleData={wizardData.scheduleData}
                      onUpdateSchedule={updateSchedule}
                      totalDays={calculateTotalDays()}
                      outboundTransport={wizardData.outboundTransport}
                      returnTransport={wizardData.returnTransport}
                      onNext={() => setWizardStep(4)}
                      onBack={() => setWizardStep(2)}
                    />
                  )}
                  {wizardStep === 4 && (
                    <Step3Hotels
                      destination={params.locations}
                      selectedHotels={wizardData.selectedHotels}
                      onToggleHotel={toggleHotel}
                      onUpdateHotelConfig={updateHotelConfig}
                      fromDate={params.fromDate}
                      toDate={params.toDate}
                      travellers={params.travellers}
                      totalDays={calculateTotalDays()}
                      onNext={() => setWizardStep(5)}
                      onBack={() => setWizardStep(3)}
                    />
                  )}
                  {wizardStep === 5 && (
                    <Step5Dining
                      destination={params.locations}
                      selectedPlaces={wizardData.selectedPlaces}
                      selectedCafes={wizardData.selectedCafes}
                      onAddCafeReservation={addCafeReservation}
                      onRemoveCafeReservation={removeCafeReservation}
                      onUpdateCafeConfig={updateCafeConfig}
                      selectedRestaurants={wizardData.selectedRestaurants}
                      onToggleRestaurant={toggleRestaurant}
                      onAddRestaurantReservation={addRestaurantReservation}
                      onRemoveRestaurantReservation={removeRestaurantReservation}
                      onUpdateRestaurantConfig={updateRestaurantConfig}
                      totalDays={calculateTotalDays()}
                      travellers={params.travellers}
                      onNext={() => setWizardStep(6)}
                      onBack={() => setWizardStep(4)}
                    />
                  )}
                  {wizardStep === 6 && (
                    <Step6Review
                      wizardData={wizardData}
                      onCaptureSnippet={(data) => setWizardData(prev => ({ ...prev, mapSnippet: data }))}
                      scheduleData={wizardData.scheduleData}
                      calculateTotalCost={calculateTotalCost}
                      onJumpToStep={(stepNum) => setWizardStep(stepNum)}
                      onConfirmGenerate={handleCustomPlanGenerate}
                      loading={loading}
                      travellers={params.travellers}
                      validationError={validationError}
                      fromCity={params.fromCity}
                      toCity={params.locations}
                      onEditDates={() => { setValidationError(null); setPageState('input'); }}
                    />
                  )}
                </div>

                {/* Right: Sticky Live Route Card with Overlay Target */}
            <div className="hidden lg:block w-[370px] xl:w-[420px] 2xl:w-[450px] shrink-0 sticky top-24" style={{ height: 'calc(100vh - 7rem)' }}>
              <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-xl border border-gray-100">
                <LiveRouteCard
                  fromCity={params.fromCity}
                  destinations={params.locations}
                  fromDate={params.fromDate}
                  toDate={params.toDate}
                  onCaptureSnippet={(data) => setWizardData(prev => ({ ...prev, liveMapSnippet: data }))}
                />
                <div id="live-route-overlay-target" className="absolute inset-0 pointer-events-none z-[1100] overflow-hidden rounded-3xl" />
              </div>
            </div>

          </div>
        )}

        {/* RESULT PAGE: GENERATED ITINERARY */}
        {pageState === 'result' && plan && (
          <AnimatePresence mode="wait">
            <motion.div
              key="planResult"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex justify-between items-center mb-6 max-w-5xl mx-auto no-print">
                <h3 className="text-2xl font-bold text-gray-900 font-display">Your Customized AI Itinerary</h3>
                <button 
                  onClick={resetTripForm} 
                  className="text-xs font-bold bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                >
                  <FontAwesomeIcon icon={faRotateLeft} />
                  Start New Customization
                </button>
              </div>

              <TripOutput 
                plan={plan} 
                setPlan={setPlan} 
                params={params} 
                selectedHotel={wizardData.selectedHotel} 
              />
            </motion.div>
          </AnimatePresence>
        )}

        {pageState !== 'wizard' && !plan && (
          <DraftHistory 
            onSelectDraft={(draft) => { 
              setParams(draft.params); 
              setPlan(draft.plan); 
              setPageState('result');
            }} 
          />
        )}

        {/* Insufficient Travel Days Pop-Up Card Modal */}
        <AnimatePresence>
          {durationModalData && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-red-100 relative overflow-hidden"
              >
                {/* Top decorative accent bar */}
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500" />
                
                {/* Close button */}
                <button 
                  onClick={() => setDurationModalData(null)}
                  className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
                  title="Dismiss"
                >
                  ✕
                </button>

                {/* Header */}
                <div className="flex items-center gap-3.5 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl shadow-xs shrink-0">
                    ⚠️
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-md">
                      Insufficient Trip Days
                    </span>
                    <h3 className="text-xl font-black text-gray-900 mt-1 font-display">
                      Trip Too Short for Road Travel
                    </h3>
                  </div>
                </div>

                {/* Route & Distance Info Grid */}
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-700">
                    <span className="font-semibold">Driving Route:</span>
                    <span className="font-black text-gray-900">{durationModalData.fromCity} ➔ {durationModalData.toCity}</span>
                  </div>
                  {durationModalData.distanceKm && (
                    <div className="flex items-center justify-between text-gray-700">
                      <span className="font-semibold">Distance & Driving Time:</span>
                      <span className="font-extrabold text-gray-900">{durationModalData.distanceKm} km • ~{durationModalData.drivingHours}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-200">
                    <span className="text-gray-600">Currently Scheduled:</span>
                    <span className="font-black text-red-600 bg-red-50 px-2.5 py-0.5 rounded-md">{durationModalData.totalDays} Days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-900 font-bold">Minimum Days Required:</span>
                    <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">At least {durationModalData.minDays} Days</span>
                  </div>
                </div>

                {/* Explanatory Message */}
                <p className="text-xs text-gray-600 leading-relaxed mb-6">
                  Based on highway safety guidelines (maximum 8–10 hours driving per day), traveling between {durationModalData.fromCity} and {durationModalData.toCity} requires 
                  <strong className="text-gray-900"> {durationModalData.travelDays} days each way </strong> 
                  ({durationModalData.travelDays * 2} days total on the road), plus time to explore the destination. 
                  Your current schedule of {durationModalData.totalDays} days is not enough. Please change your dates to at least <strong className="text-red-700">{durationModalData.minDays} days</strong> on the first page, or switch to Flight/Train.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => {
                      setDurationModalData(null);
                      setValidationError(null);
                      setPageState('input');
                    }}
                    className="flex-1 bg-[#f97316] hover:bg-[#ea580c] text-white font-extrabold py-3.5 px-5 rounded-2xl text-xs transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>📅 Change Trip Dates (Go to Page 1)</span>
                    <span>→</span>
                  </button>
                  <button
                    onClick={() => {
                      setDurationModalData(null);
                      setValidationError(null);
                      setPageState('input');
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 px-4 rounded-2xl text-xs transition-colors cursor-pointer"
                  >
                    Switch Travel Mode
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

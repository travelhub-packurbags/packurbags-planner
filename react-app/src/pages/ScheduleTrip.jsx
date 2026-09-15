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
  const calculateTotalDays = () => {
    if (!params.fromDate || !params.toDate) return 3;
    const f = new Date(params.fromDate);
    const t = new Date(params.toDate);
    const diff = Math.ceil(Math.abs(t - f) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 3;
  };

  // Cumulative Total Cost Tracker
  const calculateTotalCost = () => {
    let total = 0;

    // Outbound & Return Tickets (price * travellers)
    if (wizardData.outboundTransport) {
      total += (wizardData.outboundTransport.price || 0) * params.travellers;
    }
    if (wizardData.returnTransport) {
      total += (wizardData.returnTransport.price || 0) * params.travellers;
    }

    // Entrance fees (fee * travellers)
    wizardData.selectedPlaces.forEach(p => {
      total += (p.entrance_fee_inr || 0) * params.travellers;
    });

    // Multi-Hotels Cost (price * nights * rooms)
    wizardData.selectedHotels.forEach(h => {
      const hPrice = h.price_per_night_inr || h.price_inr || 0;
      total += hPrice * (h.nights || 1) * (h.rooms || 1);
    });

    // Multi-Rides Cost
    wizardData.selectedRides.forEach(r => {
      total += r.price || 0;
    });

    // Cafes (rate_for_two * ceil(seats / 2))
    wizardData.selectedCafes.forEach(c => {
      total += (c.rate_for_two || 500) * Math.ceil((c.seats || 2) / 2);
    });

    // Restaurants (price * ceil(seats / 2))
    wizardData.selectedRestaurants.forEach(r => {
      total += (r.price || 400) * Math.ceil((r.seats || 2) / 2);
    });

    return total;
  };

  useEffect(() => {
    if (pageState === 'wizard' && params.budgetNumeric) {
      const cost = calculateTotalCost();
      if (cost > params.budgetNumeric && !hasAlertedBudget) {
        addToast({ 
          type: 'error', 
          title: 'Budget Exceeded', 
          message: `Warning: Your current itinerary cost (₹${cost.toLocaleString()}) exceeds your selected budget range (₹${params.budgetNumeric.toLocaleString()}).` 
        });
        setHasAlertedBudget(true);
      } else if (cost <= params.budgetNumeric && hasAlertedBudget) {
        setHasAlertedBudget(false);
      }
    }
  }, [wizardData, params.budgetNumeric, pageState, hasAlertedBudget, addToast]);

  // Form Submit on Page 1
  const handleInputSubmit = (e) => {
    e.preventDefault();
    if (!params.locations.trim()) {
      addToast({ type: 'error', message: 'Please enter a destination city.' });
      return;
    }
    setPageState('modeChoice');
  };

  // Auto-Plan Generator Trigger
  const handleAutoPlan = async () => {
    setLoading(true);
    setPlan(null);
    setApiError(null);
    setValidationError(null);
    try {
      const locList = params.locations.split(',').map(s => s.trim()).filter(Boolean);
      
      // Calculate Route Info before hitting Gemini
      let routeInfo = null;
      try {
        const fromCoords = await geocodeCity(params.fromCity || 'Delhi');
        const destCoords = await Promise.all(locList.map(l => geocodeCity(l)));
        const allCoords = [fromCoords, ...destCoords].filter(Boolean);
        if (allCoords.length >= 2) routeInfo = await getRoute(allCoords);
      } catch (err) { console.warn('Failed to calculate pre-route info:', err); }

      // Validate Trip Duration for vehicle modes
      const isVehicle = params.mode && (params.mode.toLowerCase().includes('self drive') || params.mode.toLowerCase().includes('personal vehicle') || params.mode.toLowerCase().includes('bike'));
      if (isVehicle && routeInfo && routeInfo.durationHours) {
        const travelDays = Math.ceil(routeInfo.durationHours / 10);
        const minDays = (travelDays * 2) + 1;
        const totalDays = calculateTotalDays();
        if (totalDays < minDays) {
          const msg = `Travel time too long! You need at least ${minDays} days for this distance (${travelDays} days each way). Please provide more days.`;
          addToast({ type: 'error', message: msg, title: 'Trip Too Short' });
          setValidationError(msg);
          setLoading(false);
          return;
        }
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
    setValidationError(null);
    try {
      const locList = params.locations.split(',').map(s => s.trim()).filter(Boolean);

      // Calculate Route Info before hitting Gemini
      let routeInfo = null;
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


      // Validate Trip Duration for vehicle modes
      const isVehicle = params.mode && (params.mode.toLowerCase().includes('self drive') || params.mode.toLowerCase().includes('personal vehicle') || params.mode.toLowerCase().includes('bike'));
      if (isVehicle && routeInfo && routeInfo.durationHours) {
        const travelDays = Math.ceil(routeInfo.durationHours / 10);
        const minDays = (travelDays * 2) + 1;
        const totalDays = calculateTotalDays();
        if (totalDays < minDays) {
          const msg = `Travel time too long! You need at least ${minDays} days for this distance (${travelDays} days each way). Please provide more days.`;
          addToast({ type: 'error', message: msg, title: 'Trip Too Short' });
          setValidationError(msg);
          setLoading(false);
          return;
        }
      }

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
        customPlaces: wizardData.selectedPlaces,
        scheduleData: wizardData.scheduleData,
        selectedRides: wizardData.selectedRides,
        selectedCafes: wizardData.selectedCafes,
        selectedRestaurants: wizardData.selectedRestaurants,
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
    setWizardData(prev => {
      const exists = prev.selectedPlaces.some(p => p.id === place.id);
      let updatedPlaces;
      if (exists) {
        updatedPlaces = prev.selectedPlaces.filter(p => p.id !== place.id);
      } else {
        updatedPlaces = [...prev.selectedPlaces, place];
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
    setWizardData(prev => {
      const exists = prev.selectedHotels.some(h => h.id === hotel.id);
      let updated;
      if (exists) {
        updated = prev.selectedHotels.filter(h => h.id !== hotel.id);
      } else {
        const nextOrder = prev.selectedHotels.length + 1;
        updated = [...prev.selectedHotels, { ...hotel, stayOrder: nextOrder, nights: 1, rooms: 1 }];
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
    setWizardData(prev => {
      const bookingId = `c_${cafe.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      const newEntry = { ...cafe, bookingId, seats: params.travellers || 2, day, timeSlot };
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

  // Multi-reservation Restaurant Handlers
  const addRestaurantReservation = (rest, day = 'Day 1', timeSlot = 'Dinner') => {
    setWizardData(prev => {
      const bookingId = `r_${rest.id}_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      const newEntry = { ...rest, bookingId, seats: params.travellers || 2, day, timeSlot };
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

      <div className="max-w-7xl mx-auto px-4 mt-6">

        {/* PAGE 1: INPUT FORM */}
        {pageState === 'input' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 shadow-xl max-w-4xl mx-auto mb-10 border border-gray-100"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-tr from-[#121619] to-[#1e2429] rounded-2xl flex items-center justify-center mx-auto mb-4 text-[#D4B15A] text-2xl shadow-lg">
                <FontAwesomeIcon icon={faWandMagicSparkles} />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 font-display">AI Trip Planner</h2>
              <p className="text-gray-500 mt-2">Plan your custom itinerary in 60 seconds.</p>
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
          </motion.div>
        )}

        {/* PAGES 2 & 3: MODE CHOICE + WIZARD — two-column layout with sticky map card */}
        {(pageState === 'modeChoice' || pageState === 'wizard') && (
          <div className="flex gap-5 items-start">
            {/* Left: main wizard/mode content */}
            <div className="flex-1 min-w-0">

              {/* PAGE 2: MODE CHOICE (AUTO VS CUSTOMIZE) */}
              {pageState === 'modeChoice' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="max-w-3xl mx-auto py-10"
                >
                  <div className="text-center mb-10">
                    <span className="text-xs font-bold text-[#D4B15A] uppercase tracking-widest bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
                      Choose Planning Experience
                    </span>
                    <h2 className="text-3xl font-display font-bold text-gray-900 mt-3">
                      How would you like to build your trip to {params.locations}?
                    </h2>
                    <p className="text-gray-500 text-sm mt-2">
                      Select automatic generation or customize tourist spots, hotels, rides, and dining step-by-step.
                    </p>
                  </div>

                  {validationError && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 max-w-2xl mx-auto">
                      <div className="text-left">
                        <h4 className="text-red-800 font-bold text-lg mb-1">⚠️ Cannot Generate</h4>
                        <p className="text-red-700 text-sm font-medium">{validationError}</p>
                      </div>
                      <button 
                        onClick={() => setPageState('input')}
                        className="shrink-0 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-sm"
                      >
                        Edit Dates
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Option 1: AI Auto Plan */}
                    <div 
                      onClick={handleAutoPlan}
                      className="bg-white rounded-3xl p-8 border border-gray-200 hover:border-[#D4B15A] shadow-md hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-[#D4B15A] text-2xl mb-6 group-hover:scale-110 transition-transform">
                          <FontAwesomeIcon icon={faWandMagicSparkles} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 group-hover:text-[#D4B15A] transition-colors mb-2">
                          Let AI Auto-Plan for You ✨
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-6">
                          Our AI instantly generates a complete day-by-day itinerary with sightseeing, accommodation, and travel tips based on your budget tier.
                        </p>
                      </div>
                      <button 
                        disabled={loading}
                        className="w-full bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold py-3.5 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
                      >
                        {loading ? 'Generating...' : 'Generate Auto-Itinerary ✨'}
                      </button>
                    </div>

                    {/* Option 2: Customize Your Trip */}
                    <div 
                      onClick={() => { setPageState('wizard'); setWizardStep(1); }}
                      className="bg-white rounded-3xl p-8 border border-gray-200 hover:border-[#D4B15A] shadow-md hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 text-2xl mb-6 group-hover:scale-110 transition-transform">
                          <FontAwesomeIcon icon={faSliders} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors mb-2">
                          Customize Your Trip 🎨
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-6">
                          Handpick popular tourist hubs, schedule visit times, pick your hotel, book private ground rides, and reserve dining table seats step-by-step.
                        </p>
                      </div>
                      <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl text-sm transition-all shadow-md flex items-center justify-center gap-2">
                        <span>Start Step-by-Step Customization 🎨</span>
                        <FontAwesomeIcon icon={faArrowRight} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-8 text-center">
                    <button 
                      onClick={() => setPageState('input')}
                      className="text-xs font-semibold text-gray-500 hover:text-gray-900 underline cursor-pointer"
                    >
                      ← Back to Input Form
                    </button>
                  </div>
                </motion.div>
              )}

              {/* PAGE 3: CUSTOMIZATION WIZARD STEPS */}
              {pageState === 'wizard' && (
                <div className="py-6">
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
              )}

            </div>

            {/* Right: Sticky Live Route Card */}
            <div className="hidden lg:block w-[360px] xl:w-[400px] shrink-0 sticky top-24" style={{ height: 'calc(100vh - 7rem)' }}>
              <LiveRouteCard
                fromCity={params.fromCity}
                destinations={params.locations}
                fromDate={params.fromDate}
                toDate={params.toDate}
                onCaptureSnippet={(data) => setWizardData(prev => ({ ...prev, liveMapSnippet: data }))}
              />
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

      </div>
    </div>
  );
}

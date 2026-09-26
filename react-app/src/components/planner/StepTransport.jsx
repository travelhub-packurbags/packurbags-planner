import { useState, useEffect, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlane, faBus, faClock, faCheck, faArrowRight, faArrowLeft,
  faPlaneArrival, faPlaneDeparture, faLuggageCart, faSpinner,
  faCircle, faRotateRight, faWifi
} from '@fortawesome/free-solid-svg-icons';
import { getRoute } from '../../services/routing';
import { geocodeCity } from '../../services/places';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// --- Fallback mock data ---
const MOCK_FLIGHTS_OUT = [
  { id: 'out-f1', type: 'flight', operator: 'IndiGo', code: '6E-2031', depTime: '06:00 AM', arrTime: '08:15 AM', duration: '2h 15m', price: 4799, seatsLeft: 5, baggage: '15kg Check-in' },
  { id: 'out-f2', type: 'flight', operator: 'Air India', code: 'AI-630', depTime: '09:30 AM', arrTime: '11:45 AM', duration: '2h 15m', price: 5899, seatsLeft: 8, baggage: '25kg Check-in' },
  { id: 'out-f3', type: 'flight', operator: 'Akasa Air', code: 'QP-1107', depTime: '02:15 PM', arrTime: '04:30 PM', duration: '2h 15m', price: 4299, seatsLeft: 3, baggage: '15kg Check-in' },
];
const MOCK_FLIGHTS_RET = [
  { id: 'ret-f1', type: 'flight', operator: 'IndiGo', code: '6E-5412', depTime: '05:45 PM', arrTime: '08:00 PM', duration: '2h 15m', price: 4999, seatsLeft: 7, baggage: '15kg Check-in' },
  { id: 'ret-f2', type: 'flight', operator: 'Air India', code: 'AI-803', depTime: '08:15 PM', arrTime: '10:30 PM', duration: '2h 15m', price: 6199, seatsLeft: 4, baggage: '25kg Check-in' },
  { id: 'ret-f3', type: 'flight', operator: 'SpiceJet', code: 'SG-8157', depTime: '03:30 PM', arrTime: '05:45 PM', duration: '2h 15m', price: 4399, seatsLeft: 9, baggage: '15kg Check-in' },
];
const MOCK_BUSES_OUT = [
  { id: 'out-b1', type: 'bus', operator: 'Zingbus Premium Volvo', code: 'ZB-881', depTime: '08:00 PM', arrTime: '07:00 AM (+1d)', duration: '11h 00m', price: 1499, seatsLeft: 12, baggage: '20kg Luggage' },
  { id: 'out-b2', type: 'bus', operator: 'IntrCity SmartBus AC Sleeper', code: 'IC-402', depTime: '09:30 PM', arrTime: '08:30 AM (+1d)', duration: '11h 00m', price: 1799, seatsLeft: 6, baggage: '20kg Luggage' },
  { id: 'out-b3', type: 'bus', operator: 'VRL Travels Multi-Axle Volvo', code: 'VRL-910', depTime: '07:00 PM', arrTime: '06:00 AM (+1d)', duration: '11h 00m', price: 1299, seatsLeft: 15, baggage: '20kg Luggage' },
];
const MOCK_BUSES_RET = [
  { id: 'ret-b1', type: 'bus', operator: 'IntrCity SmartBus AC Sleeper', code: 'IC-505', depTime: '07:30 PM', arrTime: '06:30 AM (+1d)', duration: '11h 00m', price: 1699, seatsLeft: 10, baggage: '20kg Luggage' },
  { id: 'ret-b2', type: 'bus', operator: 'Zingbus Luxury Volvo', code: 'ZB-992', depTime: '09:00 PM', arrTime: '08:00 AM (+1d)', duration: '11h 00m', price: 1599, seatsLeft: 14, baggage: '20kg Luggage' },
  { id: 'ret-b3', type: 'bus', operator: 'SRS Travels AC Seater/Sleeper', code: 'SRS-304', depTime: '06:00 PM', arrTime: '05:00 AM (+1d)', duration: '11h 00m', price: 1399, seatsLeft: 8, baggage: '20kg Luggage' },
];

// Live signal badge component
function LiveSignalBadge({ isLive, loading }) {
  if (loading) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold">
        <FontAwesomeIcon icon={faSpinner} spin className="text-amber-500" />
        Fetching Live Data...
      </span>
    );
  }
  if (isLive) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        DSA Live Data
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 text-[10px] font-bold">
      <FontAwesomeIcon icon={faCircle} className="text-red-400 text-[8px]" />
      Fallback Mode
    </span>
  );
}

// Card component for flight/bus option
function TransportCard({ opt, isSelected, onSelect, fromCity, toCity }) {
  return (
    <div
      onClick={() => onSelect(opt)}
      className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[160px] ${
        isSelected
          ? 'border-[#D4B15A] bg-amber-500/5 ring-2 ring-[#D4B15A]/30 shadow-md'
          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
      }`}
    >
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="font-bold text-gray-900 text-sm truncate max-w-[140px]">{opt.operator}</span>
          <span className="text-[10px] text-gray-400 font-mono ml-1 shrink-0">{opt.code}</span>
        </div>
        <div className="flex items-center justify-between my-2 bg-gray-50 rounded-xl p-2.5 border border-gray-100">
          <div>
            <span className="text-sm font-extrabold text-gray-900 block">{opt.depTime}</span>
            <span className="text-[10px] text-gray-400 font-medium">{fromCity}</span>
          </div>
          <div className="text-center px-2">
            <span className="text-[10px] text-gray-500 flex items-center gap-1">
              <FontAwesomeIcon icon={faClock} className="text-[#D4B15A]" /> {opt.duration}
            </span>
            <div className="w-12 h-0.5 bg-gray-300 my-1 relative mx-auto">
              <div className="w-1.5 h-1.5 bg-[#D4B15A] rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-extrabold text-gray-900 block">{opt.arrTime}</span>
            <span className="text-[10px] text-gray-400 font-medium">{toCity}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><FontAwesomeIcon icon={faLuggageCart} /> {opt.baggage}</span>
          {opt.seatsLeft < 99 && <span className="text-emerald-600 font-semibold">{opt.seatsLeft} seats left</span>}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center">
        <div>
          <span className="text-base font-extrabold text-gray-900">₹{opt.price.toLocaleString()}</span>
          <span className="text-[10px] text-gray-400 block">per person</span>
        </div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all ${
          isSelected ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
        }`}>
          <FontAwesomeIcon icon={faCheck} />
        </div>
      </div>
    </div>
  );
}

// Section skeleton loader
function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 animate-pulse min-h-[160px]">
          <div className="h-4 bg-gray-200 rounded-lg mb-3 w-2/3" />
          <div className="h-12 bg-gray-200 rounded-xl mb-3" />
          <div className="h-3 bg-gray-200 rounded-lg w-1/2" />
        </div>
      ))}
    </div>
  );
}

export default function StepTransport({ 
  fromCity = 'Delhi', 
  destination = 'Mumbai', 
  fromDate = '', 
  toDate = '', 
  outboundTransport, 
  returnTransport, 
  onSelectOutbound, 
  onSelectReturn, 
  travellers = 2,
  onNext, 
  onBack 
}) {
  const [outboundMode, setOutboundMode] = useState(outboundTransport?.type || 'flight');
  const [returnMode, setReturnMode] = useState(returnTransport?.type || 'flight');

  const [driveMetrics, setDriveMetrics] = useState({ roadKm: 0, durationStr: 'Calculating...', depTime: '06:00 AM', arrTime: 'Calculating...' });
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(false);

  // Live DSA state — separate loading per direction
  const [dsaFlightsOut, setDsaFlightsOut]   = useState([]);
  const [dsaFlightsRet, setDsaFlightsRet]   = useState([]);
  const [dsaBusesOut, setDsaBusesOut]       = useState([]);
  const [dsaBusesRet, setDsaBusesRet]       = useState([]);

  const [loadingOut, setLoadingOut]   = useState(false);
  const [loadingRet, setLoadingRet]   = useState(false);
  const [liveOut, setLiveOut]         = useState(false); // true = DSA live
  const [liveRet, setLiveRet]         = useState(false);
  const [retryCount, setRetryCount]   = useState(0);

  const fetchDSA = useCallback(async () => {
    if (!fromCity || !destination) return;
    const flightDate  = fromDate || new Date().toISOString().split('T')[0];
    const returnDate  = toDate   || flightDate;

    setLoadingOut(true);
    setLoadingRet(true);
    setLiveOut(false);
    setLiveRet(false);

    // Fetch BOTH directions in parallel — independent settle
    const [fOut, fRet, bOut, bRet] = await Promise.allSettled([
      fetch(`${BACKEND_URL}/api/planner/dsa/flights/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromCity, to: destination, date: flightDate, adults: travellers || 1 })
      }).then(r => r.json()),
      fetch(`${BACKEND_URL}/api/planner/dsa/flights/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: destination, to: fromCity, date: returnDate, adults: travellers || 1 })
      }).then(r => r.json()),
      fetch(`${BACKEND_URL}/api/planner/dsa/buses/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: fromCity, to: destination, date: flightDate })
      }).then(r => r.json()),
      fetch(`${BACKEND_URL}/api/planner/dsa/buses/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: destination, to: fromCity, date: returnDate })
      }).then(r => r.json()),
    ]);

    // Outbound — use results from backend, badge as live only if source==='DSA'
    const outFlightData    = fOut.status === 'fulfilled' ? fOut.value : null;
    const outBusData       = bOut.status === 'fulfilled' ? bOut.value : null;
    const isLiveO          = (outFlightData?.source === 'DSA' && outFlightData?.results?.length > 0) || (outBusData?.source === 'DSA' && outBusData?.results?.length > 0);
    const outFlightResults = outFlightData?.results?.length ? outFlightData.results : [];
    const outBusResults    = outBusData?.results?.length ? outBusData.results : [];
    setDsaFlightsOut(outFlightResults);
    setDsaBusesOut(outBusResults);
    setLiveOut(isLiveO);
    setLoadingOut(false);

    // Return — same logic
    const retFlightData    = fRet.status === 'fulfilled' ? fRet.value : null;
    const retBusData       = bRet.status === 'fulfilled' ? bRet.value : null;
    const isLiveR          = (retFlightData?.source === 'DSA' && retFlightData?.results?.length > 0) || (retBusData?.source === 'DSA' && retBusData?.results?.length > 0);
    const retFlightResults = retFlightData?.results?.length ? retFlightData.results : [];
    const retBusResults    = retBusData?.results?.length ? retBusData.results : [];
    setDsaFlightsRet(retFlightResults);
    setDsaBusesRet(retBusResults);
    setLiveRet(isLiveR);
    setLoadingRet(false);

    console.log('[StepTransport] DSA fetch complete — Out:', outFlightResults.length, 'flights,', outBusResults.length, 'buses | Ret:', retFlightResults.length, 'flights,', retBusResults.length, 'buses');
  }, [fromCity, destination, fromDate, toDate, travellers, retryCount]);

  useEffect(() => { fetchDSA(); }, [fetchDSA]);

  // Drive metrics
  useEffect(() => {
    let active = true;
    async function fetchMetrics() {
      if (outboundMode !== 'bike' && returnMode !== 'bike') return;
      setIsLoadingMetrics(true);
      const c1 = await geocodeCity(fromCity) || { lat: 28.6139, lng: 77.2090 };
      const c2 = await geocodeCity(destination) || { lat: 19.0760, lng: 72.8777 };
      try {
        const routeData = await getRoute([c1, c2]);
        if (active && routeData) {
          const totalHrs = Math.floor(routeData.totalMinutes / 60);
          const days = Math.ceil(totalHrs / 24);
          setDriveMetrics({
            roadKm: routeData.distanceKm,
            durationStr: `${routeData.durationDisplay}${totalHrs > 24 ? ` (~${days} Days Road Trip)` : ''}`,
            depTime: '06:00 AM',
            arrTime: totalHrs > 24 ? `06:00 AM (+${days}d)` : '09:00 PM'
          });
        }
      } catch (err) { console.error('Drive metrics failed', err); }
      finally { if (active) setIsLoadingMetrics(false); }
    }
    fetchMetrics();
    return () => { active = false; };
  }, [fromCity, destination, outboundMode, returnMode]);

  const BIKE_OPT = (dir) => [{
    id: `${dir}-bk1`, type: 'bike',
    operator: isLoadingMetrics ? 'Calculating Route...' : `Personal Vehicle / Bike (${driveMetrics.roadKm} km)`,
    code: 'SELF-DRIVE',
    depTime: driveMetrics.depTime, arrTime: driveMetrics.arrTime,
    duration: isLoadingMetrics ? 'Loading...' : driveMetrics.durationStr,
    price: 0, seatsLeft: 99, baggage: 'Personal Luggage'
  }];

  const outboundOptions = outboundMode === 'bike' ? BIKE_OPT('out')
    : outboundMode === 'flight' ? (dsaFlightsOut.length ? dsaFlightsOut : MOCK_FLIGHTS_OUT)
    : (dsaBusesOut.length ? dsaBusesOut : MOCK_BUSES_OUT);

  const returnOptions = returnMode === 'bike' ? BIKE_OPT('ret')
    : returnMode === 'flight' ? (dsaFlightsRet.length ? dsaFlightsRet : MOCK_FLIGHTS_RET)
    : (dsaBusesRet.length ? dsaBusesRet : MOCK_BUSES_RET);

  const outboundIsLive = outboundMode === 'bike' ? true
    : outboundMode === 'flight' ? dsaFlightsOut.length > 0
    : dsaBusesOut.length > 0;

  const returnIsLive = returnMode === 'bike' ? true
    : returnMode === 'flight' ? dsaFlightsRet.length > 0
    : dsaBusesRet.length > 0;

  const ModeTab = ({ mode, current, onChange, icon, label }) => (
    <button
      onClick={() => onChange(mode)}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
        current === mode ? 'bg-[#121619] text-[#D4B15A] shadow-md' : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="w-full p-4 sm:p-6">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <span className="text-xs font-bold text-[#D4B15A] uppercase tracking-widest bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
            Step 6: Intercity Transport Booking
          </span>
          <h2 className="text-3xl font-display font-bold text-gray-900 mt-2">
            Book Outbound &amp; Return Tickets ({fromCity} ⇄ {destination})
          </h2>
          <p className="text-gray-500 text-xs mt-1">Choose your Day 1 departure and Last Day return travel independently.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRetryCount(c => c + 1)}
            title="Retry live data fetch"
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <FontAwesomeIcon icon={faRotateRight} className={loadingOut || loadingRet ? 'animate-spin' : ''} />
          </button>
          <button onClick={onNext} className="bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold px-8 py-3 rounded-xl transition-all shadow-md text-xs cursor-pointer flex items-center gap-2">
            <span>Next: Review &amp; Confirm</span>
            <FontAwesomeIcon icon={faArrowRight} />
          </button>
        </div>
      </div>

      <div className="space-y-8">

        {/* ── SECTION 1: OUTBOUND ── */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#D4B15A] tracking-widest bg-[#D4B15A]/10 px-2.5 py-0.5 rounded-md">
                1st Day Outbound Journey
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                <FontAwesomeIcon icon={faPlaneDeparture} className="text-[#D4B15A]" />
                {fromCity} → {destination} ({fromDate || 'Day 1'})
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <LiveSignalBadge isLive={outboundIsLive} loading={loadingOut} />
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                <ModeTab mode="flight" current={outboundMode} onChange={setOutboundMode} icon={<FontAwesomeIcon icon={faPlane} />} label="Flight" />
                <ModeTab mode="bus"    current={outboundMode} onChange={setOutboundMode} icon={<FontAwesomeIcon icon={faBus} />}   label="Bus" />
                <ModeTab mode="bike"   current={outboundMode} onChange={setOutboundMode} icon="🏍️"                                label="Self Drive" />
              </div>
            </div>
          </div>

          {loadingOut && outboundMode !== 'bike' ? (
            <SkeletonCards />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {outboundOptions.map(opt => (
                <TransportCard
                  key={opt.id} opt={opt}
                  isSelected={outboundTransport?.id === opt.id}
                  onSelect={onSelectOutbound}
                  fromCity={fromCity} toCity={destination}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── SECTION 2: RETURN ── */}
        <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#D4B15A] tracking-widest bg-[#D4B15A]/10 px-2.5 py-0.5 rounded-md">
                Last Day Return Journey
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                <FontAwesomeIcon icon={faPlaneArrival} className="text-[#D4B15A]" />
                {destination} → {fromCity} ({toDate || 'Last Day'})
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <LiveSignalBadge isLive={returnIsLive} loading={loadingRet} />
              <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
                <ModeTab mode="flight" current={returnMode} onChange={setReturnMode} icon={<FontAwesomeIcon icon={faPlane} />} label="Flight" />
                <ModeTab mode="bus"    current={returnMode} onChange={setReturnMode} icon={<FontAwesomeIcon icon={faBus} />}   label="Bus" />
                <ModeTab mode="bike"   current={returnMode} onChange={setReturnMode} icon="🏍️"                                label="Self Drive" />
              </div>
            </div>
          </div>

          {loadingRet && returnMode !== 'bike' ? (
            <SkeletonCards />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {returnOptions.map(opt => (
                <TransportCard
                  key={opt.id} opt={opt}
                  isSelected={returnTransport?.id === opt.id}
                  onSelect={onSelectReturn}
                  fromCity={destination} toCity={fromCity}
                />
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Nav */}
      <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
        <button onClick={onBack} className="px-6 py-3 border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-2">
          <FontAwesomeIcon icon={faArrowLeft} /> Back to Dining
        </button>
        <button onClick={onNext} className="px-8 py-3 bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer">
          <span>Review &amp; Confirm</span>
          <FontAwesomeIcon icon={faArrowRight} />
        </button>
      </div>

    </div>
  );
}

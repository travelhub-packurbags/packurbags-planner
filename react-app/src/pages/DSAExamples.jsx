import { useState, useEffect } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// ─── Confirmed working test cases ───
const FLIGHT_EXAMPLE = {
  from: 'Delhi', to: 'Mumbai',
  date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  adults: 2,
};
const BUS_EXAMPLE = {
  from: 'Bangalore', to: 'Chennai',
  date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
};
const HOTEL_EXAMPLE = {
  city: 'Delhi',
  checkIn:  new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  checkOut: new Date(Date.now() + 16 * 86400000).toISOString().split('T')[0],
  rooms: 1,
  adults: 2,
};

function StatusDot({ status }) {
  const colors = {
    idle:    'bg-gray-300',
    loading: 'bg-amber-400 animate-pulse',
    live:    'bg-emerald-500',
    empty:   'bg-yellow-400',
    error:   'bg-red-500',
  };
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 ${colors[status] || 'bg-gray-300'}`} />
  );
}

function TestPanel({ title, emoji, status, result, error, onRun, children }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="bg-[#121619] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{emoji}</span>
          <div>
            <h3 className="text-white font-bold text-base">{title}</h3>
            <div className="flex items-center mt-0.5">
              <StatusDot status={status} />
              <span className="text-[11px] text-gray-400 capitalize font-medium">{status}</span>
              {result && <span className="ml-3 text-[11px] text-emerald-400 font-bold">✓ {Array.isArray(result) ? result.length : (result.results?.length || 1)} results</span>}
            </div>
          </div>
        </div>
        <button
          onClick={onRun}
          disabled={status === 'loading'}
          className="px-5 py-2 bg-[#D4B15A] hover:bg-[#c4a14a] disabled:opacity-50 text-black font-bold rounded-xl text-xs transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
        >
          {status === 'loading' ? '⏳ Testing...' : '▶ Run Test'}
        </button>
      </div>
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 text-xs text-gray-600 font-mono">
        {children}
      </div>
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-200 text-xs text-red-700 font-mono">
          ❌ {error}
        </div>
      )}
      {result && (
        <div className="px-6 py-4 max-h-80 overflow-y-auto">
          {Array.isArray(result) ? result.slice(0, 5).map((item, i) => (
            <ResultCard key={i} item={item} />
          )) : result.results?.slice(0, 5).map((item, i) => (
            <HotelCard key={i} hotel={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultCard({ item }) {
  const isbus = item.busType || item.operator?.toLowerCase().includes('travels');
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 mb-3 text-sm">
      <div>
        <p className="font-bold text-gray-900">{item.operator}</p>
        <p className="text-gray-500 text-[11px]">{item.code || item.busType} • {item.duration}</p>
        <p className="text-gray-600 text-[11px]">{item.depTime} → {item.arrTime}</p>
      </div>
      <div className="text-right">
        <p className="font-extrabold text-gray-900">₹{item.price?.toLocaleString()}</p>
        <p className="text-[10px] text-gray-400">per person</p>
        {item.seatsLeft < 99 && <p className="text-[10px] text-emerald-600 font-semibold">{item.seatsLeft} seats</p>}
      </div>
    </div>
  );
}

function HotelCard({ hotel }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-100 mb-3 text-sm">
      <div>
        <p className="font-bold text-gray-900">{hotel.property_name || hotel.name}</p>
        <p className="text-gray-500 text-[11px]">{'⭐'.repeat(hotel.hotel_stars || 3)} • {hotel.address}</p>
        {hotel.facilities?.length > 0 && <p className="text-gray-500 text-[10px]">{hotel.facilities.slice(0,3).join(' • ')}</p>}
      </div>
      <div className="text-right">
        <p className="font-extrabold text-gray-900">₹{hotel.price_per_night_inr?.toLocaleString()}</p>
        <p className="text-[10px] text-gray-400">/night</p>
      </div>
    </div>
  );
}

export default function DSAExamples() {
  const [flightStatus, setFlightStatus] = useState('idle');
  const [flightResult, setFlightResult] = useState(null);
  const [flightError,  setFlightError]  = useState(null);

  const [busStatus,    setBusStatus]    = useState('idle');
  const [busResult,    setBusResult]    = useState(null);
  const [busError,     setBusError]     = useState(null);

  const [hotelStatus,  setHotelStatus]  = useState('idle');
  const [hotelResult,  setHotelResult]  = useState(null);
  const [hotelError,   setHotelError]   = useState(null);

  const [apiStatus,    setApiStatus]    = useState(null);

  useEffect(() => {
    // Check API status on mount
    fetch(`${BACKEND_URL}/api/planner/dsa/status`)
      .then(r => r.json())
      .then(d => setApiStatus(d.results))
      .catch(() => {});
  }, []);

  const runFlight = async () => {
    setFlightStatus('loading'); setFlightError(null); setFlightResult(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/planner/dsa/flights/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(FLIGHT_EXAMPLE),
      }).then(r => r.json());
      if (r.success && r.results?.length > 0) {
        setFlightResult(r.results); setFlightStatus('live');
      } else {
        setFlightStatus('empty'); setFlightError(r.message || 'No flights found');
      }
    } catch (e) { setFlightStatus('error'); setFlightError(e.message); }
  };

  const runBus = async () => {
    setBusStatus('loading'); setBusError(null); setBusResult(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/planner/dsa/buses/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(BUS_EXAMPLE),
      }).then(r => r.json());
      if (r.success && r.results?.length > 0) {
        setBusResult(r.results); setBusStatus('live');
      } else {
        setBusStatus('empty'); setBusError(r.message || 'No buses found');
      }
    } catch (e) { setBusStatus('error'); setBusError(e.message); }
  };

  const runHotel = async () => {
    setHotelStatus('loading'); setHotelError(null); setHotelResult(null);
    try {
      const r = await fetch(`${BACKEND_URL}/api/planner/dsa/hotels/search`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(HOTEL_EXAMPLE),
      }).then(r => r.json());
      if (r.success && r.results?.length > 0) {
        setHotelResult(r); setHotelStatus('live');
      } else {
        setHotelStatus('empty'); setHotelError(r.message || 'No hotels found');
      }
    } catch (e) { setHotelStatus('error'); setHotelError(e.message); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f6f0] to-[#f0ede4] font-sans">
      {/* Header */}
      <div className="bg-[#121619] text-white px-6 py-8 text-center">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#D4B15A] bg-[#D4B15A]/10 px-3 py-1 rounded-full border border-[#D4B15A]/20">
          DSA Live API Test Suite
        </span>
        <h1 className="text-3xl font-bold mt-3">DSA Credentials Verification</h1>
        <p className="text-gray-400 text-sm mt-2 max-w-xl mx-auto">
          Live test panel for DSA flight, bus, and hotel APIs. Each test uses verified working inputs.<br/>
          <span className="text-amber-400 font-semibold">Note: Bus only works for South India routes (DSA test env limitation)</span>
        </p>
        {/* API Status row */}
        {apiStatus && (
          <div className="flex justify-center gap-4 mt-4">
            {Object.entries(apiStatus).map(([api, s]) => (
              <div key={api} className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold">
                <StatusDot status={s.status === 'live' ? 'live' : s.status === 'error' ? 'error' : 'empty'} />
                <span className="capitalize">{api}</span>
                <span className="text-gray-400 font-normal">({s.count || 0} results)</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Important notes */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-sm text-amber-800">
          <p className="font-bold mb-1">📌 Known DSA Test Environment Constraints</p>
          <ul className="list-disc list-inside space-y-1 text-[12px]">
            <li><strong>Flights:</strong> Delhi ↔ Mumbai — confirmed working ✅</li>
            <li><strong>Buses:</strong> Bangalore → Chennai only — Delhi→Mumbai returns "No Data Found" (DSA test DB limitation, not a code issue) ✅</li>
            <li><strong>Hotels:</strong> Delhi (CityId: 725862) — 991 hotels confirmed ✅. Kochi (CityId: 128660) — 1 hotel ✅</li>
            <li><strong>Hotel AutoSuggest endpoint:</strong> Returns 404 on test server — using hardcoded verified IDs instead</li>
          </ul>
        </div>

        {/* Flight Panel */}
        <TestPanel
          title="Flight Search — Delhi → Mumbai"
          emoji="✈️"
          status={flightStatus}
          result={flightResult}
          error={flightError}
          onRun={runFlight}
        >
          POST /api/planner/dsa/flights/search<br />
          {`{ "from": "${FLIGHT_EXAMPLE.from}", "to": "${FLIGHT_EXAMPLE.to}", "date": "${FLIGHT_EXAMPLE.date}", "adults": ${FLIGHT_EXAMPLE.adults} }`}
        </TestPanel>

        {/* Bus Panel */}
        <TestPanel
          title="Bus Search — Bangalore → Chennai"
          emoji="🚌"
          status={busStatus}
          result={busResult}
          error={busError}
          onRun={runBus}
        >
          POST /api/planner/dsa/buses/search<br />
          {`{ "from": "${BUS_EXAMPLE.from}", "to": "${BUS_EXAMPLE.to}", "date": "${BUS_EXAMPLE.date}" }`}
        </TestPanel>

        {/* Hotel Panel */}
        <TestPanel
          title="Hotel Search — Delhi (CityId: 725862)"
          emoji="🏨"
          status={hotelStatus}
          result={hotelResult}
          error={hotelError}
          onRun={runHotel}
        >
          POST /api/planner/dsa/hotels/search<br />
          {`{ "city": "${HOTEL_EXAMPLE.city}", "checkIn": "${HOTEL_EXAMPLE.checkIn}", "checkOut": "${HOTEL_EXAMPLE.checkOut}", "rooms": ${HOTEL_EXAMPLE.rooms}, "adults": ${HOTEL_EXAMPLE.adults} }`}
        </TestPanel>

        {/* Run All button */}
        <div className="flex justify-center">
          <button
            onClick={() => { runFlight(); runBus(); runHotel(); }}
            className="px-10 py-3.5 bg-[#121619] hover:bg-[#1e2429] text-[#D4B15A] font-bold rounded-2xl text-sm transition-all shadow-lg cursor-pointer flex items-center gap-2"
          >
            🚀 Run All 3 Tests Simultaneously
          </button>
        </div>
      </div>
    </div>
  );
}

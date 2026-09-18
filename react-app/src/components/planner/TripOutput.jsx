import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDownload, faEdit, faCheckCircle, faSpinner, faPrint, faWallet, faMapPin } from '@fortawesome/free-solid-svg-icons';
import { redraftTripPlan } from '../../services/gemini';
import useAppStore from '../../stores/useAppStore';
import TripPDFDocument from './TripPDFDocument';
import ItineraryRouteMap from './ItineraryRouteMap';
import html2pdf from 'html2pdf.js';


export default function TripOutput({ plan, setPlan, params = null, selectedHotel = null }) {
  const [isEditing, setIsEditing] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const { addToast } = useAppStore();
  const printRef = useRef();
  const navigate = useNavigate();

  if (!plan) return null;

  const handleRedraft = async () => {
    if (!instruction) return;
    setLoading(true);
    try {
      const updated = await redraftTripPlan(plan, instruction);
      if (updated.error) {
        addToast({ type: 'error', message: updated.error });
      } else {
        setPlan(updated);
        addToast({ type: 'success', message: 'Itinerary updated based on your instructions.' });
        setIsEditing(false);
        setInstruction('');
      }
    } catch (err) {
      addToast({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    const el = printRef.current;
    if (!el) { window.print(); return; }

    try {
      // Temporarily force desktop width so mobile/tablet gets a clean A4 PDF
      const originalStyle = el.style.cssText;
      el.style.width = '960px';
      el.style.maxWidth = '960px';

      const opt = {
        margin:       [8, 8, 8, 8], // mm: top/right/bottom/left
        filename:     'trip-itinerary.pdf',
        image:        { type: 'jpeg', quality: 0.97 },
        html2canvas:  {
          scale: 2,           // 2x for crisp text on all screens
          useCORS: true,
          logging: false,
          width: 960,
          windowWidth: 960,
        },
        jsPDF: {
          unit: 'mm',
          format: 'a4',
          orientation: 'portrait',
        },
        pagebreak: { mode: ['avoid-all', 'css'] },
      };

      await html2pdf().set(opt).from(el).save();

      // Restore original styles
      el.style.cssText = originalStyle;
    } catch (err) {
      console.error('PDF generation failed, falling back to print:', err);
      window.print();
    }
  };


  const handleProceedToBooking = () => {
    const locList = (params?.locations || plan?.destinations || ['Destination'])
      .toString()
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const toCity = locList[0] || 'Destination';
    const travelMode = params?.mode?.toLowerCase().includes('flight') ? 'flight' : 'bus';
    
    const queryParams = new URLSearchParams({
      type: travelMode,
      from: 'Delhi',
      to: toCity,
      fromDate: params?.fromDate || plan?.from_date || '',
      toDate: params?.toDate || plan?.to_date || '',
    });

    if (selectedHotel) {
      queryParams.append('hotelId', selectedHotel.hotel_id || 'selected');
      queryParams.append('hotelName', selectedHotel.name);
      queryParams.append('hotelPrice', (selectedHotel.price_per_night_inr || selectedHotel.price_inr || 0).toString());
    } else if (plan?.days?.[0]?.hotel?.name) {
      const hotel = plan.days[0].hotel;
      if (hotel.name && hotel.name !== 'null' && hotel.name !== 'N/A') {
        queryParams.append('hotelId', hotel.hotel_id || 'ai-selected');
        queryParams.append('hotelName', hotel.name);
        queryParams.append('hotelPrice', (hotel.price_per_night_inr || hotel.price || 0).toString());
      }
    }

    navigate(`/booking-grid?${queryParams.toString()}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      
      {/* Action Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center justify-between no-print">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsEditing(!isEditing)} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 flex items-center gap-2">
            <FontAwesomeIcon icon={faEdit} /> Redraft
          </button>
          <button onClick={handlePrint} className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg font-medium hover:bg-gray-100 flex items-center gap-2">
            <FontAwesomeIcon icon={faPrint} /> Print / PDF
          </button>
          <button onClick={handleProceedToBooking} className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 flex items-center gap-2 shadow-md shadow-emerald-600/20">
            <FontAwesomeIcon icon={faWallet} /> Book & Pay Stay + Transport
          </button>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Est. Budget</p>
          <p className="font-bold text-gray-900">
            ₹{(plan.estimated_budget_inr?.min || plan.estimatedBudget?.min)?.toLocaleString()} - ₹{(plan.estimated_budget_inr?.max || plan.estimatedBudget?.max)?.toLocaleString()}
          </p>
        </div>
      </div>

      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden no-print"
          >
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mb-6">
              <h4 className="font-bold text-blue-900 mb-2">Refine Itinerary with AI</h4>
              <p className="text-sm text-blue-700 mb-4">Tell us what to change (e.g., "Make it more relaxed", "Add more food options", "Swap day 1 and 2")</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  placeholder="Your instructions..."
                  className="flex-1 px-4 py-2 rounded-xl border border-blue-200 outline-none focus:ring-2 ring-blue-400"
                />
                <button 
                  onClick={handleRedraft}
                  disabled={loading || !instruction}
                  className="bg-blue-600 text-white px-6 py-2 rounded-xl font-medium hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {loading ? <FontAwesomeIcon icon={faSpinner} spin /> : 'Apply'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Printable Area */}
      <div ref={printRef} className="bg-white rounded-3xl p-8 shadow-xl print:shadow-none print:p-0">
        <TripPDFDocument plan={plan} />
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-xl mt-6 no-print">
        <h3 className="text-xl font-bold mb-4 text-gray-900 font-display flex items-center gap-2">
          <FontAwesomeIcon icon={faMapPin} className="text-[#D4B15A]" /> Live Route Map (Hotels & Spots)
        </h3>
        <ItineraryRouteMap 
          plan={plan} 
          fromCity={params?.fromCity || plan?.from_city || 'Delhi'}
          routeInfo={plan?.routeInfo}
          selectedHotel={selectedHotel}
          isVehicle={params?.mode?.toLowerCase().includes('vehicle') || params?.mode?.toLowerCase().includes('bike') || params?.mode?.toLowerCase().includes('drive') || plan?.travel_mode?.toLowerCase().includes('vehicle') || plan?.travel_mode?.toLowerCase().includes('drive') || plan?.travel_mode?.toLowerCase().includes('bike')}
          onCaptureSnippet={(data) => {
            setPlan(prev => ({ ...prev, liveMapSnippet: data }));
          }}
        />
      </div>

    </div>
  );
}

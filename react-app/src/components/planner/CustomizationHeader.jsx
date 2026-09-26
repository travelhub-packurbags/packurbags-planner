import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faLandmark, 
  faCalendarDays, 
  faHotel, 
  faCarSide, 
  faUtensils, 
  faPlane,
  faCheckDouble, 
  faWallet,
  faChevronRight
} from '@fortawesome/free-solid-svg-icons';

export default function CustomizationHeader({ currentStep, setStep, wizardData, calculateTotalCost }) {
  const steps = [
    { id: 1, label: '1. Tourist Hubs', icon: faLandmark },
    { id: 2, label: '2. Flight/Bus Tickets', icon: faPlane },
    { id: 3, label: '3. Schedule Time', icon: faCalendarDays },
    { id: 4, label: '4. Hotel Stay', icon: faHotel },
    { id: 5, label: '5. Restaurants', icon: faUtensils },
    { id: 6, label: '6. Review & Confirm', icon: faCheckDouble },
  ];

  const totalCost = typeof calculateTotalCost === 'function' ? (calculateTotalCost() || 0) : 0;

  return (
    <div className="sticky top-16 z-40 bg-[#121619]/95 backdrop-blur-md text-white border-b border-white/10 shadow-xl px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Step Indicators */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
          {steps.map((s, idx) => {
            const isActive = currentStep === s.id;
            const isDone = currentStep > s.id;
            return (
              <div key={s.id} className="flex items-center gap-1 sm:gap-2 shrink-0">
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#D4B15A] text-black shadow-lg shadow-[#D4B15A]/20 scale-105'
                      : isDone
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <FontAwesomeIcon icon={s.icon} className="text-xs" />
                  <span>{s.label}</span>
                </button>
                {idx < steps.length - 1 && (
                  <FontAwesomeIcon icon={faChevronRight} className="text-[10px] text-gray-600 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Live Spending Summary */}
        <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4 shrink-0 bg-white/5 px-4 py-1.5 rounded-2xl border border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#D4B15A]/20 flex items-center justify-center text-[#D4B15A]">
              <FontAwesomeIcon icon={faWallet} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Est. Custom Cost</p>
              <p className="text-lg font-extrabold text-[#D4B15A] leading-none">
                ₹{totalCost.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Quick Selection Summary Badges */}
          <div className="hidden lg:flex items-center gap-2 border-l border-white/10 pl-4 text-[11px] text-gray-300">
            {(wizardData?.selectedPlaces?.length || 0) > 0 && (
              <span className="bg-white/10 px-2 py-0.5 rounded-md font-semibold">
                📍 {wizardData.selectedPlaces.length} Spots
              </span>
            )}
            {wizardData?.selectedHotel && (
              <span className="bg-white/10 px-2 py-0.5 rounded-md font-semibold line-clamp-1 max-w-[120px]">
                🏨 {wizardData.selectedHotel.property_name || wizardData.selectedHotel.name}
              </span>
            )}
            {wizardData?.selectedRide && (
              <span className="bg-white/10 px-2 py-0.5 rounded-md font-semibold">
                🚘 Ride Booked
              </span>
            )}
            {((wizardData?.selectedCafes?.length || 0) > 0 || (wizardData?.selectedRestaurants?.length || 0) > 0) && (
              <span className="bg-white/10 px-2 py-0.5 rounded-md font-semibold">
                🍽️ Dining Reserved
              </span>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

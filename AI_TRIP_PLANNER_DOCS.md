# Firstflight Travels - AI Trip Planner ✈️🌍

## 1. Project Overview

The **AI Trip Planner** is a state-of-the-art interactive tool within the Firstflight Travels platform that allows users to generate fully customized, day-by-day itineraries in under 60 seconds. It seamlessly combines user preferences (hotels, ground transport, restaurants, and tourist spots) with real-time data and AI generation (via Google Gemini) to build comprehensive travel plans.

The planner operates entirely in the browser using React (Vite) and Zustand for state management, while relying on a Node.js Express backend proxy for secure third-party API communication.

---

## 2. Core Features & Capabilities

### 📍 Intelligent Destination & Location Engine
- **Global Search:** Utilizes Google Places API (Autocomplete) with primary type restrictions (`locality`, `country`) to accurately search cities worldwide without junk results.
- **Foreign Trip Detection:** Uses a coordinate bounding-box system to detect intercontinental or foreign trips (e.g., India to USA). Automatically restricts invalid transport modes (like road trips across oceans) and triggers international travel tips.
- **Live Weather & Air Quality:** Fetches real-time weather forecasts and AQI (OpenWeatherMap API) for the destination, automatically generating smart reroute suggestions for severe weather conditions (e.g., cyclones, heatwaves).

### 🚗 Multi-Modal Transport Routing
- **Road Trip Calculation:** Uses OpenRouteService (ORS) to generate precise driving routes, complete with dynamic arrival times based on distance (capped at 8-10 hours/day). 
- **Custom Departure Times:** Users driving personal vehicles can specify an exact departure time, and the system dynamically calculates the arrival time on the final day, pushing this data directly to the AI for scheduling context.
- **Live Flight/Bus Integration:** Integrates with DSA (Dummy Search API) to pull live flight and bus schedules, prices, and operators, locking them directly into the itinerary.

### 🏨 Interactive Planning UI (Step-by-Step Wizard)
- **Living Map:** A Leaflet-based map that dynamically updates at every step, plotting route lines (both straight-line flight paths and detailed ORS road polylines) and plotting selected tourist spots/hotels with interactive markers.
- **Spot Selection:** Fetches verified tourist attractions from Google Places and local datasets, complete with entry fees, DSLR permissions, and weekly off days.
- **Restaurant & Dining:** Leverages Google Places (Text Search with geofenced location biasing) to pull the top 10 rated restaurants in the specific destination city, allowing users to reserve seats for specific meals (Lunch/Dinner).

### 🤖 Gemini AI Itinerary Generation
- **Context-Aware Scheduling:** Takes the user's hard-scheduled spots, driving times, and meal selections, and injects them as immutable constraints.
- **Budget Guardrails:** Calculates absolute minimum realistic costs (e.g., ₹1500/day/person) and prevents the AI from hallucinating unrealistically cheap hotels to fit a low budget.
- **Contextual Formatting:** Outputs a strict JSON structure containing the trip summary, daily schedule, itemized costs, and smart travel tips.

---

## 3. Workflows & Implementation Strategies

### The 6-Step Customization Workflow
1. **Basic Info:** Origin, Destination, Dates, Transport Mode, Budget Tier, Traveller Count.
2. **Flight/Bus Tickets:** User selects outbound and return journeys. If road trip, exact drive durations are mapped.
3. **Tourist Hubs:** User picks attractions and assigns them to specific days and time slots (Morning/Afternoon/Evening).
4. **Hotel Stay:** User books one or more hotels. AI enforces hotel sequences exactly as booked.
5. **Restaurants:** User reserves seats at top local restaurants for specific meals.
6. **Review & Confirm:** All choices are aggregated, total budget is calculated, and the Gemini AI prompt is constructed.

### Fallback & Resilience Strategies
- **Haversine Fallback:** If ORS routing fails or the trip is cross-ocean (resulting in a 503 error), the app gracefully falls back to the Haversine formula to draw a straight flight path.
- **Rate Limit Buckets:** The frontend uses an in-memory token bucket system (`rateLimit.js`) to prevent spamming Gemini or Weather APIs.
- **Offline Generator:** If the Gemini API fails, times out, or returns invalid JSON, the app automatically falls back to a smart offline algorithm (`generateFallbackTripPlan`) that stitches together the user's choices manually.

---

## 4. Final Updates & Loopholes Patched (Sept 2026)

During the final polish, several critical AI and routing loopholes were addressed:

1. **Strict Scheduling Enforcement:** User-selected Day/TimeSlot combinations were injected into the Gemini prompt as `[HARD_SCHEDULED_BY_USER]` constraints, preventing the AI from moving or dropping user choices.
2. **Dynamic Road Trip Arrival Time:** Hardcoded arrival times (e.g., 09:00 PM) were replaced with a dynamic calculation (`06:00 AM + drive hours`), preventing the AI from thinking Day 1 was entirely consumed by driving on short trips.
3. **Custom Departure Time Picker:** Added a native UI time picker for personal vehicles. Users can depart at any time, and the UI live-updates the arrival time and syncs it with the AI.
4. **Real Restaurant Filler Rule:** Prevented the AI from hallucinating repetitive placeholders like "Local Heritage Restaurant" by explicitly instructing it to pull varied, real local names for empty meal slots.
5. **Geofenced Google Places (Location Bias):** Removed India-only region locks and added a 15km bounding radius to the Google Places restaurant search, fixing issues where a global query returned same-named restaurants from other states (e.g., a Bangalore restaurant showing up in Agra).
6. **Departure Day Sightseeing Block:** Injected a strict boundary rule into Gemini preventing it from scheduling destination sightseeing or hotel check-ins during the "Return Journey" portion of the trip.
7. **Foreign Trip Capability:** Implemented bounding-box logic to detect trips leaving the country. Automatically forces "Flight" mode, bypasses road routing, and instructs Gemini to append Visa Requirements and Currency Exchange info to the final PDF.

---
*Generated by Antigravity AI*

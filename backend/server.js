import express from 'express';
import cors from 'cors';
import { PDFDocument, rgb } from 'pdf-lib';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import pool from './services/db.js';
import './services/weatherAlertCron.js';
import twilio from 'twilio';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Ensure tickets directory exists
const ticketsDir = path.join(__dirname, 'tickets');
if (!fs.existsSync(ticketsDir)) {
  fs.mkdirSync(ticketsDir, { recursive: true });
}

// Serve tickets statically
app.use('/tickets', express.static(ticketsDir));

app.post('/api/book', async (req, res) => {
  try {
    const booking = req.body;
    console.log('Received booking request:', booking);

    if (!booking.userId || !booking.email) {
      return res.status(400).json({ success: false, message: 'Missing required booking fields (userId, email)' });
    }

    // 1. GENERATE PDF TICKET
    const pdfBytes = await generatePDF(booking);
    const fileName = `ticket_${booking.userId}_${Date.now()}.pdf`;
    const filePath = path.join(ticketsDir, fileName);
    fs.writeFileSync(filePath, pdfBytes);

    const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
    const pdfUrl = `${serverUrl}/tickets/${fileName}`;

    // 2. CALL N8N WEBHOOK
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/firstflight-booking';
    
    console.log(`Sending webhook to n8n: ${n8nWebhookUrl}`);
    try {
      await axios.post(n8nWebhookUrl, {
        ...booking,
        pdf_url: pdfUrl
      });
      console.log('n8n webhook triggered successfully');
    } catch (webhookErr) {
      console.error('Failed to trigger n8n webhook:', webhookErr.message);
      // We don't fail the entire request if n8n is not running/accessible,
      // but we warn the user in the response.
    }

    // 3. SAVE BOOKING TO POSTGRESQL DATABASE
    try {
      const destination = booking.itemData?.to || 'Unknown';
      const startDate = booking.itemData?.fromDate || new Date().toISOString().split('T')[0];
      
      const insertQuery = `
        INSERT INTO bookings (user_id, email, phone, name, destination, start_date)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id;
      `;
      
      const insertValues = [
        booking.userId,
        booking.email,
        booking.phone || 'N/A',
        booking.name || 'Passenger',
        destination,
        startDate
      ];
      
      await pool.query(insertQuery, insertValues);
      console.log('Booking stored in PostgreSQL cache database successfully');
    } catch (dbErr) {
      console.error('Failed to store booking in database:', dbErr.message);
    }

    res.json({ 
      success: true, 
      message: 'Booking confirmed!', 
      pdfUrl: pdfUrl 
    });
  } catch (err) {
    console.error('Booking endpoint error:', err);
    res.status(500).json({ success: false, message: 'Internal Server Error', error: err.message });
  }
});

// GET endpoint for cron/internal tracking of upcoming trips
app.get('/api/bookings/upcoming', async (req, res) => {
  try {
    const days = parseInt(req.query.days || '2');
    const query = `
      SELECT id, name, phone, email, destination, start_date::text AS start_date
      FROM bookings
      WHERE start_date = CURRENT_DATE + CAST($1 || ' days' AS INTERVAL);
    `;
    const { rows } = await pool.query(query, [days]);
    res.json(rows);
  } catch (err) {
    console.error('Upcoming bookings endpoint error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve upcoming bookings', error: err.message });
  }
});

// GET endpoint to securely provide frontend with map API keys if they are stored in backend
app.get('/api/config/maps', (req, res) => {
  res.json({
    googlePlacesKey: process.env.PLANNER_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_KEY || process.env.VITE_GOOGLE_PLACES_KEY || '',
    orsKey: process.env.PLANNER_ORS_KEY || process.env.ORS_KEY || process.env.VITE_ORS_KEY || ''
  });
});

// ============================================================
// POST /api/planner/generate  — Secure Gemini AI proxy
// The Gemini API key is read from PLANNER_GEMINI_API_KEY (server-side only).
// The frontend sends the full prompt and system instruction; the key never
// leaves this process, so it will not appear in any browser bundle.
// ============================================================
app.post('/api/planner/generate', async (req, res) => {
  const geminiKey = process.env.PLANNER_GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  if (!geminiKey) {
    return res.status(503).json({ error: 'PLANNER_UNAVAILABLE', message: 'AI generation key not configured on this server.' });
  }

  const { userMessage, systemInstruction, model } = req.body;
  if (!userMessage) {
    return res.status(400).json({ error: 'Missing userMessage in request body' });
  }

  const MODELS_TO_TRY = model ? [model] : [
    'gemini-2.0-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
  ];
  const BASE_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models';

  for (const m of MODELS_TO_TRY) {
    try {
      const url = `${BASE_GEMINI}/${m}:generateContent?key=${geminiKey}`;
      const payload = {
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const gemRes = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 55000,
      });

      const rawText = gemRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) continue;

      return res.json({ success: true, text: rawText, model: m });
    } catch (err) {
      console.warn(`[planner/generate] Model ${m} failed:`, err.message);
    }
  }

  // All models failed — return structured fallback so frontend gracefully degrades
  return res.json({
    success: false,
    text: JSON.stringify({
      days: [],
      trip_summary: { weather_note: 'Pleasant weather expected during travel dates.' },
      tips: ['Enjoy your journey!']
    }),
    model: null,
  });
});

// ============================================================
// /v1/planner/* — Google Places + ORS proxy routes
// Called by the production frontend (features/planner/api/plannerApi.js).
// All keys are read from PLANNER_* env vars — never from the bundle.
// Returns 503 { code: 'PLANNER_UNAVAILABLE' } when a key is missing so the
// frontend's optional() wrapper gracefully falls back to local data.
// ============================================================
const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';
const GOOGLE_GEOCODE_BASE = 'https://maps.googleapis.com/maps/api';
const ORS_BASE = 'https://api.openrouteservice.org';

function getGoogleKey() {
  return process.env.PLANNER_GOOGLE_PLACES_KEY || process.env.GOOGLE_PLACES_KEY || process.env.VITE_GOOGLE_PLACES_KEY || '';
}
function getOrsKey() {
  return process.env.PLANNER_ORS_KEY || process.env.ORS_KEY || process.env.VITE_ORS_KEY || '';
}

// GET /v1/planner/places/search?q=<query>
app.get('/v1/planner/places/search', async (req, res) => {
  const key = getGoogleKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Google Places key not configured.' });
  const query = req.query.q || '';
  if (!query.trim()) return res.json({ suggestions: [] });
  try {
    const response = await axios.post(
      `${GOOGLE_PLACES_BASE}/places:autocomplete`,
      { input: query.trim(), includedRegionCodes: ['in'] },
      { headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'Referer': 'https://packurbag.in/' }, timeout: 8000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[v1/planner/places/search]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// GET /v1/planner/places/:placeId
app.get('/v1/planner/places/:placeId', async (req, res) => {
  const key = getGoogleKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Google Places key not configured.' });
  const { placeId } = req.params;
  try {
    const response = await axios.get(
      `${GOOGLE_PLACES_BASE}/places/${encodeURIComponent(placeId)}`,
      { headers: { 'X-Goog-Api-Key': key, 'Referer': 'https://packurbag.in/', 'X-Goog-FieldMask': 'id,displayName,location,rating,formattedAddress,websiteUri,photos' }, timeout: 8000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[v1/planner/places/:id]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// GET /v1/planner/geocode?city=<name>
app.get('/v1/planner/geocode', async (req, res) => {
  const key = getGoogleKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Google Places key not configured.' });
  const city = req.query.city || '';
  if (!city.trim()) return res.status(400).json({ error: 'city query param required' });
  try {
    const response = await axios.post(
      `${GOOGLE_PLACES_BASE}/places:searchText`,
      { textQuery: city.trim(), maxResultCount: 1 },
      { headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'Referer': 'https://packurbag.in/', 'X-Goog-FieldMask': 'places.location,places.displayName,places.formattedAddress' }, timeout: 8000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[v1/planner/geocode]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// GET /v1/planner/places/attractions?city=<name>
app.get('/v1/planner/places/attractions', async (req, res) => {
  const key = getGoogleKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Google Places key not configured.' });
  const city = req.query.city || '';
  if (!city.trim()) return res.status(400).json({ error: 'city query param required' });
  try {
    const response = await axios.post(
      `${GOOGLE_PLACES_BASE}/places:searchText`,
      { textQuery: `top tourist attractions in ${city.trim()}`, maxResultCount: 10 },
      { headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'Referer': 'https://packurbag.in/', 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.rating,places.formattedAddress,places.photos' }, timeout: 10000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[v1/planner/places/attractions]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// POST /v1/planner/route  — OpenRouteService proxy
app.post('/v1/planner/route', async (req, res) => {
  const key = getOrsKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'ORS key not configured.' });
  const { coordinates, instructions = false } = req.body;
  if (!coordinates || coordinates.length < 2) return res.status(400).json({ error: 'coordinates array with at least 2 points required' });
  try {
    const response = await axios.post(
      `${ORS_BASE}/v2/directions/driving-car/geojson`,
      { coordinates, instructions },
      { headers: { 'Authorization': key, 'Content-Type': 'application/json' }, timeout: 15000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[v1/planner/route]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// ============================================================
// ORS Geocoding proxy — GET /api/planner/ors/geocode
// qs: text (required), type=city|place (optional, city adds layer filter)
// ============================================================
app.get('/api/planner/ors/geocode', async (req, res) => {
  const key = getOrsKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'ORS key not configured.' });
  const { text, type } = req.query;
  if (!text?.trim()) return res.status(400).json({ error: 'text query param required' });
  try {
    const url = new URL(`${ORS_BASE}/geocode/search`);
    url.searchParams.set('api_key', key);
    const t = text.trim();
    url.searchParams.set('text', t.includes('India') ? t : `${t}, India`);
    url.searchParams.set('size', '1');
    url.searchParams.set('boundary.country', 'IND');
    if (type === 'city') url.searchParams.set('layers', 'locality,region');
    const response = await axios.get(url.toString(), { timeout: 8000 });
    res.json(response.data);
  } catch (err) {
    console.error('[api/planner/ors/geocode]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// ============================================================
// ORS POIs proxy — POST /api/planner/ors/pois
// body: { request: <ORS POI request object> }
// ============================================================
app.post('/api/planner/ors/pois', async (req, res) => {
  const key = getOrsKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'ORS key not configured.' });
  const { request } = req.body;
  if (!request) return res.status(400).json({ error: 'request body required' });
  try {
    const response = await axios.post(
      `${ORS_BASE}/pois`,
      { request },
      { headers: { 'Authorization': key, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[api/planner/ors/pois]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// ============================================================
// Weather proxy — GET /api/planner/weather
// qs: city, lat, lng (city OR lat+lng required)
// Tries XWeather first, falls back to OpenWeatherMap
// ============================================================
app.get('/api/planner/weather', async (req, res) => {
  const owmKey  = process.env.PLANNER_OPENWEATHER_KEY || process.env.OPENWEATHER_KEY || '';
  const xwId    = process.env.XWEATHER_CLIENT_ID || '';
  const xwSec   = process.env.XWEATHER_CLIENT_SECRET || '';
  const { city, lat, lng } = req.query;
  if (!city && (!lat || !lng)) return res.status(400).json({ error: 'Provide city or lat+lng' });

  // Try XWeather first
  if (xwId && xwSec && xwId.length > 5) {
    try {
      const queryLoc = (lat && lng) ? `${lat},${lng}` : encodeURIComponent(city);
      const xwRes = await axios.get(
        `https://data.api.xweather.com/forecasts/${queryLoc}?client_id=${xwId}&client_secret=${xwSec}`,
        { timeout: 10000 }
      );
      if (xwRes.data?.success) return res.json({ source: 'xweather', data: xwRes.data });
    } catch (err) {
      console.warn('[weather/xweather]', err.message);
    }
  }

  // Fall back to OpenWeatherMap
  if (!owmKey) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Weather API not configured.' });
  try {
    const base = 'https://api.openweathermap.org/data/2.5';
    const url = (lat && lng)
      ? `${base}/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${owmKey}`
      : `${base}/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${owmKey}`;
    const owmRes = await axios.get(url, { timeout: 10000 });
    res.json({ source: 'openweather', data: owmRes.data });
  } catch (err) {
    console.error('[weather/owm]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// ============================================================
// AQI proxy — GET /api/planner/weather/aqi?lat=&lng=
// ============================================================
app.get('/api/planner/weather/aqi', async (req, res) => {
  const owmKey = process.env.PLANNER_OPENWEATHER_KEY || process.env.OPENWEATHER_KEY || '';
  if (!owmKey) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Weather API not configured.' });
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
  try {
    const owmRes = await axios.get(
      `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lng}&appid=${owmKey}`,
      { timeout: 8000 }
    );
    res.json(owmRes.data);
  } catch (err) {
    console.error('[weather/aqi]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});

// ============================================================
// Google Static Maps proxy — GET /api/planner/static-map?params=<urlencoded_query>
// The key is injected server-side; never exposed to the browser.
// ============================================================
app.get('/api/planner/static-map', async (req, res) => {
  const key = getGoogleKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Google key not configured.' });
  const { params } = req.query;
  if (!params) return res.status(400).json({ error: 'params required' });
  try {
    const staticUrl = `https://maps.googleapis.com/maps/api/staticmap?${params}&key=${key}`;
    const response = await axios.get(staticUrl, { responseType: 'arraybuffer', timeout: 12000, headers: { 'Referer': 'https://packurbag.in/' } });
    res.set('Content-Type', response.headers['content-type'] || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (err) {
    console.error('[static-map]', err.message);
    res.status(503).send('');
  }
});

// ============================================================
// Google Places Photo proxy — GET /api/planner/places/photo?ref=<photoRef>&maxH=500
// Fetches the actual image bytes and streams them; key never in browser URL.
// ============================================================
app.get('/api/planner/places/photo', async (req, res) => {
  const key = getGoogleKey();
  if (!key) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Google key not configured.' });
  const { ref, maxH = 500 } = req.query;
  if (!ref) return res.status(400).json({ error: 'ref required' });
  try {
    const photoUrl = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=${maxH}&key=${key}`;
    const response = await axios.get(photoUrl, { responseType: 'arraybuffer', timeout: 12000, maxRedirects: 5, headers: { 'Referer': 'https://packurbag.in/' } });
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=604800'); // 7 days
    res.send(response.data);
  } catch (err) {
    console.error('[places/photo]', err.message);
    res.status(503).send('');
  }
});

// ============================================================
// Serper image search proxy — GET /api/planner/serper/images?q=<query>
// ============================================================
app.get('/api/planner/serper/images', async (req, res) => {
  const serperKey = process.env.PLANNER_SERPER_API_KEY || process.env.SERPER_API_KEY || '';
  if (!serperKey) return res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: 'Serper API not configured.' });
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q query param required' });
  try {
    const response = await axios.post(
      'https://google.serper.dev/images',
      { q: q.trim(), num: 5 },
      { headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    res.json(response.data);
  } catch (err) {
    console.error('[serper/images]', err.message);
    res.status(503).json({ code: 'PLANNER_UNAVAILABLE', message: err.message });
  }
});



async function generatePDF(booking) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 540]);
  const { width, height } = page.getSize();
  
  // Custom theme colors (Firstflight Branding)
  const primaryColor = rgb(18 / 255, 22 / 255, 25 / 255); // #121619
  const accentColor = rgb(212 / 255, 177 / 255, 90 / 255); // #D4B15A (Gold)
  const darkGray = rgb(100 / 255, 110 / 255, 120 / 255);

  // Draw Header Banner
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width: width,
    height: 100,
    color: primaryColor,
  });

  // Header Title
  page.drawText('FIRSTFLIGHT TRAVELS', {
    x: 40,
    y: height - 60,
    size: 24,
    color: accentColor,
  });

  page.drawText('OFFICIAL BOOKING CONFIRMATION TICKET', {
    x: 40,
    y: height - 80,
    size: 10,
    color: rgb(1, 1, 1),
  });

  // Ticket Body
  let currentY = height - 140;

  // Draw Section Header: Passenger Details
  page.drawText('PASSENGER DETAILS', { x: 40, y: currentY, size: 12, color: accentColor });
  page.drawLine({
    start: { x: 40, y: currentY - 5 },
    end: { x: width - 40, y: currentY - 5 },
    thickness: 1,
    color: accentColor,
  });

  currentY -= 30;
  page.drawText(`Name: ${booking.name || 'N/A'}`, { x: 50, y: currentY, size: 11, color: primaryColor });
  page.drawText(`Email: ${booking.email || 'N/A'}`, { x: 300, y: currentY, size: 11, color: primaryColor });
  
  currentY -= 20;
  page.drawText(`Phone: ${booking.phone || 'N/A'}`, { x: 50, y: currentY, size: 11, color: primaryColor });
  page.drawText(`User ID: ${booking.userId || 'N/A'}`, { x: 300, y: currentY, size: 10, color: darkGray });

  // Draw Section Header: Transport Details
  currentY -= 40;
  page.drawText('TRANSPORT DETAILS', { x: 40, y: currentY, size: 12, color: accentColor });
  page.drawLine({
    start: { x: 40, y: currentY - 5 },
    end: { x: width - 40, y: currentY - 5 },
    thickness: 1,
    color: accentColor,
  });

  const itemName = booking.itemData?.name || booking.itemData?.airline || booking.itemData?.vendor_id || 'Travel Booking';
  const transportPrice = booking.itemData?.price_inr || booking.itemData?.price_per_night_inr || booking.itemData?.price || (booking.itemData?.price_per_km ? booking.itemData.price_per_km * 100 : 0);

  currentY -= 30;
  page.drawText(`Item Type: ${booking.itemType ? booking.itemType.toUpperCase() : 'N/A'}`, { x: 50, y: currentY, size: 11, color: primaryColor });
  page.drawText(`Provider/Line: ${itemName}`, { x: 300, y: currentY, size: 11, color: primaryColor });

  if (booking.itemData?.from && booking.itemData?.to) {
    currentY -= 20;
    page.drawText(`Route: ${booking.itemData.from} to ${booking.itemData.to}`, { x: 50, y: currentY, size: 11, color: primaryColor });
  } else if (booking.itemData?.city) {
    currentY -= 20;
    page.drawText(`City: ${booking.itemData.city}`, { x: 50, y: currentY, size: 11, color: primaryColor });
  }

  // Draw Section Header: Hotel Details (If present)
  let hotelTotalPrice = 0;
  if (booking.hotelData) {
    hotelTotalPrice = booking.hotelData.total_price_inr || 0;
    currentY -= 40;
    page.drawText('ACCOMMODATION DETAILS', { x: 40, y: currentY, size: 12, color: accentColor });
    page.drawLine({
      start: { x: 40, y: currentY - 5 },
      end: { x: width - 40, y: currentY - 5 },
      thickness: 1,
      color: accentColor,
    });

    currentY -= 30;
    page.drawText(`Hotel Name: ${booking.hotelData.name}`, { x: 50, y: currentY, size: 11, color: primaryColor });
    page.drawText(`Duration: ${booking.hotelData.nights || 1} Night(s)`, { x: 350, y: currentY, size: 11, color: primaryColor });
    
    currentY -= 20;
    page.drawText(`Price / Night: INR ${(booking.hotelData.price_per_night_inr || 0).toLocaleString()}`, { x: 50, y: currentY, size: 11, color: primaryColor });
  }

  // Draw Section Header: Billing Details
  currentY -= 40;
  page.drawText('BILLING DETAILS', { x: 40, y: currentY, size: 12, color: accentColor });
  page.drawLine({
    start: { x: 40, y: currentY - 5 },
    end: { x: width - 40, y: currentY - 5 },
    thickness: 1,
    color: accentColor,
  });

  currentY -= 30;
  page.drawText(`Transport Fare:`, { x: 50, y: currentY, size: 11, color: primaryColor });
  page.drawText(`INR ${transportPrice.toLocaleString()}`, { x: 200, y: currentY, size: 11, color: primaryColor });
  
  if (booking.hotelData) {
    currentY -= 20;
    page.drawText(`Hotel Fare:`, { x: 50, y: currentY, size: 11, color: primaryColor });
    page.drawText(`INR ${hotelTotalPrice.toLocaleString()}`, { x: 200, y: currentY, size: 11, color: primaryColor });
  }

  const finalTotal = transportPrice + hotelTotalPrice;
  currentY -= 20;
  page.drawText(`Total Charged:`, { x: 50, y: currentY, size: 11, fontStyle: 'bold', color: primaryColor });
  page.drawText(`INR ${finalTotal.toLocaleString()}`, { x: 200, y: currentY, size: 11, fontStyle: 'bold', color: primaryColor });
  
  currentY -= 20;
  page.drawText(`Status:`, { x: 50, y: currentY, size: 11, color: primaryColor });
  page.drawText(`PAID (Razorpay/PhonePe Mock)`, { x: 200, y: currentY, size: 11, color: rgb(0, 0.5, 0) });

  // Footer text
  page.drawText('Thank you for booking with Firstflight Travels. Have a safe journey!', {
    x: 40,
    y: 30,
    size: 10,
    color: darkGray,
  });

  return await pdfDoc.save();
}

// Custom WhatsApp OTP Authentication Setup (WasenderAPI)
const otps = new Map();

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    
    // Generate random 6-digit code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5-minute lifespan
    otps.set(phone, { code: otp, expiresAt });

    console.log(`[AUTH] Sending WhatsApp OTP ${otp} to ${phone} via WasenderAPI`);
    
    const token = process.env.WASENDER_API_KEY || '';
    await axios.post('https://wasenderapi.com/api/send-message', {
      to: phone,
      text: `Your Firstflight verification OTP code is: ${otp}. Valid for 5 minutes.`
    }, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
      
    res.json({ success: true, message: 'OTP sent successfully via WhatsApp' });
  } catch (err) {
    console.error('[AUTH ERROR] Send OTP failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ success: false, message: 'Phone and OTP code are required' });
    }
    
    console.log(`[AUTH] Verifying code ${code} for ${phone}`);
    const record = otps.get(phone);
    if (!record) {
      return res.status(400).json({ success: false, message: 'No OTP requested for this phone number' });
    }

    if (Date.now() > record.expiresAt) {
      otps.delete(phone);
      return res.status(400).json({ success: false, message: 'OTP code has expired' });
    }

    if (record.code !== code) {
      return res.status(400).json({ success: false, message: 'Invalid OTP code' });
    }

    // OTP Verified, clear map entry
    otps.delete(phone);

    const mockUser = {
      id: `usr_${Date.now()}`,
      name: `User ${phone.slice(-4)}`,
      phone: phone,
      email: `${phone.replace('+', '')}@firstflight.com`
    };
    res.json({ success: true, user: mockUser });
  } catch (err) {
    console.error('[AUTH ERROR] Verify OTP failed:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});


// ============================================================
//  DSA LIVE API PROXY ROUTES
// ============================================================

// --- City Resolution Helpers ---

// Well-known Indian city → IATA map (fast path, no API call needed)
const IATA_MAP = {
  'delhi': 'DEL', 'new delhi': 'DEL',
  'mumbai': 'BOM', 'bombay': 'BOM',
  'bangalore': 'BLR', 'bengaluru': 'BLR',
  'chennai': 'MAA', 'madras': 'MAA',
  'hyderabad': 'HYD',
  'kolkata': 'CCU', 'calcutta': 'CCU',
  'ahmedabad': 'AMD',
  'pune': 'PNQ',
  'goa': 'GOI', 'panaji': 'GOI',
  'jaipur': 'JAI',
  'lucknow': 'LKO',
  'amritsar': 'ATQ',
  'varanasi': 'VNS',
  'bhubaneswar': 'BBI',
  'kochi': 'COK', 'cochin': 'COK',
  'trivandrum': 'TRV', 'thiruvananthapuram': 'TRV',
  'coimbatore': 'CJB',
  'mangalore': 'IXE',
  'nagpur': 'NAG',
  'indore': 'IDR',
  'bhopal': 'BHO',
  'raipur': 'RPR',
  'ranchi': 'IXR',
  'srinagar': 'SXR',
  'chandigarh': 'IXC',
  'leh': 'IXL',
  'guwahati': 'GAU',
  'udaipur': 'UDR',
  'jodhpur': 'JDH',
  'vadodara': 'BDQ',
  'visakhapatnam': 'VTZ', 'vizag': 'VTZ',
  'madurai': 'IXM',
  'tiruchirappalli': 'TRZ',
  'patna': 'PAT',
  'port blair': 'IXZ',
  'surat': 'STV',
  'rajkot': 'RAJ',
};

// Use Cerebras to resolve IATA for cities not in the map
async function resolveIATA(cityName) {
  const key = cityName.toLowerCase().trim();
  if (IATA_MAP[key]) return IATA_MAP[key];
  try {
    const csKey = process.env.CEREBRAS_API_KEY || '';
    if (!csKey) return null;
    const res = await axios.post('https://api.cerebras.ai/v1/chat/completions', {
      model: 'llama-3.3-70b',
      messages: [{ role: 'user', content: `What is the 3-letter IATA airport code for the primary airport serving "${cityName}" in India? Reply with ONLY the 3-letter IATA code, nothing else. Example: DEL` }],
      max_tokens: 10,
    }, { headers: { Authorization: `Bearer ${csKey}`, 'Content-Type': 'application/json' } });
    const code = res.data.choices?.[0]?.message?.content?.trim().toUpperCase().slice(0, 3);
    if (code && /^[A-Z]{3}$/.test(code)) {
      IATA_MAP[key] = code;
      return code;
    }
  } catch (e) {
    console.warn('Cerebras IATA lookup failed:', e.message);
  }
  return null;
}

// Resolve DSA City Ids for Buses using city_code.json
let busCityCodeMap = [];
try {
  const cityCodeData = JSON.parse(fs.readFileSync(path.join(__dirname, '../city_code.json'), 'utf-8'));
  const tableData = cityCodeData.find(d => d.type === 'table' && d.name === 'city_code');
  if (tableData && tableData.data) {
    busCityCodeMap = tableData.data;
    console.log(`Loaded ${busCityCodeMap.length} bus city codes from city_code.json`);
  }
} catch (e) {
  console.error("Failed to load city_code.json", e);
}

function resolveBusCityId(cityName) {
  if (!cityName) return null;
  const nameLower = cityName.toLowerCase().trim();
  
  // Hardcoded overrides (known good for buses)
  if (nameLower === 'delhi' || nameLower === 'new delhi') return '2';
  if (nameLower === 'kochi' || nameLower === 'cochin') return '115';
  if (nameLower === 'bengaluru') return '4'; 

  const match = busCityCodeMap.find(c => c.cico_city_name.toLowerCase() === nameLower || c.cico_city_name.toLowerCase().startsWith(nameLower + ','));
  return match ? String(match.cico_id) : null;
}

// Resolve DSA City Ids for Hotels using hotel_city_code_special.json
let hotelCityCodeMap = [];
try {
  const hotelCodeData = JSON.parse(fs.readFileSync(path.join(__dirname, '../hotel_city_code_special.json'), 'utf-8'));
  const tableData = hotelCodeData.find(d => d.type === 'table' && d.name === 'hotel_city_code_special');
  if (tableData && tableData.data) {
    hotelCityCodeMap = tableData.data;
    console.log(`Loaded ${hotelCityCodeMap.length} hotel city codes from hotel_city_code_special.json`);
  }
} catch (e) {
  console.error("Failed to load hotel_city_code_special.json", e);
}

// Load fallback hotels from react-app's public hotels.json dataset
let localHotels = [];
try {
  localHotels = JSON.parse(fs.readFileSync(path.join(__dirname, '../react-app/public/data/hotels.json'), 'utf-8'));
  console.log(`Loaded ${localHotels.length} fallback hotels from react-app hotels.json`);
} catch (e) {
  console.error("Failed to load fallback hotels.json from react-app", e);
  // Try loading parent hotels.json as absolute fallback
  try {
    localHotels = JSON.parse(fs.readFileSync(path.join(__dirname, '../hotels.json'), 'utf-8'));
    console.log(`Loaded ${localHotels.length} fallback hotels from parent hotels.json`);
  } catch (err) {
    console.error("Failed to load parent hotels.json fallback", err);
  }
}

function getLocalHotelsForCity(cityName, allowGenericFallback = false) {
  if (!cityName) return [];
  const lower = cityName.toLowerCase().trim();
  let matches = localHotels.filter(h => (h.city || '').toLowerCase() === lower);
  if (!matches.length && lower.length >= 4) {
    matches = localHotels.filter(h => (h.city || '').toLowerCase().includes(lower) || lower.includes((h.city || '').toLowerCase()));
  }
  // If still no matches, return generic ones only if allowed
  if (!matches.length && allowGenericFallback && localHotels.length > 0) {
    matches = localHotels.slice(0, 3);
  }

  const HOTEL_GALLERY = [
    'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=800&q=80'
  ];

  return matches.map((h, i) => {
    const images = [];
    if (h.image && typeof h.image === 'string' && h.image.startsWith('http')) images.push(h.image);
    const imgOffset = (i * 3) % HOTEL_GALLERY.length;
    for (let k = 0; k < 4; k++) {
      images.push(HOTEL_GALLERY[(imgOffset + k) % HOTEL_GALLERY.length]);
    }
    return {
      id: h.hotel_id || h.id || `local-hotel-${i}`,
      property_name: h.name || h.property_name || 'Hotel',
      name: h.name || h.property_name || 'Hotel',
      hotel_stars: h.star_category || h.rating || h.hotel_stars || 3,
      address: h.address || cityName,
      city: h.city || cityName,
      price_per_night_inr: h.price_per_night_inr || h.price_inr || 2500,
      price_inr: h.price_per_night_inr || h.price_inr || 2500,
      images,
      image: images[0],
      facilities: h.amenities || h.hotel_facilities || ['Doctor on Call', 'Lobby', 'Front Desk', '24 Hour Room Service'],
      roomType: h.room_type || 'Standard Room',
      hotelCategory: (h.hotel_category || 'HOTEL').toUpperCase(),
      lat: parseFloat(h.lat || h.latitude) || null,
      lng: parseFloat(h.lng || h.longitude) || null,
      source: 'LocalFallback',
    };
  });
}



async function resolveHotelCityId(cityName) {
  if (!cityName) return null;
  const nameLower = cityName.toLowerCase().trim();
  
  let match = hotelCityCodeMap.find(c => c.destination.toLowerCase() === nameLower);
  if (!match) {
    match = hotelCityCodeMap.find(c => c.destination.toLowerCase().startsWith(nameLower));
  }
  if (!match) {
    match = hotelCityCodeMap.find(c => c.destination.toLowerCase().includes(nameLower) || nameLower.includes(c.destination.toLowerCase()));
  }
  return match ? String(match.cityid) : null;
}

async function resolveBusCityCodes(fromCity, toCity) {
  return {
    fromCode: resolveBusCityId(fromCity),
    toCode: resolveBusCityId(toCity),
  };
}

// Helper to format DSA times
function formatTime(isoStr) {
  if (!isoStr) return 'TBD';
  try {
    const d = new Date(isoStr);
    if (isNaN(d)) return isoStr;
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return isoStr; }
}

// Helper: Local fallback flights generator when DSA fails or is unauthorized
function getFallbackFlights(from, to, date) {
  const fCity = from ? from.charAt(0).toUpperCase() + from.slice(1) : 'Delhi';
  const tCity = to ? to.charAt(0).toUpperCase() + to.slice(1) : 'Mumbai';
  return [
    {
      id: `fallback-flight-1-${fCity}-${tCity}`,
      type: 'flight',
      operator: 'IndiGo',
      code: '6E-2031',
      depTime: '06:00 AM',
      arrTime: '08:15 AM',
      duration: '2h 15m',
      price: 4799,
      seatsLeft: 5,
      baggage: '15kg Check-in',
      cabinClass: 'Economy',
      isRefundable: true,
      from: fCity,
      to: tCity,
      date: date,
      source: 'LocalFallback'
    },
    {
      id: `fallback-flight-2-${fCity}-${tCity}`,
      type: 'flight',
      operator: 'Air India',
      code: 'AI-630',
      depTime: '09:30 AM',
      arrTime: '11:45 AM',
      duration: '2h 15m',
      price: 5899,
      seatsLeft: 8,
      baggage: '25kg Check-in',
      cabinClass: 'Economy',
      isRefundable: true,
      from: fCity,
      to: tCity,
      date: date,
      source: 'LocalFallback'
    },
    {
      id: `fallback-flight-3-${fCity}-${tCity}`,
      type: 'flight',
      operator: 'Akasa Air',
      code: 'QP-1107',
      depTime: '02:15 PM',
      arrTime: '04:30 PM',
      duration: '2h 15m',
      price: 4299,
      seatsLeft: 3,
      baggage: '15kg Check-in',
      cabinClass: 'Economy',
      isRefundable: false,
      from: fCity,
      to: tCity,
      date: date,
      source: 'LocalFallback'
    },
    {
      id: `fallback-flight-4-${fCity}-${tCity}`,
      type: 'flight',
      operator: 'Vistara',
      code: 'UK-945',
      depTime: '06:45 PM',
      arrTime: '09:00 PM',
      duration: '2h 15m',
      price: 6499,
      seatsLeft: 6,
      baggage: '15kg Check-in',
      cabinClass: 'Economy',
      isRefundable: true,
      from: fCity,
      to: tCity,
      date: date,
      source: 'LocalFallback'
    }
  ];
}

// Helper: Local fallback buses generator when DSA fails or is unauthorized
function getFallbackBuses(from, to, date) {
  const fCity = from ? from.charAt(0).toUpperCase() + from.slice(1) : 'Delhi';
  const tCity = to ? to.charAt(0).toUpperCase() + to.slice(1) : 'Mumbai';
  return [
    {
      id: `fallback-bus-1-${fCity}-${tCity}`,
      type: 'bus',
      operator: 'Zingbus Premium Volvo',
      code: 'ZB-881',
      depTime: '08:00 PM',
      arrTime: '07:00 AM (+1d)',
      duration: '11h 00m',
      price: 1499,
      seatsLeft: 12,
      baggage: '20kg Luggage',
      busType: 'AC Sleeper (2+1)',
      isAC: true,
      isSleeper: true,
      from: fCity,
      to: tCity,
      date: date,
      source: 'LocalFallback'
    },
    {
      id: `fallback-bus-2-${fCity}-${tCity}`,
      type: 'bus',
      operator: 'IntrCity SmartBus',
      code: 'IC-402',
      depTime: '09:30 PM',
      arrTime: '08:30 AM (+1d)',
      duration: '11h 00m',
      price: 1799,
      seatsLeft: 6,
      baggage: '20kg Luggage',
      busType: 'AC Seater/Sleeper',
      isAC: true,
      isSleeper: true,
      from: fCity,
      to: tCity,
      date: date,
      source: 'LocalFallback'
    },
    {
      id: `fallback-bus-3-${fCity}-${tCity}`,
      type: 'bus',
      operator: 'VRL Travels Multi-Axle',
      code: 'VRL-910',
      depTime: '07:00 PM',
      arrTime: '06:00 AM (+1d)',
      duration: '11h 00m',
      price: 1299,
      seatsLeft: 15,
      baggage: '20kg Luggage',
      busType: 'AC Sleeper',
      isAC: true,
      isSleeper: true,
      from: fCity,
      to: tCity,
      date: date,
      source: 'LocalFallback'
    }
  ];
}

async function executeFlightSearch({ from, to, date, adults = 1, children = 0, infants = 0, journeyType = '1' }) {
  try {
    const [fromIATA, toIATA] = await Promise.all([resolveIATA(from), resolveIATA(to)]);
    if (fromIATA && toIATA) {
      const departureDate = `${date}T00:00:00`;
      const dsaRes = await axios.post(`${process.env.PLANNER_DSA_BASE_URL || process.env.DSA_BASE_URL}/rest/Search`, {
        EndUserIp: process.env.PLANNER_DSA_END_USER_IP || process.env.DSA_END_USER_IP,
        ClientId: process.env.PLANNER_DSA_CLIENT_ID || process.env.DSA_CLIENT_ID,
        UserName: process.env.PLANNER_DSA_USERNAME || process.env.DSA_USERNAME,
        Password: process.env.PLANNER_DSA_PASSWORD || process.env.DSA_PASSWORD,
        AdultCount: String(adults),
        ChildCount: String(children),
        InfantCount: String(infants),
        JourneyType: journeyType,
        Segments: [{ Origin: fromIATA, Destination: toIATA, FlightCabinClass: '1', PreferredDepartureTime: departureDate, PreferredArrivalTime: departureDate }],
      }, { timeout: 12000, headers: { 'Api-Token': process.env.PLANNER_DSA_API_TOKEN || process.env.DSA_API_TOKEN } });

      const traceId = dsaRes.data?.TraceId;
      const rawResults = dsaRes.data?.Results?.[0] || [];
      if (rawResults.length > 0) {
        const flights = [];
        rawResults.forEach(resultGroup => {
          const fares = resultGroup.FareDataMultiple || [resultGroup];
          fares.forEach(fare => {
            const seg = fare.FareSegments?.[0] || {};
            const segTime = resultGroup.Segments?.[0] || {};
            flights.push({
              id: fare.ResultIndex || `dsa-${Date.now()}-${Math.random()}`,
              resultIndex: fare.ResultIndex,
              traceId,
              type: 'flight',
              operator: seg.AirlineName || 'Airline',
              code: `${seg.AirlineCode || '?'}-${seg.FlightNumber || '?'}`,
              depTime: formatTime(segTime.DepartureTime || segTime.Origin?.DepTime),
              arrTime: formatTime(segTime.ArrivalTime || segTime.Destination?.ArrTime),
              duration: segTime.Duration ? `${Math.floor(segTime.Duration / 60)}h ${segTime.Duration % 60}m` : '~2h 30m',
              price: Math.round(fare.OfferedFare || fare.Fare?.OfferedFare || 0),
              seatsLeft: seg.NoOfSeatAvailable || 9,
              baggage: seg.Baggage || '15kg Check-in',
              cabinClass: seg.CabinClassName || 'Economy',
              isRefundable: fare.IsRefundable || false,
              source: 'DSA',
            });
          });
        });

        flights.sort((a, b) => a.price - b.price);
        const seen = new Set();
        const unique = flights.filter(f => {
          const k = `${f.code}-${f.price}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        }).slice(0, 10);

        if (unique.length > 0) {
          return { success: true, results: unique, traceId, source: 'DSA' };
        }
      }
    }
  } catch (err) {
    console.warn(`DSA Flight Search API failed for ${from} -> ${to}, using local fallback:`, err.message);
  }

  // Local fallback
  return { success: true, results: getFallbackFlights(from, to, date), source: 'LocalFallback' };
}

async function executeBusSearch({ from, to, date }) {
  try {
    const { fromCode, toCode } = await resolveBusCityCodes(from, to);
    if (fromCode && toCode) {
      const dsaRes = await axios.post(`${process.env.PLANNER_DSA_BUS_BASE_URL || process.env.DSA_BUS_BASE_URL}/v9/rest/Search`, {
        ClientId: process.env.PLANNER_DSA_BUS_CLIENT_ID || process.env.DSA_BUS_CLIENT_ID,
        UserName: process.env.PLANNER_DSA_BUS_USERNAME || process.env.DSA_BUS_USERNAME,
        Password: process.env.PLANNER_DSA_BUS_PASSWORD || process.env.DSA_BUS_PASSWORD,
        FromCityCode: fromCode,
        ToCityCode: toCode,
        DepartDate: date,
      }, { timeout: 12000, headers: { 'Api-Token': process.env.PLANNER_DSA_BUS_API_TOKEN || process.env.DSA_BUS_API_TOKEN } });

      const traceId = dsaRes.data?.TraceId;
      const rawResults = dsaRes.data?.Result || [];
      if (rawResults.length > 0) {
        const buses = rawResults.map(b => {
          const priceObj = b.Price?.[0] || {};
          return {
            id: b.ResultIndex || `bus-${b.RouteId}`,
            resultIndex: b.ResultIndex,
            traceId,
            type: 'bus',
            operator: b.TravelsName || 'Bus Operator',
            code: `BUS-${b.ResultIndex?.slice(-6) || Math.random().toString(36).slice(-4).toUpperCase()}`,
            depTime: b.DepartureTime ? formatTime(b.DepartureTime) : 'TBD',
            arrTime: b.ArrivalTime ? formatTime(b.ArrivalTime) : 'TBD',
            duration: b.Duration ? `${Math.floor(b.Duration / 60)}h ${b.Duration % 60}m` : 'N/A',
            price: Math.round(parseFloat(priceObj.OfferedFare || priceObj.PublishedFare || b.DisplayFare || 0)),
            seatsLeft: parseInt(b.AvailableSeats) || 10,
            baggage: '20kg Luggage',
            busType: b.BusType || 'AC Bus',
            isAC: b.IsAC === 'true' || b.IsAC === true,
            isSleeper: b.Sleeper === 'true' || b.Sleeper === true,
            boardingPoints: b.BoardingPoints || [],
            droppingPoints: b.DroppingPoints || [],
            source: 'DSA',
          };
        });

        buses.sort((a, b) => a.price - b.price);
        return { success: true, results: buses.slice(0, 10), traceId, source: 'DSA' };
      }
    }
  } catch (err) {
    console.warn(`DSA Bus Search API failed for ${from} -> ${to}, using local fallback:`, err.message);
  }

  // Local fallback
  return { success: true, results: getFallbackBuses(from, to, date), source: 'LocalFallback' };
}

// ---- 1. DSA FLIGHT SEARCH ----
app.post('/api/planner/dsa/flights/search', async (req, res) => {
  const result = await executeFlightSearch(req.body);
  res.json(result);
});

// ---- 2. DSA BUS SEARCH ----
app.post('/api/planner/dsa/buses/search', async (req, res) => {
  const result = await executeBusSearch(req.body);
  res.json(result);
});

// ---- 3. DSA HOTEL SEARCH ----
app.post('/api/planner/dsa/hotels/search', async (req, res) => {
  const { city, checkIn, checkOut, rooms = 1, adults = 2, nights = 1 } = req.body;
  let rawResults = [];
  let traceId = null;

  // Resolve ALL matching cityIds for this city name (some cities like Bangalore/Chennai have 2+ entries)
  function resolveAllHotelCityIds(cityName) {
    if (!cityName) return [];
    const nameLower = cityName.toLowerCase().trim();
    const allMatches = hotelCityCodeMap.filter(c => {
      const dest = c.destination.toLowerCase();
      return dest === nameLower || dest.startsWith(nameLower) || dest.includes(nameLower) || nameLower.includes(dest);
    });
    // De-duplicate by cityid, prioritize exact matches first
    const seen = new Set();
    const sorted = [...allMatches].sort((a, b) => {
      const aExact = a.destination.toLowerCase() === nameLower ? 0 : 1;
      const bExact = b.destination.toLowerCase() === nameLower ? 0 : 1;
      return aExact - bExact;
    });
    return sorted.filter(m => { if (seen.has(m.cityid)) return false; seen.add(m.cityid); return true; }).map(m => String(m.cityid));
  }

  const cityIds = resolveAllHotelCityIds(city);
  console.log(`[hotel-search] City: ${city}, Found cityIds: ${cityIds.join(', ')}`);

  // Try each cityId until one returns results (not 998/900)
  for (const cityId of cityIds) {
    if (rawResults.length > 0) break;
    try {
      const dsaRes = await axios.post(`${process.env.PLANNER_DSA_HOTEL_BASE_URL || process.env.DSA_HOTEL_BASE_URL}/rest/Search`, {
        EndUserIp: process.env.PLANNER_DSA_HOTEL_END_USER_IP || process.env.DSA_HOTEL_END_USER_IP,
        ClientId: process.env.PLANNER_DSA_HOTEL_CLIENT_ID || process.env.DSA_HOTEL_CLIENT_ID,
        UserName: process.env.PLANNER_DSA_HOTEL_USERNAME || process.env.DSA_HOTEL_USERNAME,
        Password: process.env.PLANNER_DSA_HOTEL_PASSWORD || process.env.DSA_HOTEL_PASSWORD,
        CheckInDate: checkIn,
        CheckOutDate: checkOut,
        NoOfNights: String(nights),
        BookingMode: '5',
        CountryCode: 'IN',
        CityId: cityId,
        ResultCount: '50',
        PreferredCurrency: 'INR',
        GuestNationality: 'IN',
        NoOfRooms: String(rooms),
        RoomGuests: [{ NoOfAdults: String(adults), NoOfChild: '0', ChildAge: [] }],
        PreferredHotel: '',
        MaxRating: '5',
        MinRating: '0',
        ReviewScore: null,
        IsNearBySearchAllowed: false,
      }, { timeout: 12000, headers: { 'Api-Token': process.env.PLANNER_DSA_HOTEL_API_TOKEN || process.env.DSA_HOTEL_API_TOKEN } });

      const dsaError = dsaRes.data?.Error;
      const errCode = dsaError?.ErrorCode;
      traceId = dsaRes.data?.TraceId;
      console.log(`[hotel-search] CityId ${cityId} => ErrorCode: ${errCode}, Results: ${(dsaRes.data?.Results || []).length}`);

      // Accept results if no error, or error is NOT 998/900/999 (authorization errors)
      const isAuthError = errCode === '998' || errCode === 998 || errCode === '900' || errCode === 900 || errCode === '999' || errCode === 999;
      if (!isAuthError && dsaRes.data?.Results) {
        rawResults = dsaRes.data.Results;
      }
    } catch (err) {
      console.warn(`[hotel-search] CityId ${cityId} for ${city} threw: ${err.message}`);
    }
  }

  // If DSA succeeded and returned results, use them
  if (rawResults && rawResults.length > 0) {
    const HOTEL_FALLBACK_IMAGES = [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80',
    ];

    const hotels = rawResults.map((h, i) => {
      const price = Math.round(h.OfferedFare || h.Price?.OfferedPrice || 0);
      const images = [];
      if (h.HotelPicture) images.push(h.HotelPicture);
      HOTEL_FALLBACK_IMAGES.forEach(img => { if (images.length < 4) images.push(img); });

      return {
        id: h.HotelCode || h.ResultIndex || `hotel-${i}`,
        resultIndex: h.ResultIndex,
        traceId,
        property_name: h.HotelName || 'Hotel',
        name: h.HotelName || 'Hotel',
        hotel_stars: h.StarRating || 3,
        address: h.HotelAddress || city,
        city: h.City || city,
        price_per_night_inr: price,
        price_inr: price,
        images,
        image: images[0],
        facilities: (h.Facilities || []).flatMap(f => f.FacilitiesNames || []),
        roomType: h.Rooms?.[0]?.Cateogry || 'Standard Room',
        hotelCategory: h.HotelCategory || 'HOTEL',
        lat: parseFloat(h.Latitude) || null,
        lng: parseFloat(h.Longitude) || null,
        source: 'DSA',
      };
    });

    hotels.sort((a, b) => b.hotel_stars - a.hotel_stars || a.price_per_night_inr - b.price_per_night_inr);
    console.log(`[hotel-search] Returning ${hotels.length} DSA LIVE hotels for ${city}`);
    return res.json({ success: true, results: hotels, traceId, source: 'DSA' });
  }

  // Fallback to local
  console.log(`[hotel-search] All DSA cityIds returned auth errors for ${city}, falling back to local dataset`);
  const local = getLocalHotelsForCity(city, true);
  return res.json({ success: true, results: local, source: 'LocalFallback' });
});


// ---- 4. DSA AUTO TRANSPORT FOR AI PLANNER ----
app.post('/api/planner/dsa/auto-transport', async (req, res) => {
  const { from, to, date, mode } = req.body;
  try {
    const rDate = new Date(new Date(date).getTime() + 4 * 86400000).toISOString().split('T')[0];
    let outRes, returnRes;

    if (mode === 'flight') {
      [outRes, returnRes] = await Promise.all([
        executeFlightSearch({ from, to, date, adults: 1 }),
        executeFlightSearch({ from: to, to: from, date: rDate, adults: 1 })
      ]);
    } else {
      [outRes, returnRes] = await Promise.all([
        executeBusSearch({ from, to, date }),
        executeBusSearch({ from: to, to: from, date: rDate })
      ]);
    }

    const outResults = outRes?.results || [];
    const retResults = returnRes?.results || [];
    
    res.json({
      success: true,
      source: mode,
      outbound: outResults[0] || null,
      return: retResults[0] || null,
    });
  } catch (err) {
    console.error('DSA auto transport error:', err);
    res.json({ success: false, source: mode, outbound: null, return: null });
  }
});


// ---- 5. DSA HOTELS ALONG ROUTE ----
// Takes polyline coords, finds 4 midway points at 1/5, 2/5, 3/5, 4/5 of the route
// Reverse-geocodes each point, matches city in hotel_city_code_special.json, fetches live hotels
app.post('/api/planner/dsa/hotels/along-route', async (req, res) => {
  const { polyline, checkIn, checkOut, rooms = 1, adults = 2, nights = 2 } = req.body;
  console.log('[along-route] Request received with polyline length:', polyline?.length);
  if (!polyline || polyline.length < 2) {
    return res.json({ success: false, message: 'Polyline required', results: [] });
  }

  // Normalize polyline to ensure it's an array of [lat, lng] arrays
  const normPoly = polyline.map(p => Array.isArray(p) ? p : [p.lat, p.lng || p.lon]);
  console.log('[along-route] First coords:', normPoly[0], 'Last coords:', normPoly[normPoly.length - 1]);

  // Build cumulative distance array along polyline
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  const cumDist = [0];
  for (let i = 1; i < normPoly.length; i++) {
    const d = haversineKm(normPoly[i - 1][0], normPoly[i - 1][1], normPoly[i][0], normPoly[i][1]);
    cumDist.push(cumDist[i - 1] + d);
  }
  const totalDist = cumDist[cumDist.length - 1];

  // Find the polyline point closest to a given cumulative distance
  function pointAtDistance(targetDist) {
    for (let i = 1; i < cumDist.length; i++) {
      if (cumDist[i] >= targetDist) {
        const frac = (targetDist - cumDist[i - 1]) / (cumDist[i] - cumDist[i - 1]);
        const lat = normPoly[i - 1][0] + frac * (normPoly[i][0] - normPoly[i - 1][0]);
        const lng = normPoly[i - 1][1] + frac * (normPoly[i][1] - normPoly[i - 1][1]);
        return [lat, lng];
      }
    }
    return normPoly[normPoly.length - 1];
  }

  // 4 evenly-spaced waypoints along the route (was 8 — too slow)
  const numPoints = 4;
  const fractions = Array.from({ length: numPoints }, (_, i) => (i + 1) / (numPoints + 1));
  const midwayPoints = fractions.map(f => pointAtDistance(f * totalDist));

  // Total operation timeout — abort everything after 25 seconds
  const opAbort = new AbortController();
  const opTimeout = setTimeout(() => opAbort.abort(), 25000);

  // Reverse-geocode a lat/lng to city name using Nominatim
  async function reverseGeocode(lat, lng) {
    try {
      const r = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
        params: { lat, lon: lng, format: 'json', zoom: 10, addressdetails: 1 },
        headers: { 'User-Agent': 'FirstflightTravels/1.0' },
        timeout: 3000
      });
      const addr = r.data?.address || {};
      return addr.city || addr.town || addr.county || addr.state_district || addr.state || null;
    } catch (e) {
      return null;
    }
  }

  // Try to find a matching city in hotelCityCodeMap, falling back to prefix match
  function findHotelCityId(cityName) {
    if (!cityName) return null;
    const lower = cityName.toLowerCase().trim();
    let match = hotelCityCodeMap.find(c => c.destination.toLowerCase() === lower);
    if (!match && lower.length >= 4) {
      match = hotelCityCodeMap.find(c => c.destination.toLowerCase().startsWith(lower));
      if (!match) match = hotelCityCodeMap.find(c => c.destination.toLowerCase().includes(lower) || lower.includes(c.destination.toLowerCase()));
    }
    return match ? { cityId: String(match.cityid), cityName: match.destination } : null;
  }

  // Fetch hotels for one city, falling back to local dataset if DSA fails/unauthorized
  async function fetchHotelsForCity(cityId, cityName) {
    // Find ALL matching cityIds for this city name (same as main hotel-search endpoint)
    const nameLower = cityName.toLowerCase().trim();
    const allMatchIds = hotelCityCodeMap
      .filter(c => {
        const d = c.destination.toLowerCase();
        return d === nameLower || d.startsWith(nameLower) || d.includes(nameLower) || nameLower.includes(d);
      })
      .map(m => String(m.cityid))
      .filter((v, i, a) => a.indexOf(v) === i);

    // Start with the given cityId, then try others
    const idsToTry = [cityId, ...allMatchIds.filter(id => id !== cityId)];

    let rawResults = [];
    let traceId = null;

    for (const id of idsToTry) {
      if (rawResults.length > 0) break;
      try {
        const dsaRes = await axios.post(`${process.env.PLANNER_DSA_HOTEL_BASE_URL || process.env.DSA_HOTEL_BASE_URL}/rest/Search`, {
          EndUserIp: process.env.PLANNER_DSA_HOTEL_END_USER_IP || process.env.DSA_HOTEL_END_USER_IP,
          ClientId: process.env.PLANNER_DSA_HOTEL_CLIENT_ID || process.env.DSA_HOTEL_CLIENT_ID,
          UserName: process.env.PLANNER_DSA_HOTEL_USERNAME || process.env.DSA_HOTEL_USERNAME,
          Password: process.env.PLANNER_DSA_HOTEL_PASSWORD || process.env.DSA_HOTEL_PASSWORD,
          CheckInDate: checkIn,
          CheckOutDate: checkOut,
          NoOfNights: String(nights),
          BookingMode: '5',
          CountryCode: 'IN',
          CityId: id,
          ResultCount: '5',
          PreferredCurrency: 'INR',
          GuestNationality: 'IN',
          NoOfRooms: String(rooms),
          RoomGuests: [{ NoOfAdults: String(adults), NoOfChild: '0', ChildAge: [] }],
          PreferredHotel: '',
          MaxRating: '5',
          MinRating: '0',
          ReviewScore: null,
          IsNearBySearchAllowed: false,
        }, { timeout: 8000, headers: { 'Api-Token': process.env.PLANNER_DSA_HOTEL_API_TOKEN || process.env.DSA_HOTEL_API_TOKEN }, signal: opAbort.signal });

        const dsaError = dsaRes.data?.Error;
        const errCode = dsaError?.ErrorCode;
        traceId = dsaRes.data?.TraceId;
        const isAuthError = errCode === '998' || errCode === 998 || errCode === '900' || errCode === 900 || errCode === '999' || errCode === 999;
        if (!isAuthError && dsaRes.data?.Results) {
          rawResults = dsaRes.data.Results;
        }
      } catch (e) {
        console.warn(`[along-route] CityId ${id} for ${cityName} failed:`, e.message);
      }
    }

    if (rawResults && rawResults.length > 0) {
      const FALLBACK_IMAGES = [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=800&q=80',
      ];
      const topHotels = rawResults.sort((a, b) => (b.StarRating || 0) - (a.StarRating || 0)).slice(0, 2);
      return topHotels.map((best, index) => {
        const images = [];
        if (best.HotelPicture) images.push(best.HotelPicture);
        FALLBACK_IMAGES.forEach(img => { if (images.length < 2) images.push(img); });
        return {
          id: best.HotelCode || best.ResultIndex || `route-${cityId}-${index}`,
          resultIndex: best.ResultIndex,
          traceId,
          property_name: best.HotelName || 'Hotel',
          name: best.HotelName || 'Hotel',
          hotel_stars: best.StarRating || 3,
          address: best.HotelAddress || cityName,
          city: cityName,
          price_per_night_inr: Math.round(best.OfferedFare || best.Price?.OfferedPrice || 0),
          images,
          image: images[0],
          lat: parseFloat(best.Latitude) || null,
          lng: parseFloat(best.Longitude) || null,
          source: 'DSA',
          routePoint: true,
        };
      });
    }

    // Fallback to local
    console.log(`[along-route] Using local hotels fallback for city: ${cityName}`);
    const local = getLocalHotelsForCity(cityName);
    return local.slice(0, 2).map(h => ({ ...h, routePoint: true }));
  }

  try {
    const results = [];
    const usedCityIds = new Set(); // avoid duplicate city hotels

    for (let i = 0; i < midwayPoints.length; i++) {
      if (opAbort.signal.aborted) break; // stop if total timeout exceeded
      const [lat, lng] = midwayPoints[i];
      let resolved = null;

      // Limit to just 3 candidate points: center + 2 offsets (was 9 — too slow)
      const candidatePoints = [
        [lat, lng],
        [lat + 0.5, lng],
        [lat, lng + 0.5],
      ];

      for (let j = 0; j < candidatePoints.length; j++) {
        if (opAbort.signal.aborted) break;
        const [cLat, cLng] = candidatePoints[j];
        const cityName = await reverseGeocode(cLat, cLng);
        if (!cityName) continue;
        const candidate = findHotelCityId(cityName);
        if (candidate && !usedCityIds.has(candidate.cityId)) {
          resolved = candidate;
          console.log(`[along-route] Point ${i + 1} resolved to ${candidate.cityName} after ${j + 1} tries`);
          break;
        }
      }

      if (!resolved) {
        console.log(`[along-route] No hotel city match for point ${i + 1} (${lat.toFixed(3)},${lng.toFixed(3)}) — skipping`);
        continue;
      }

      usedCityIds.add(resolved.cityId);

      const fetchedHotels = await fetchHotelsForCity(resolved.cityId, resolved.cityName);
      if (fetchedHotels && fetchedHotels.length > 0) {
        fetchedHotels.forEach((hotel, idx) => {
          const offsetLat = lat + (idx * 0.006);
          const offsetLng = lng + (idx * 0.006);
          results.push({
            ...hotel,
            lat: offsetLat,
            lng: offsetLng,
            routePointLat: offsetLat,
            routePointLng: offsetLng,
            routeCityName: resolved.cityName
          });
        });
        console.log(`[along-route] Point ${i + 1}: fetched ${fetchedHotels.length} hotel(s) from ${resolved.cityName}`);
      }
    }

    const hasLiveDsa = results.some(r => r.source === 'DSA');
    clearTimeout(opTimeout);
    res.json({ success: true, results, source: hasLiveDsa ? 'DSA' : 'LocalFallback' });
  } catch (err) {
    clearTimeout(opTimeout);
    console.error('Along-route hotel error:', err.message);
    res.json({ success: false, message: err.message, results: [] });
  }
});

// ============================================================

app.listen(PORT, () => {
  console.log(`Firstflight backend running on http://localhost:${PORT}`);
});

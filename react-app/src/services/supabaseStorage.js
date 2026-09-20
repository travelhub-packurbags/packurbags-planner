import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 15 days in milliseconds
export const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;

// Initialize Supabase if credentials are provided
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

/**
 * Save an individual selected item image with 15-day TTL
 */
export function saveSelectedImage(type, id, imageUrl, metadata = {}) {
  if (!id || !imageUrl) return;
  const key = `packurbag_img_${type}_${id}`;
  const record = {
    type,
    id,
    url: imageUrl,
    metadata,
    savedAt: Date.now(),
    expiresAt: Date.now() + FIFTEEN_DAYS_MS,
  };
  try {
    localStorage.setItem(key, JSON.stringify(record));
  } catch (e) {
    console.warn('Could not save image to local persistent cache:', e);
  }
}

/**
 * Get an individual selected item image (checks 15-day TTL)
 */
export function getSelectedImage(type, id) {
  if (!id) return null;
  const key = `packurbag_img_${type}_${id}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (Date.now() > record.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return record.url;
  } catch (e) {
    return null;
  }
}

/**
 * Save complete itinerary snapshot (places, hotels, dining) with images to:
 * 1. 15-day Local Persistent Cache
 * 2. Supabase (if configured)
 */
export async function saveItinerarySnapshot(itineraryId, data) {
  if (!itineraryId) itineraryId = `itin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const expiresAt = Date.now() + FIFTEEN_DAYS_MS;

  const snapshot = {
    id: itineraryId,
    data,
    savedAt: Date.now(),
    expiresAt,
  };

  // 1. Save in local persistent storage
  try {
    localStorage.setItem(`packurbag_itinerary_${itineraryId}`, JSON.stringify(snapshot));
    // Also save latest active key
    localStorage.setItem('packurbag_latest_itinerary_id', itineraryId);
  } catch (err) {
    console.warn('LocalStorage save error:', err);
  }

  // 2. Also snapshot individual images for fast lookup
  if (data?.selectedPlaces) {
    data.selectedPlaces.forEach(p => {
      if (p.image) saveSelectedImage('place', p.id, p.image, { name: p.name, city: p.city });
    });
  }
  if (data?.selectedHotels) {
    data.selectedHotels.forEach(h => {
      const img = h.image || (h.images && h.images[0]);
      if (img) saveSelectedImage('hotel', h.id, img, { name: h.property_name || h.name });
    });
  }
  if (data?.selectedRestaurants) {
    data.selectedRestaurants.forEach(r => {
      if (r.image) saveSelectedImage('dining', r.id, r.image, { name: r.name });
    });
  }

  // 3. Save to Supabase (if configured)
  if (supabase) {
    try {
      await supabase.from('itineraries').upsert({
        id: itineraryId,
        itinerary_data: data,
        created_at: new Date().toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      });
    } catch (supaErr) {
      console.warn('Supabase itinerary save notice:', supaErr.message);
    }
  }

  return itineraryId;
}

/**
 * Retrieve an itinerary snapshot
 */
export async function getItinerarySnapshot(itineraryId) {
  if (!itineraryId) {
    itineraryId = localStorage.getItem('packurbag_latest_itinerary_id');
  }
  if (!itineraryId) return null;

  // Try local first
  try {
    const raw = localStorage.getItem(`packurbag_itinerary_${itineraryId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() < parsed.expiresAt) {
        return parsed.data;
      } else {
        localStorage.removeItem(`packurbag_itinerary_${itineraryId}`);
      }
    }
  } catch (_) {}

  // Fallback to Supabase if configured
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('itineraries')
        .select('*')
        .eq('id', itineraryId)
        .single();
      if (!error && data?.itinerary_data) {
        return data.itinerary_data;
      }
    } catch (_) {}
  }

  return null;
}

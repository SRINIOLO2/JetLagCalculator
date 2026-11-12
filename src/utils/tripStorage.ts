import { FlightDetails, UserPreferences } from './jetLagAlgorithm';

export interface SavedTrip {
  id: string;
  name: string;
  updatedAt: string;
  flight: FlightDetails;
  prefs: UserPreferences;
}

const STORAGE_KEY = 'chrono_healer_saved_trips_v2';
const ACTIVE_TRIP_KEY = 'chrono_healer_active_trip_id_v2';

function getStorage(): Storage | null {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
    return globalThis.localStorage;
  }
  return null;
}

export function loadSavedTrips(): SavedTrip[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveTrip(trip: SavedTrip): SavedTrip[] {
  const storage = getStorage();
  const current = loadSavedTrips();
  const idx = current.findIndex(t => t.id === trip.id);
  let next: SavedTrip[];
  if (idx >= 0) {
    next = [...current];
    next[idx] = { ...trip, updatedAt: new Date().toISOString() };
  } else {
    next = [{ ...trip, updatedAt: new Date().toISOString() }, ...current];
  }
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
      storage.setItem(ACTIVE_TRIP_KEY, trip.id);
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function deleteTrip(id: string): SavedTrip[] {
  const storage = getStorage();
  const next = loadSavedTrips().filter(t => t.id !== id);
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore
    }
  }
  return next;
}

export function loadActiveTripId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.getItem(ACTIVE_TRIP_KEY);
  } catch {
    return null;
  }
}

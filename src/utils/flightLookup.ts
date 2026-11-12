import { addDays, format, parseISO } from 'date-fns';
import { Airport, findAirportByIata } from '../data/airports';

export interface FlightRoutePreset {
  flightNumber: string;
  airline: string;
  originIata: string;
  destinationIata: string;
  departureTimeLocal: string; // "HH:mm"
  arrivalTimeLocal: string;   // "HH:mm"
  dayOffsetArrival: number;   // 0 = same calendar date, 1 = +1 day, 2 = +2 days
}

export interface FlightLookupResult {
  flightNumber: string;
  airline: string;
  origin: Airport;
  destination: Airport;
  departureLocal: string; // "YYYY-MM-DDTHH:mm"
  arrivalLocal: string;   // "YYYY-MM-DDTHH:mm"
  source: 'online' | 'offline-preset';
}

export const FLIGHT_ROUTE_PRESETS: FlightRoutePreset[] = [
  { flightNumber: 'BA178', airline: 'British Airways', originIata: 'JFK', destinationIata: 'LHR', departureTimeLocal: '08:00', arrivalTimeLocal: '20:00', dayOffsetArrival: 0 },
  { flightNumber: 'BA112', airline: 'British Airways', originIata: 'JFK', destinationIata: 'LHR', departureTimeLocal: '18:30', arrivalTimeLocal: '06:30', dayOffsetArrival: 1 },
  { flightNumber: 'BA117', airline: 'British Airways', originIata: 'LHR', destinationIata: 'JFK', departureTimeLocal: '08:25', arrivalTimeLocal: '11:10', dayOffsetArrival: 0 },
  { flightNumber: 'UA928', airline: 'United Airlines', originIata: 'ORD', destinationIata: 'LHR', departureTimeLocal: '17:55', arrivalTimeLocal: '07:40', dayOffsetArrival: 1 },
  { flightNumber: 'UA837', airline: 'United Airlines', originIata: 'SFO', destinationIata: 'NRT', departureTimeLocal: '11:35', arrivalTimeLocal: '15:00', dayOffsetArrival: 1 },
  { flightNumber: 'JL5', airline: 'Japan Airlines', originIata: 'JFK', destinationIata: 'HND', departureTimeLocal: '13:20', arrivalTimeLocal: '16:35', dayOffsetArrival: 1 },
  { flightNumber: 'JL6', airline: 'Japan Airlines', originIata: 'HND', destinationIata: 'JFK', departureTimeLocal: '11:05', arrivalTimeLocal: '11:00', dayOffsetArrival: 0 },
  { flightNumber: 'NH105', airline: 'All Nippon Airways', originIata: 'LAX', destinationIata: 'HND', departureTimeLocal: '00:50', arrivalTimeLocal: '05:00', dayOffsetArrival: 1 },
  { flightNumber: 'QF11', airline: 'Qantas', originIata: 'SYD', destinationIata: 'LAX', departureTimeLocal: '17:45', arrivalTimeLocal: '14:30', dayOffsetArrival: 0 },
  { flightNumber: 'QF12', airline: 'Qantas', originIata: 'LAX', destinationIata: 'SYD', departureTimeLocal: '22:40', arrivalTimeLocal: '07:45', dayOffsetArrival: 2 },
  { flightNumber: 'SQ23', airline: 'Singapore Airlines', originIata: 'JFK', destinationIata: 'SIN', departureTimeLocal: '22:30', arrivalTimeLocal: '05:20', dayOffsetArrival: 2 },
  { flightNumber: 'SQ24', airline: 'Singapore Airlines', originIata: 'SIN', destinationIata: 'JFK', departureTimeLocal: '12:10', arrivalTimeLocal: '17:50', dayOffsetArrival: 0 },
  { flightNumber: 'AF007', airline: 'Air France', originIata: 'JFK', destinationIata: 'CDG', departureTimeLocal: '19:30', arrivalTimeLocal: '08:50', dayOffsetArrival: 1 },
  { flightNumber: 'AF7', airline: 'Air France', originIata: 'JFK', destinationIata: 'CDG', departureTimeLocal: '19:30', arrivalTimeLocal: '08:50', dayOffsetArrival: 1 },
  { flightNumber: 'DL106', airline: 'Delta Air Lines', originIata: 'JFK', destinationIata: 'FRA', departureTimeLocal: '19:25', arrivalTimeLocal: '09:20', dayOffsetArrival: 1 },
  { flightNumber: 'AA100', airline: 'American Airlines', originIata: 'JFK', destinationIata: 'LHR', departureTimeLocal: '18:15', arrivalTimeLocal: '06:20', dayOffsetArrival: 1 },
  { flightNumber: 'EK202', airline: 'Emirates', originIata: 'JFK', destinationIata: 'DXB', departureTimeLocal: '23:00', arrivalTimeLocal: '19:45', dayOffsetArrival: 1 },
  { flightNumber: 'LH401', airline: 'Lufthansa', originIata: 'JFK', destinationIata: 'FRA', departureTimeLocal: '15:55', arrivalTimeLocal: '05:35', dayOffsetArrival: 1 },
];

export function normalizeFlightNumber(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export async function lookupFlightNumber(
  rawFlightNumber: string,
  departureDateStr: string // "YYYY-MM-DD"
): Promise<FlightLookupResult | null> {
  const code = normalizeFlightNumber(rawFlightNumber);
  if (!code) return null;

  const baseDate = departureDateStr.slice(0, 10) || format(new Date(), 'yyyy-MM-dd');

  // 1. Optional online lookup if browser is online and public route endpoint is reachable
  if (typeof navigator !== 'undefined' && navigator.onLine && typeof fetch === 'function') {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(code)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const route = data?.response?.flightroute;
        const origIata = route?.origin?.iata_code;
        const destIata = route?.destination?.iata_code;
        if (origIata && destIata) {
          const origin = findAirportByIata(origIata);
          const destination = findAirportByIata(destIata);
          if (origin && destination) {
            const preset = FLIGHT_ROUTE_PRESETS.find(p => p.flightNumber === code);
            const depTime = preset?.departureTimeLocal ?? '18:00';
            const arrTime = preset?.arrivalTimeLocal ?? '08:00';
            const dayOffset = preset?.dayOffsetArrival ?? 1;
            const arrDate = format(addDays(parseISO(`${baseDate}T00:00:00`), dayOffset), 'yyyy-MM-dd');
            return {
              flightNumber: code,
              airline: route?.airline?.name || preset?.airline || 'Scheduled Airline',
              origin,
              destination,
              departureLocal: `${baseDate}T${depTime}`,
              arrivalLocal: `${arrDate}T${arrTime}`,
              source: 'online',
            };
          }
        }
      }
    } catch {
      // Fall back to offline preset silently when offline or blocked
    }
  }

  // 2. Offline Preset Match
  const preset = FLIGHT_ROUTE_PRESETS.find(p => p.flightNumber === code);
  if (!preset) return null;

  const origin = findAirportByIata(preset.originIata);
  const destination = findAirportByIata(preset.destinationIata);
  if (!origin || !destination) return null;

  const arrDate = format(
    addDays(parseISO(`${baseDate}T00:00:00`), preset.dayOffsetArrival),
    'yyyy-MM-dd'
  );

  return {
    flightNumber: preset.flightNumber,
    airline: preset.airline,
    origin,
    destination,
    departureLocal: `${baseDate}T${preset.departureTimeLocal}`,
    arrivalLocal: `${arrDate}T${preset.arrivalTimeLocal}`,
    source: 'offline-preset',
  };
}

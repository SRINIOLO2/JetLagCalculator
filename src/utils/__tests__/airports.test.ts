import { describe, it, expect } from 'vitest';
import { searchLocations, resolveTimezone, formatAirportLabel } from '../../data/airports';
import { lookupFlightNumber, normalizeFlightNumber, FLIGHT_ROUTE_PRESETS } from '../flightLookup';

describe('Airport & Timezone Offline Database', () => {
  it('finds airports by IATA code case-insensitively', () => {
    const res = searchLocations('lhr');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].iata).toBe('LHR');
    expect(res[0].tz).toBe('Europe/London');
  });

  it('finds airports by city name', () => {
    const res = searchLocations('Tokyo');
    expect(res.some(a => a.iata === 'HND' || a.iata === 'NRT')).toBe(true);
  });

  it('resolves formatted airport labels and raw IANA strings', () => {
    expect(resolveTimezone('JFK - New York (America/New_York)')).toBe('America/New_York');
    expect(resolveTimezone('LHR')).toBe('Europe/London');
    expect(resolveTimezone('Asia/Tokyo')).toBe('Asia/Tokyo');
    expect(resolveTimezone('(UTC-05:00) America/New_York')).toBe('America/New_York');
  });

  it('formats airport label consistently', () => {
    const lhr = searchLocations('LHR')[0];
    expect(formatAirportLabel(lhr)).toContain('LHR');
    expect(formatAirportLabel(lhr)).toContain('London');
  });

  it('normalizes flight numbers and resolves offline route presets when offline', async () => {
    expect(normalizeFlightNumber('ba 178')).toBe('BA178');
    expect(normalizeFlightNumber('ua-928')).toBe('UA928');
    expect(FLIGHT_ROUTE_PRESETS.length).toBeGreaterThanOrEqual(10);

    const route = await lookupFlightNumber('BA 178', '2026-11-15');
    expect(route).not.toBeNull();
    expect(route?.origin.iata).toBe('JFK');
    expect(route?.destination.iata).toBe('LHR');
    expect(route?.departureLocal).toBe('2026-11-15T08:00');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { generateICS } from '../icsGenerator';
import { loadSavedTrips, saveTrip, deleteTrip, SavedTrip } from '../tripStorage';
import { JetLagEvent } from '../jetLagAlgorithm';

describe('ICS Generator & Offline Trip Storage', () => {
  const sampleEvents: JetLagEvent[] = [
    {
      id: 'mel-1',
      type: 'MELATONIN',
      startTime: new Date('2026-11-15T22:15:00Z'),
      endTime: new Date('2026-11-15T22:45:00Z'),
      title: 'Take Low-Dose Melatonin',
      description: 'Take 0.5mg-3mg 45m before target sleep.',
      explanation: 'Signals darkness to master clock.',
      dayOffset: 0,
      displayTimezone: 'Europe/London',
    },
    {
      id: 'nap-1',
      type: 'NAP',
      startTime: new Date('2026-11-16T13:00:00Z'),
      endTime: new Date('2026-11-16T13:30:00Z'),
      title: 'Strategic Power Nap (30 mins)',
      description: 'Short recovery nap.',
      explanation: 'Clears homeostatic sleep pressure.',
      dayOffset: 1,
      displayTimezone: 'Europe/London',
    },
    {
      id: 'meal-1',
      type: 'MEAL',
      startTime: new Date('2026-11-16T08:00:00Z'),
      endTime: new Date('2026-11-16T09:00:00Z'),
      title: 'Anchor Meal (High-Protein Breakfast)',
      description: 'Eat protein-rich breakfast.',
      explanation: 'Entrains peripheral liver clock.',
      dayOffset: 1,
      displayTimezone: 'Europe/London',
    },
  ];

  it('generates valid RFC 5545 ICS with emojis, explanations, and VALARM triggers', () => {
    const ics = generateICS(sampleEvents, 'JFK to LHR');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('X-WR-CALNAME:Chrono Healer - JFK to LHR');
    expect(ics).toContain('SUMMARY:💊 Take Low-Dose Melatonin');
    expect(ics).toContain('SUMMARY:🛋️ Strategic Power Nap (30 mins)');
    expect(ics).toContain('SUMMARY:🍽️ Anchor Meal (High-Protein Breakfast)');
    expect(ics).toContain('Signals darkness to master clock.');
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT15M');
    expect(ics).toContain('END:VCALENDAR');
  });

  describe('Offline Trip Storage', () => {
    const store = new Map<string, string>();
    beforeEach(() => {
      store.clear();
      // Polyfill minimal localStorage for node test environment
      (globalThis as Record<string, unknown>).localStorage = {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      };
    });

    it('saves, loads, updates, and deletes trips cleanly', () => {
      expect(loadSavedTrips()).toEqual([]);

      const trip: SavedTrip = {
        id: 'trip-1',
        name: 'JFK → LHR (BA112)',
        updatedAt: '2026-11-11T18:00:00.000Z',
        flight: {
          flightNumber: 'BA112',
          originCode: 'JFK',
          destinationCode: 'LHR',
          departureTimeLocal: '2026-11-15T18:30',
          arrivalTimeLocal: '2026-11-16T06:30',
          originTimezone: 'America/New_York',
          destinationTimezone: 'Europe/London',
        },
        prefs: {
          normalBedtime: '23:00',
          normalWakeTime: '07:00',
          strategy: 'PRE_FLIGHT',
          speed: 'AVERAGE',
          useMelatonin: true,
          useCaffeine: true,
        },
      };

      const afterSave = saveTrip(trip);
      expect(afterSave).toHaveLength(1);
      expect(loadSavedTrips()[0].name).toBe('JFK → LHR (BA112)');

      // Update existing trip
      const updated = saveTrip({ ...trip, name: 'JFK → LHR (Delayed)' });
      expect(updated).toHaveLength(1);
      expect(updated[0].name).toBe('JFK → LHR (Delayed)');

      // Delete trip
      const afterDelete = deleteTrip('trip-1');
      expect(afterDelete).toHaveLength(0);
    });
  });
});

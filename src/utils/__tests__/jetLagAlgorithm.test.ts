import { describe, it, expect } from 'vitest';
import {
  generateJetLagSchedule,
  applyFlightDelay,
  calculateShortestPhaseShift,
  FlightDetails,
  UserPreferences,
} from '../jetLagAlgorithm';

describe('Multi-Pillar Circadian Algorithm & Delay Engine', () => {
  const baseFlight: FlightDetails = {
    flightNumber: 'BA112',
    originCode: 'JFK',
    destinationCode: 'LHR',
    departureTimeLocal: '2026-11-15T18:00',
    arrivalTimeLocal: '2026-11-16T06:00',
    originTimezone: 'America/New_York',
    destinationTimezone: 'Europe/London',
  };

  const basePrefs: UserPreferences = {
    normalBedtime: '23:00',
    normalWakeTime: '07:00',
    strategy: 'PRE_FLIGHT',
    speed: 'AVERAGE',
    useMelatonin: true,
    useCaffeine: true,
  };

  it('1. parses departure and arrival wall-clock times in their respective IANA timezones', () => {
    const events = generateJetLagSchedule(baseFlight, basePrefs);
    const flightEvent = events.find(e => e.type === 'FLIGHT');
    expect(flightEvent).toBeDefined();
    // 2026-11-15T18:00 in America/New_York (EST, UTC-5) is 23:00 UTC
    expect(flightEvent?.startTime.toISOString()).toBe('2026-11-15T23:00:00.000Z');
    // 2026-11-16T06:00 in Europe/London (GMT, UTC+0) is 06:00 UTC
    expect(flightEvent?.endTime.toISOString()).toBe('2026-11-16T06:00:00.000Z');
  });

  it('2. calculates shortest circadian path across the International Date Line', () => {
    // Los Angeles (UTC-8 in Nov) to Tokyo (UTC+9): raw diff is +17h, shortest path is -7h WEST
    const shift = calculateShortestPhaseShift(
      'America/Los_Angeles',
      'Asia/Tokyo',
      new Date('2026-11-15T12:00:00Z')
    );
    expect(shift.shiftHours).toBe(-7);
    expect(shift.direction).toBe('WEST');

    // New York (UTC-5) to London (UTC+0): +5h EAST
    const nyToLon = calculateShortestPhaseShift(
      'America/New_York',
      'Europe/London',
      new Date('2026-11-15T12:00:00Z')
    );
    expect(nyToLon.shiftHours).toBe(5);
    expect(nyToLon.direction).toBe('EAST');
  });

  it('3. respects adaptation speed (SLOW vs AVERAGE vs FAST)', () => {
    const slowEvents = generateJetLagSchedule(baseFlight, { ...basePrefs, speed: 'SLOW', strategy: 'ARRIVAL_ONLY' });
    const fastEvents = generateJetLagSchedule(baseFlight, { ...basePrefs, speed: 'FAST', strategy: 'ARRIVAL_ONLY' });

    const maxDaySlow = Math.max(...slowEvents.map(e => e.dayOffset));
    const maxDayFast = Math.max(...fastEvents.map(e => e.dayOffset));
    expect(maxDaySlow).toBeGreaterThan(maxDayFast);
  });

  it('4. respects PRE_FLIGHT vs ARRIVAL_ONLY adjustment strategy', () => {
    const preFlightEvents = generateJetLagSchedule(baseFlight, { ...basePrefs, strategy: 'PRE_FLIGHT' });
    const arrivalOnlyEvents = generateJetLagSchedule(baseFlight, { ...basePrefs, strategy: 'ARRIVAL_ONLY' });

    expect(preFlightEvents.some(e => e.dayOffset < 0)).toBe(true);
    expect(arrivalOnlyEvents.some(e => e.dayOffset < 0)).toBe(false);
  });

  it('5. respects Melatonin and Caffeine opt-in/opt-out toggles and attaches explanations', () => {
    const withBoth = generateJetLagSchedule(baseFlight, {
      ...basePrefs,
      useMelatonin: true,
      useCaffeine: true,
    });
    expect(withBoth.some(e => e.type === 'MELATONIN')).toBe(true);
    expect(withBoth.some(e => e.type === 'CAFFEINE')).toBe(true);
    expect(withBoth.every(e => e.explanation && e.explanation.length > 10)).toBe(true);

    const withoutBoth = generateJetLagSchedule(baseFlight, {
      ...basePrefs,
      useMelatonin: false,
      useCaffeine: false,
    });
    expect(withoutBoth.some(e => e.type === 'MELATONIN')).toBe(false);
    expect(withoutBoth.some(e => e.type === 'CAFFEINE')).toBe(false);
  });

  it('6. generates Meal windows and inserts a strategic Nap when flight truncates main sleep', () => {
    const events = generateJetLagSchedule(baseFlight, basePrefs);
    expect(events.some(e => e.type === 'MEAL')).toBe(true);
    // Overnight red-eye flight from 18:00 EST (23:00 UTC) to 06:00 GMT truncates sleep window -> triggers NAP
    expect(events.some(e => e.type === 'NAP')).toBe(true);
  });

  it('7. shifts flight departure and arrival accurately when applyFlightDelay is called', () => {
    const delayed = applyFlightDelay(baseFlight, 150); // +2.5 hours
    expect(delayed.departureTimeLocal).toBe('2026-11-15T20:30');
    expect(delayed.arrivalTimeLocal).toBe('2026-11-16T08:30');

    // Reroute to Paris (Europe/Paris, UTC+1 in Nov)
    const rerouted = applyFlightDelay(baseFlight, 60, 'Europe/Paris', 'CDG');
    expect(rerouted.destinationTimezone).toBe('Europe/Paris');
    expect(rerouted.destinationCode).toBe('CDG');
    // Original arrival 06:00 GMT + 60m delay = 07:00 GMT = 08:00 CET (Europe/Paris)
    expect(rerouted.arrivalTimeLocal).toBe('2026-11-16T08:00');
  });

  it('8. keeps Sleep and Light Control windows non-overlapping and staggers Cues without overlap', () => {
    const westFlight: FlightDetails = {
      flightNumber: 'BA117',
      originCode: 'LHR',
      destinationCode: 'JFK',
      departureTimeLocal: '2026-11-15T08:25',
      arrivalTimeLocal: '2026-11-15T11:10',
      originTimezone: 'Europe/London',
      destinationTimezone: 'America/New_York',
    };

    const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
      aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();

    for (const flightCase of [baseFlight, westFlight]) {
      const events = generateJetLagSchedule(flightCase, basePrefs);
      const dayOffsets = Array.from(new Set(events.map(e => e.dayOffset)));

      for (const d of dayOffsets) {
        const dayEvents = events.filter(e => e.dayOffset === d);
        const sleepOrNap = dayEvents.filter(e => e.type === 'SLEEP' || e.type === 'NAP');
        const lightCues = dayEvents.filter(e => e.type === 'SEEK_LIGHT' || e.type === 'AVOID_LIGHT');
        const fuelCues = dayEvents.filter(
          e => e.type === 'MELATONIN' || e.type === 'MEAL' || e.type === 'CAFFEINE'
        );

        // Sleep/Nap blocks must never overlap Light control or each other
        for (const s of sleepOrNap) {
          for (const l of lightCues) {
            expect(overlaps(s.startTime, s.endTime, l.startTime, l.endTime)).toBe(false);
          }
        }

        // Fuel/Supplement cues on the same day must be staggered cleanly
        for (let i = 0; i < fuelCues.length; i++) {
          for (let j = i + 1; j < fuelCues.length; j++) {
            expect(
              overlaps(
                fuelCues[i].startTime,
                fuelCues[i].endTime,
                fuelCues[j].startTime,
                fuelCues[j].endTime
              )
            ).toBe(false);
          }
        }
      }
    }
  });
});

import {
  addDays,
  addMinutes,
  differenceInMinutes,
  isAfter,
  isBefore,
  format,
  parseISO,
} from 'date-fns';
import { formatInTimeZone, fromZonedTime, getTimezoneOffset } from 'date-fns-tz';

export type EventType =
  | 'SLEEP'
  | 'NAP'
  | 'SEEK_LIGHT'
  | 'AVOID_LIGHT'
  | 'CAFFEINE'
  | 'MELATONIN'
  | 'MEAL'
  | 'FLIGHT';

export type AdaptationSpeed = 'SLOW' | 'AVERAGE' | 'FAST';
export type AdjustmentStrategy = 'PRE_FLIGHT' | 'ARRIVAL_ONLY';

export interface JetLagEvent {
  id: string;
  type: EventType;
  startTime: Date;
  endTime: Date;
  title: string;
  description: string;
  explanation: string;
  dayOffset: number;
  displayTimezone: string;
}

export interface FlightDetails {
  flightNumber?: string;
  originCode?: string;
  destinationCode?: string;
  departureTimeLocal: string; // "YYYY-MM-DDTHH:mm" in originTimezone
  arrivalTimeLocal: string;   // "YYYY-MM-DDTHH:mm" in destinationTimezone
  originTimezone: string;
  destinationTimezone: string;
}

export interface UserPreferences {
  normalBedtime: string;  // "HH:mm" (24h)
  normalWakeTime: string; // "HH:mm" (24h)
  strategy: AdjustmentStrategy;
  speed: AdaptationSpeed;
  useMelatonin: boolean;
  useCaffeine: boolean;
}

const SPEED_RATES: Record<AdaptationSpeed, number> = {
  SLOW: 1.0,
  AVERAGE: 1.5,
  FAST: 2.0,
};

function getOffsetHours(date: Date, tz: string): number {
  return getTimezoneOffset(tz, date) / (1000 * 60 * 60);
}

/**
 * Calculates the shortest circadian phase shift between two timezones (-12h to +12h).
 * Positive = Eastward (phase advance: sleep/wake earlier).
 * Negative = Westward (phase delay: sleep/wake later).
 */
export function calculateShortestPhaseShift(
  originTz: string,
  destTz: string,
  refDate: Date
): { shiftHours: number; direction: 'EAST' | 'WEST' | 'NONE' } {
  const originOffset = getOffsetHours(refDate, originTz);
  const destOffset = getOffsetHours(refDate, destTz);
  let diff = destOffset - originOffset;

  // Normalize across the International Date Line into [-12, +12]
  while (diff > 12) diff -= 24;
  while (diff < -12) diff += 24;

  if (Math.abs(diff) < 0.25) {
    return { shiftHours: 0, direction: 'NONE' };
  }
  return {
    shiftHours: diff,
    direction: diff > 0 ? 'EAST' : 'WEST',
  };
}

/**
 * Shifts flight departure and arrival by `delayMinutes` and optionally re-routes destination.
 */
export function applyFlightDelay(
  flight: FlightDetails,
  delayMinutes: number,
  newDestinationTz?: string,
  newDestinationCode?: string
): FlightDetails {
  const depUtc = fromZonedTime(flight.departureTimeLocal, flight.originTimezone);
  const arrUtc = fromZonedTime(flight.arrivalTimeLocal, flight.destinationTimezone);

  const shiftedDepUtc = addMinutes(depUtc, delayMinutes);
  const shiftedArrUtc = addMinutes(arrUtc, delayMinutes);

  const targetDestTz = newDestinationTz || flight.destinationTimezone;

  return {
    ...flight,
    destinationTimezone: targetDestTz,
    destinationCode: newDestinationCode || flight.destinationCode,
    departureTimeLocal: formatInTimeZone(shiftedDepUtc, flight.originTimezone, "yyyy-MM-dd'T'HH:mm"),
    arrivalTimeLocal: formatInTimeZone(shiftedArrUtc, targetDestTz, "yyyy-MM-dd'T'HH:mm"),
  };
}

export function generateJetLagSchedule(
  flight: FlightDetails,
  prefs: UserPreferences
): JetLagEvent[] {
  const depUtc = fromZonedTime(flight.departureTimeLocal, flight.originTimezone);
  const arrUtc = fromZonedTime(flight.arrivalTimeLocal, flight.destinationTimezone);

  const { shiftHours, direction } = calculateShortestPhaseShift(
    flight.originTimezone,
    flight.destinationTimezone,
    depUtc
  );

  const absShift = Math.abs(shiftHours);
  const isEastward = direction === 'EAST';
  const ratePerDay = SPEED_RATES[prefs.speed] ?? 1.5;

  const totalAdaptationDays = Math.max(1, Math.ceil(absShift / ratePerDay));
  const preFlightDays =
    prefs.strategy === 'PRE_FLIGHT' ? Math.min(3, Math.max(1, Math.floor(totalAdaptationDays / 2))) : 0;
  const postFlightDays = Math.max(1, totalAdaptationDays - preFlightDays);

  const events: JetLagEvent[] = [];

  // Boarding & Landing active buffers (45 mins before/after)
  const boardingStart = addMinutes(depUtc, -45);
  const boardingEnd = addMinutes(depUtc, 45);
  const landingStart = addMinutes(arrUtc, -45);
  const landingEnd = addMinutes(arrUtc, 45);

  const originLabel = flight.originCode || flight.originTimezone;
  const destLabel = flight.destinationCode || flight.destinationTimezone;
  const flightTag = flight.flightNumber ? ` (${flight.flightNumber})` : '';

  events.push({
    id: 'flight-main',
    type: 'FLIGHT',
    startTime: depUtc,
    endTime: arrUtc,
    title: `Flight: ${originLabel} → ${destLabel}${flightTag}`,
    description: `In-flight transit from ${originLabel} to ${destLabel}. Set your watch to ${destLabel} time upon boarding and stay hydrated.`,
    explanation:
      'Cabin air has low humidity (<20%), which accelerates fatigue. Setting your mental clock to destination time at boarding reinforces behavioral entrainment.',
    dayOffset: 0,
    displayTimezone: flight.destinationTimezone,
  });

  const depDatePrefix = flight.departureTimeLocal.slice(0, 10); // "YYYY-MM-DD"
  const [bedH, bedM] = prefs.normalBedtime.split(':').map(Number);
  const [wakeH, wakeM] = prefs.normalWakeTime.split(':').map(Number);

  // Compute baseline sleep duration in minutes
  let baseSleepMinutes = (wakeH * 60 + wakeM) - (bedH * 60 + bedM);
  if (baseSleepMinutes <= 0) baseSleepMinutes += 24 * 60;

  const totalSteps = preFlightDays + postFlightDays + 1;

  for (let dayOffset = -preFlightDays; dayOffset <= postFlightDays; dayOffset++) {
    const stepIndex = dayOffset + preFlightDays + 1; // 1 .. totalSteps
    const fraction = Math.min(1, stepIndex / totalSteps);

    // Eastward advances clock (earlier sleep in origin wall-clock = negative minutes shift)
    // Westward delays clock (later sleep in origin wall-clock = positive minutes shift)
    const cumulativeShiftMinutes = Math.round(
      (isEastward ? -1 : 1) * absShift * 60 * fraction
    );

    const dayCalendarDate = format(
      addDays(parseISO(`${depDatePrefix}T00:00:00`), dayOffset),
      'yyyy-MM-dd'
    );

    const baseBedLocalStr = `${dayCalendarDate}T${String(bedH).padStart(2, '0')}:${String(bedM).padStart(2, '0')}:00`;
    let baseBedUtc = fromZonedTime(baseBedLocalStr, flight.originTimezone);

    // If normal bedtime is after midnight (e.g. 01:00), it belongs to the night following dayCalendarDate
    if (bedH < 12) {
      baseBedUtc = addMinutes(baseBedUtc, 24 * 60);
    }

    let sleepStart = addMinutes(baseBedUtc, cumulativeShiftMinutes);
    let sleepEnd = addMinutes(sleepStart, baseSleepMinutes);

    const displayTz = dayOffset < 0 ? flight.originTimezone : flight.destinationTimezone;
    const dayLabel =
      dayOffset === 0
        ? 'Flight Day'
        : dayOffset < 0
          ? `Day ${dayOffset} (Pre-Flight)`
          : `Day +${dayOffset} (Post-Arrival)`;

    let sleepTruncatedByFlight = false;

    // Resolve conflicts with active boarding window
    if (isBefore(sleepStart, boardingEnd) && isAfter(sleepEnd, boardingStart)) {
      sleepTruncatedByFlight = true;
      if (isBefore(sleepStart, boardingStart) && differenceInMinutes(boardingStart, sleepStart) >= 180) {
        sleepEnd = boardingStart;
      } else {
        sleepStart = boardingEnd;
      }
    }

    // Resolve conflicts with active landing window
    if (isBefore(sleepStart, landingEnd) && isAfter(sleepEnd, landingStart)) {
      sleepTruncatedByFlight = true;
      if (isAfter(sleepEnd, landingEnd) && differenceInMinutes(sleepEnd, landingEnd) >= 180) {
        sleepStart = landingEnd;
      } else {
        sleepEnd = landingStart;
      }
    }

    const actualSleepMins = differenceInMinutes(sleepEnd, sleepStart);

    if (actualSleepMins >= 120) {
      const hoursFormatted = (actualSleepMins / 60).toFixed(1).replace(/\.0$/, '');
      events.push({
        id: `sleep-${dayOffset}`,
        type: 'SLEEP',
        startTime: sleepStart,
        endTime: sleepEnd,
        title: `Target Sleep (${hoursFormatted}h) — ${dayLabel}`,
        description: `Sleep window shifted for ${isEastward ? 'eastward advance' : 'westward delay'}. Use an eye mask and earplugs if in transit.`,
        explanation:
          'Gradually anchoring your main sleep episode to the target timezone prevents circadian misalignment and preserves deep slow-wave and REM architecture.',
        dayOffset,
        displayTimezone: displayTz,
      });

      // Light exposure windows based on Phase Response Curve (PRC)
      if (isEastward) {
        // Eastward (Phase Advance): Avoid light before core body temp minimum (2h before wake), Seek bright light upon wake (2.5h)
        events.push({
          id: `avoid-light-${dayOffset}`,
          type: 'AVOID_LIGHT',
          startTime: addMinutes(sleepEnd, -150),
          endTime: sleepEnd,
          title: 'Avoid Bright Light (Biological Late Night)',
          description: 'Keep environment dark or wear blue-blocking glasses / eye mask before wake time.',
          explanation:
            'Before your core body temperature minimum (Tmin), bright light delays your body clock—the opposite of what you need when flying east.',
          dayOffset,
          displayTimezone: displayTz,
        });

        events.push({
          id: `seek-light-${dayOffset}`,
          type: 'SEEK_LIGHT',
          startTime: sleepEnd,
          endTime: addMinutes(sleepEnd, 150),
          title: 'Seek Bright Morning Light',
          description: 'Get direct outdoor sunlight or high-lux bright light immediately after waking.',
          explanation:
            'Bright light right after your core body temperature minimum suppresses melatonin and advances your master clock toward your eastern destination.',
          dayOffset,
          displayTimezone: displayTz,
        });
      } else {
        // Westward (Phase Delay): Seek bright light in evening before sleep, Avoid bright light upon early morning wake
        events.push({
          id: `seek-light-${dayOffset}`,
          type: 'SEEK_LIGHT',
          startTime: addMinutes(sleepStart, -180),
          endTime: addMinutes(sleepStart, -30),
          title: 'Seek Evening Bright Light',
          description: 'Expose yourself to bright natural or indoor light in the hours leading up to bedtime.',
          explanation:
            'Evening light exposure before sleep onset delays your circadian phase, helping you stay awake later to match a western timezone.',
          dayOffset,
          displayTimezone: displayTz,
        });

        events.push({
          id: `avoid-light-${dayOffset}`,
          type: 'AVOID_LIGHT',
          startTime: sleepEnd,
          endTime: addMinutes(sleepEnd, 120),
          title: 'Avoid Early Morning Glare',
          description: 'Wear sunglasses outdoors for the first 2 hours after waking.',
          explanation:
            'Avoiding intense early-morning light prevents premature phase advancement while your clock is delaying westward.',
          dayOffset,
          displayTimezone: displayTz,
        });
      }

      // Melatonin guidance (if enabled)
      if (prefs.useMelatonin) {
        const melTime = addMinutes(sleepStart, -45);
        events.push({
          id: `melatonin-${dayOffset}`,
          type: 'MELATONIN',
          startTime: melTime,
          endTime: addMinutes(melTime, 30),
          title: 'Take Low-Dose Melatonin (0.5mg – 3mg)',
          description: 'Take melatonin 30–45 minutes before your target bedtime in a dim environment.',
          explanation:
            'Exogenous melatonin acts as a chronobiotic signal ("chemical darkness") to your suprachiasmatic nucleus, accelerating sleep onset at your new target bedtime.',
          dayOffset,
          displayTimezone: displayTz,
        });
      }

      // Caffeine guidance (if enabled)
      if (prefs.useCaffeine) {
        const cafStart = addMinutes(sleepEnd, 30);
        const cafEnd = addMinutes(sleepEnd, 180);
        events.push({
          id: `caffeine-${dayOffset}`,
          type: 'CAFFEINE',
          startTime: cafStart,
          endTime: cafEnd,
          title: 'Strategic Caffeine Window (Strict Cutoff After)',
          description: 'Enjoy coffee or tea during this morning window; avoid all caffeine within 8 hours of target sleep.',
          explanation:
            'Caffeine blocks adenosine receptors to boost daytime alertness during adaptation, but has a 5–6 hour half-life that fragments recovery sleep if taken late.',
          dayOffset,
          displayTimezone: displayTz,
        });
      }

      // Meal timing advice (Peripheral Clock Entrainment)
      const breakfastStart = addMinutes(sleepEnd, 30);
      events.push({
        id: `meal-breakfast-${dayOffset}`,
        type: 'MEAL',
        startTime: breakfastStart,
        endTime: addMinutes(breakfastStart, 60),
        title: 'Anchor Meal (High-Protein Breakfast)',
        description: 'Eat a protein-rich meal shortly after waking and hydrate with electrolytes.',
        explanation:
          'Peripheral clocks in your liver and digestive tract synchronize to feeding-fasting cycles. Eating at destination morning time anchors metabolic rhythms.',
        dayOffset,
        displayTimezone: displayTz,
      });
    }

    // Strategic Nap if main sleep was truncated below 5 hours (300 mins) or completely overlapped by flight
    if (sleepTruncatedByFlight || actualSleepMins < 300) {
      const napStart = addMinutes(sleepEnd, 300);
      const napEnd = addMinutes(napStart, 30);
      events.push({
        id: `nap-${dayOffset}`,
        type: 'NAP',
        startTime: napStart,
        endTime: napEnd,
        title: 'Strategic Power Nap (30 mins)',
        description: 'Take a brief 20–30 minute recovery nap. Set an alarm so you do not enter deep slow-wave sleep.',
        explanation:
          'Because flight transit shortened your core sleep block, a 30-minute power nap clears homeostatic sleep pressure without causing sleep inertia or ruining tonight’s target bedtime.',
        dayOffset,
        displayTimezone: displayTz,
      });
    }
  }

  return events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

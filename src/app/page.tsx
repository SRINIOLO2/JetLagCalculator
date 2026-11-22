'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  generateJetLagSchedule,
  applyFlightDelay,
  calculateShortestPhaseShift,
  FlightDetails,
  UserPreferences,
  JetLagEvent,
  AdaptationSpeed,
  AdjustmentStrategy,
  EventType,
} from '@/utils/jetLagAlgorithm';
import { generateICS } from '@/utils/icsGenerator';
import {
  OFFLINE_AIRPORTS,
  formatAirportLabel,
  resolveTimezone,
  findAirportByIata,
} from '@/data/airports';
import { lookupFlightNumber, FLIGHT_ROUTE_PRESETS } from '@/utils/flightLookup';
import {
  loadSavedTrips,
  saveTrip,
  deleteTrip,
  loadActiveTripId,
  SavedTrip,
} from '@/utils/tripStorage';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { addDays, format, differenceInMinutes } from 'date-fns';
import {
  Sun,
  Moon,
  Coffee,
  Plane,
  EyeOff,
  Calendar,
  MapPin,
  Pill,
  Utensils,
  BedDouble,
  Clock,
  Wifi,
  WifiOff,
  Search,
  AlertTriangle,
  Bookmark,
  Trash2,
  Info,
  Sparkles,
  Droplets,
  CheckCircle2,
  ArrowLeftRight,
  ChevronRight,
  SlidersHorizontal,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';

type MobileTab = 'PLANNER' | 'TIMELINE' | 'DECK';
type SwimlaneKey = 'flight' | 'sleep' | 'light' | 'cues';

interface SwimlaneSegment {
  id: string;
  type: EventType;
  lane: SwimlaneKey;
  subRow: number;
  title: string;
  shortLabel: string;
  timeRangeLabel: string;
  leftPct: number;
  widthPct: number;
}

interface SwimlaneLaneData {
  key: SwimlaneKey;
  label: string;
  badge: string;
  subRowCount: number;
  heightPx: number;
  segments: SwimlaneSegment[];
}

interface SwimlaneTick {
  pct: number;
  timeLabel: string;
  dateLabel?: string;
}

const SWIMLANE_DEFS: { key: SwimlaneKey; label: string; badge: string }[] = [
  { key: 'flight', label: 'Transit', badge: '✈️' },
  { key: 'sleep', label: 'Sleep / Nap', badge: '🛏️' },
  { key: 'light', label: 'Light Control', badge: '☀️' },
  { key: 'cues', label: 'Meals & Cues', badge: '☕' },
];

const EVENT_PRIORITY: Record<EventType, number> = {
  FLIGHT: 1,
  SLEEP: 2,
  NAP: 3,
  AVOID_LIGHT: 4,
  SEEK_LIGHT: 5,
  MELATONIN: 6,
  CAFFEINE: 7,
  MEAL: 8,
};

function getEventLane(type: EventType): SwimlaneKey {
  switch (type) {
    case 'FLIGHT':
      return 'flight';
    case 'SLEEP':
    case 'NAP':
      return 'sleep';
    case 'SEEK_LIGHT':
    case 'AVOID_LIGHT':
      return 'light';
    case 'MELATONIN':
    case 'CAFFEINE':
    case 'MEAL':
      return 'cues';
  }
}

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<MobileTab>('PLANNER');
  const [now, setNow] = useState<Date>(new Date());

  const [flightNumberQuery, setFlightNumberQuery] = useState('BA112');
  const [lookupStatus, setLookupStatus] = useState<string>('');

  const [originInput, setOriginInput] = useState('JFK - New York (America/New_York)');
  const [destInput, setDestInput] = useState('LHR - London (Europe/London)');

  const [flight, setFlight] = useState<FlightDetails>(() => {
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    const dayAfter = format(addDays(new Date(), 2), 'yyyy-MM-dd');
    return {
      flightNumber: 'BA112',
      originCode: 'JFK',
      destinationCode: 'LHR',
      departureTimeLocal: `${tomorrow}T18:30`,
      arrivalTimeLocal: `${dayAfter}T06:30`,
      originTimezone: 'America/New_York',
      destinationTimezone: 'Europe/London',
    };
  });

  const [prefs, setPrefs] = useState<UserPreferences>({
    normalBedtime: '23:00',
    normalWakeTime: '07:00',
    strategy: 'PRE_FLIGHT',
    speed: 'AVERAGE',
    useMelatonin: true,
    useCaffeine: true,
  });

  const [schedule, setSchedule] = useState<JetLagEvent[]>([]);
  // Default to Flight Day (0) with expandable 4-lane swimlane timeline
  const [selectedDayOffset, setSelectedDayOffset] = useState<number | 'ALL'>(0);
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [expandedEventIds, setExpandedEventIds] = useState<Record<string, boolean>>({});

  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string>('default-trip');
  const [rerouteInput, setRerouteInput] = useState('');
  const [delayNotice, setDelayNotice] = useState<string>('');
  const [extraZones, setExtraZones] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      setExtraZones(Intl.supportedValuesOf('timeZone'));
    }

    const storedTrips = loadSavedTrips();
    setSavedTrips(storedTrips);
    const lastId = loadActiveTripId();
    const initialTrip = storedTrips.find(t => t.id === lastId) || storedTrips[0];

    if (initialTrip) {
      setActiveTripId(initialTrip.id);
      setFlight(initialTrip.flight);
      setPrefs(initialTrip.prefs);
      setFlightNumberQuery(initialTrip.flight.flightNumber || '');
      setOriginInput(
        initialTrip.flight.originCode
          ? `${initialTrip.flight.originCode} (${initialTrip.flight.originTimezone})`
          : initialTrip.flight.originTimezone
      );
      setDestInput(
        initialTrip.flight.destinationCode
          ? `${initialTrip.flight.destinationCode} (${initialTrip.flight.destinationTimezone})`
          : initialTrip.flight.destinationTimezone
      );
      const initialSchedule = generateJetLagSchedule(initialTrip.flight, initialTrip.prefs);
      setSchedule(initialSchedule);

      const nowMs = Date.now();
      const tripStartMs = initialSchedule[0]?.startTime.getTime() ?? 0;
      const tripEndMs = initialSchedule[initialSchedule.length - 1]?.endTime.getTime() ?? 0;
      const isTripActive = nowMs >= tripStartMs && nowMs <= tripEndMs;
      setActiveTab(isTripActive ? 'DECK' : 'PLANNER');
    } else {
      const initialEvents = generateJetLagSchedule(flight, prefs);
      setSchedule(initialEvents);
    }

    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locationOptions = useMemo(() => {
    const airportLabels = OFFLINE_AIRPORTS.map(a => ({
      key: a.iata,
      label: formatAirportLabel(a),
      tz: a.tz,
    }));
    const existingTzs = new Set(airportLabels.map(a => a.tz));
    const additional = extraZones
      .filter(tz => !existingTzs.has(tz))
      .map(tz => ({ key: tz, label: tz, tz }));
    return [...airportLabels, ...additional];
  }, [extraZones]);

  const extractIataCode = (input: string): string | undefined => {
    const match = input.trim().match(/^([A-Za-z]{3})\b/);
    if (match && findAirportByIata(match[1])) {
      return match[1].toUpperCase();
    }
    return undefined;
  };

  const executeFlightLookup = async (rawCode: string) => {
    if (!rawCode.trim()) return;
    setFlightNumberQuery(rawCode);
    setLookupStatus('Searching route...');
    const datePart = flight.departureTimeLocal.slice(0, 10);
    const result = await lookupFlightNumber(rawCode, datePart);
    if (result) {
      const origLabel = formatAirportLabel(result.origin);
      const destLabel = formatAirportLabel(result.destination);
      setOriginInput(origLabel);
      setDestInput(destLabel);
      const nextFlight: FlightDetails = {
        flightNumber: result.flightNumber,
        originCode: result.origin.iata,
        destinationCode: result.destination.iata,
        departureTimeLocal: result.departureLocal,
        arrivalTimeLocal: result.arrivalLocal,
        originTimezone: result.origin.tz,
        destinationTimezone: result.destination.tz,
      };
      setFlight(nextFlight);
      const nextEvents = generateJetLagSchedule(nextFlight, prefs);
      setSchedule(nextEvents);
      if (result.source === 'online') {
        setLookupStatus(
          `${result.origin.iata} → ${result.destination.iata} (${result.airline}) loaded via live callsign route lookup. ${
            result.timesEstimated
              ? 'Placeholder times shown (18:00 → 08:00) — update with your ticket times below.'
              : 'Verify departure & arrival times match your ticket.'
          }`
        );
      } else {
        setLookupStatus(
          `Loaded built-in sample schedule for ${result.flightNumber} (${result.airline}: ${result.origin.iata} → ${result.destination.iata}). Verify your ticket times below.`
        );
      }
    } else {
      setLookupStatus(
        'Not in the 18 built-in demo flights — select Origin & Destination airports directly below.'
      );
    }
  };

  const handleClearFlightQuery = () => {
    setFlightNumberQuery('');
    setLookupStatus(
      'Flight number cleared. Enter any flight # or select Origin & Destination airports below.'
    );
  };

  const handleSwapLocations = () => {
    const prevOrigin = originInput;
    const prevDest = destInput;
    setOriginInput(prevDest);
    setDestInput(prevOrigin);

    const nextOriginTz = resolveTimezone(prevDest, flight.destinationTimezone);
    const nextDestTz = resolveTimezone(prevOrigin, flight.originTimezone);
    const nextOriginCode = extractIataCode(prevDest) || flight.destinationCode;
    const nextDestCode = extractIataCode(prevOrigin) || flight.originCode;

    const swappedFlight: FlightDetails = {
      ...flight,
      originTimezone: nextOriginTz,
      destinationTimezone: nextDestTz,
      originCode: nextOriginCode,
      destinationCode: nextDestCode,
    };
    setFlight(swappedFlight);
    setSchedule(generateJetLagSchedule(swappedFlight, prefs));
  };

  const handleGenerateAndSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const origTz = resolveTimezone(originInput, flight.originTimezone);
    const destTz = resolveTimezone(destInput, flight.destinationTimezone);
    const origCode = extractIataCode(originInput) || origTz.split('/').pop()?.replace(/_/g, ' ');
    const destCode = extractIataCode(destInput) || destTz.split('/').pop()?.replace(/_/g, ' ');

    const updatedFlight: FlightDetails = {
      ...flight,
      flightNumber: flightNumberQuery.trim().toUpperCase() || undefined,
      originTimezone: origTz,
      destinationTimezone: destTz,
      originCode: origCode,
      destinationCode: destCode,
    };

    setFlight(updatedFlight);
    const events = generateJetLagSchedule(updatedFlight, prefs);
    setSchedule(events);
    setSelectedDayOffset(0);
    setHighlightedEventId(null);

    const tripId = activeTripId || `trip-${Date.now()}`;
    const tripName = `${origCode} → ${destCode}${
      updatedFlight.flightNumber ? ` (${updatedFlight.flightNumber})` : ''
    }`;
    const updatedList = saveTrip({
      id: tripId,
      name: tripName,
      updatedAt: new Date().toISOString(),
      flight: updatedFlight,
      prefs,
    });
    setSavedTrips(updatedList);
    setActiveTripId(tripId);
    // Advance naturally left-to-right: 1. Plan Trip -> 2. Schedule
    setActiveTab('TIMELINE');
  };

  const handleQuickDelay = (minutes: number) => {
    const newDestTz = rerouteInput.trim()
      ? resolveTimezone(rerouteInput, flight.destinationTimezone)
      : undefined;
    const newDestCode = rerouteInput.trim() ? extractIataCode(rerouteInput) : undefined;

    const shiftedFlight = applyFlightDelay(flight, minutes, newDestTz, newDestCode);
    setFlight(shiftedFlight);
    if (newDestTz) {
      setDestInput(rerouteInput);
      setRerouteInput('');
    }
    const nextEvents = generateJetLagSchedule(shiftedFlight, prefs);
    setSchedule(nextEvents);

    const tripId = activeTripId || `trip-${Date.now()}`;
    const tripName = `${shiftedFlight.originCode || 'Origin'} → ${
      shiftedFlight.destinationCode || 'Dest'
    }`;
    const updatedList = saveTrip({
      id: tripId,
      name: tripName,
      updatedAt: new Date().toISOString(),
      flight: shiftedFlight,
      prefs,
    });
    setSavedTrips(updatedList);

    const sign = minutes >= 0 ? `+${minutes}m` : `${minutes}m`;
    setDelayNotice(
      `Updated offline: Flight shifted ${sign}${newDestCode ? ` & rerouted to ${newDestCode}` : ''}.`
    );
    setTimeout(() => setDelayNotice(''), 4000);
  };

  const handleLoadTrip = (trip: SavedTrip) => {
    setActiveTripId(trip.id);
    setFlight(trip.flight);
    setPrefs(trip.prefs);
    setFlightNumberQuery(trip.flight.flightNumber || '');
    setLookupStatus('');
    setOriginInput(
      trip.flight.originCode
        ? `${trip.flight.originCode} (${trip.flight.originTimezone})`
        : trip.flight.originTimezone
    );
    setDestInput(
      trip.flight.destinationCode
        ? `${trip.flight.destinationCode} (${trip.flight.destinationTimezone})`
        : trip.flight.destinationTimezone
    );
    setSchedule(generateJetLagSchedule(trip.flight, trip.prefs));
    setSelectedDayOffset(0);
    setHighlightedEventId(null);
    setActiveTab('TIMELINE');
  };

  const handleDeleteTrip = (id: string) => {
    const next = deleteTrip(id);
    setSavedTrips(next);
  };

  const handleExportICS = () => {
    if (schedule.length === 0) return;
    const tripLabel = `${flight.originCode || 'Origin'} to ${flight.destinationCode || 'Destination'}`;
    const icsString = generateICS(schedule, tripLabel);
    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'chrono-healer-protocol.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFocusScheduleEvent = (eventId: string) => {
    setHighlightedEventId(eventId);
    setExpandedEventIds(prev => ({ ...prev, [eventId]: true }));
    if (typeof document !== 'undefined') {
      const targetEl = document.getElementById(`agenda-row-${eventId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Wrap SVG icons inside a dedicated div badge to avoid WebKit replaced-element flex bugs
  const renderEventBadge = (type: JetLagEvent['type']) => {
    const lower = type.toLowerCase();
    let iconNode = <Calendar size={18} aria-hidden="true" />;
    switch (type) {
      case 'SLEEP':
        iconNode = <Moon size={18} aria-hidden="true" />;
        break;
      case 'NAP':
        iconNode = <BedDouble size={18} aria-hidden="true" />;
        break;
      case 'SEEK_LIGHT':
        iconNode = <Sun size={18} aria-hidden="true" />;
        break;
      case 'AVOID_LIGHT':
        iconNode = <EyeOff size={18} aria-hidden="true" />;
        break;
      case 'CAFFEINE':
        iconNode = <Coffee size={18} aria-hidden="true" />;
        break;
      case 'MELATONIN':
        iconNode = <Pill size={18} aria-hidden="true" />;
        break;
      case 'MEAL':
        iconNode = <Utensils size={18} aria-hidden="true" />;
        break;
      case 'FLIGHT':
        iconNode = <Plane size={18} aria-hidden="true" />;
        break;
    }
    return <div className={`event-icon-badge ${lower}`}>{iconNode}</div>;
  };

  const phaseSummary = useMemo(() => {
    try {
      const depUtc = fromZonedTime(flight.departureTimeLocal, flight.originTimezone);
      return calculateShortestPhaseShift(
        flight.originTimezone,
        flight.destinationTimezone,
        depUtc
      );
    } catch {
      return { shiftHours: 0, direction: 'NONE' as const };
    }
  }, [flight.departureTimeLocal, flight.originTimezone, flight.destinationTimezone]);

  const uniqueDayOffsets = useMemo(() => {
    const set = new Set<number>();
    schedule.forEach(e => set.add(e.dayOffset));
    return Array.from(set).sort((a, b) => a - b);
  }, [schedule]);

  const filteredSchedule = useMemo(() => {
    if (selectedDayOffset === 'ALL') return schedule;
    const dayItems = schedule.filter(e => e.dayOffset === selectedDayOffset);
    return dayItems.length > 0 ? dayItems : schedule;
  }, [schedule, selectedDayOffset]);

  const origShort =
    flight.originCode || flight.originTimezone.split('/').pop()?.replace(/_/g, ' ') || 'Origin';
  const destShort =
    flight.destinationCode ||
    flight.destinationTimezone.split('/').pop()?.replace(/_/g, ' ') ||
    'Dest';

  // Compute chronologically accurate 4-lane Swimlane model for the visible schedule slice
  const swimlaneModel = useMemo(() => {
    if (filteredSchedule.length === 0) return null;

    const axisTz =
      selectedDayOffset === 'ALL'
        ? flight.destinationTimezone
        : selectedDayOffset < 0
          ? flight.originTimezone
          : flight.destinationTimezone;

    try {
      const minStartMs = Math.min(...filteredSchedule.map(e => e.startTime.getTime()));
      const maxEndMs = Math.max(...filteredSchedule.map(e => e.endTime.getTime()));

      // Anchor window start cleanly to a 3-hour wall-clock boundary before the earliest event
      const padBefore = new Date(minStartMs - 60 * 60000);
      const startDateStr = formatInTimeZone(padBefore, axisTz, 'yyyy-MM-dd');
      const startHourRaw = Number(formatInTimeZone(padBefore, axisTz, 'H'));
      const alignedHour = Math.floor(startHourRaw / 3) * 3;
      const windowStartDate = fromZonedTime(
        `${startDateStr}T${String(alignedHour).padStart(2, '0')}:00:00`,
        axisTz
      );
      const windowStartMs = windowStartDate.getTime();

      const minSpanHours = selectedDayOffset === 'ALL' ? 24 : 18;
      const rawEndWithPadMs = maxEndMs + 45 * 60000;
      const totalHours = Math.max(
        minSpanHours,
        Math.ceil((rawEndWithPadMs - windowStartMs) / (3 * 3600000)) * 3
      );
      const windowEndMs = windowStartMs + totalHours * 3600000;
      const spanMs = windowEndMs - windowStartMs;

      // Determine tick spacing for axis clarity
      let stepHours = 3;
      if (selectedDayOffset === 'ALL') {
        if (isTimelineExpanded) {
          stepHours = totalHours > 96 ? 12 : 6;
        } else {
          stepHours = totalHours > 72 ? 24 : 12;
        }
      } else if (isTimelineExpanded && totalHours % 2 === 0 && totalHours <= 36) {
        stepHours = 2;
      }

      const ticks: SwimlaneTick[] = [];
      let prevDateTag = '';
      for (let h = 0; h <= totalHours; h += stepHours) {
        const tickDate = new Date(windowStartMs + h * 3600000);
        const pct = (h / totalHours) * 100;
        const timeLabel = formatInTimeZone(tickDate, axisTz, 'HH:mm');
        const dateTag = formatInTimeZone(tickDate, axisTz, 'MMM d');
        const showDate = dateTag !== prevDateTag;
        prevDateTag = dateTag;
        ticks.push({
          pct,
          timeLabel,
          dateLabel: showDate ? dateTag : undefined,
        });
      }

      const pillH = isTimelineExpanded ? 38 : 26;
      const rowGap = 4;
      const padY = 6;

      const sortedEvents = [...filteredSchedule].sort(
        (a, b) => a.startTime.getTime() - b.startTime.getTime()
      );

      const lanes: SwimlaneLaneData[] = SWIMLANE_DEFS.map(def => {
        const laneEvents = sortedEvents.filter(ev => getEventLane(ev.type) === def.key);
        const rowEnds: number[] = [];
        const segments: SwimlaneSegment[] = [];

        for (const ev of laneEvents) {
          const evStartMs = ev.startTime.getTime();
          const evEndMs = ev.endTime.getTime();
          const sMs = Math.max(windowStartMs, evStartMs);
          const eMs = Math.min(windowEndMs, Math.max(sMs + 15 * 60000, evEndMs));
          if (eMs <= sMs) continue;

          // Non-overlapping sub-row assignment (strict < avoids splitting back-to-back cues)
          let assignedRow = rowEnds.findIndex(lastEnd => lastEnd <= evStartMs);
          if (assignedRow === -1) {
            assignedRow = rowEnds.length;
            rowEnds.push(eMs);
          } else {
            rowEnds[assignedRow] = Math.max(rowEnds[assignedRow], eMs);
          }

          const leftPct = ((sMs - windowStartMs) / spanMs) * 100;
          const widthPct = ((eMs - sMs) / spanMs) * 100;

          let shortLabel = '';
          switch (ev.type) {
            case 'FLIGHT':
              shortLabel = flight.flightNumber || `${origShort}→${destShort}`;
              break;
            case 'SLEEP': {
              const hrs = (differenceInMinutes(ev.endTime, ev.startTime) / 60)
                .toFixed(1)
                .replace(/\.0$/, '');
              shortLabel = `Sleep ${hrs}h`;
              break;
            }
            case 'NAP':
              shortLabel = 'Nap 30m';
              break;
            case 'SEEK_LIGHT':
              shortLabel = 'Seek Light';
              break;
            case 'AVOID_LIGHT':
              shortLabel = 'Avoid Light';
              break;
            case 'MELATONIN':
              shortLabel = 'Melatonin';
              break;
            case 'CAFFEINE':
              shortLabel = 'Caffeine';
              break;
            case 'MEAL':
              shortLabel = 'Meal';
              break;
          }

          const startFormatted = formatInTimeZone(ev.startTime, axisTz, 'h:mm a');
          const endFormatted = formatInTimeZone(ev.endTime, axisTz, 'h:mm a zzz');

          segments.push({
            id: ev.id,
            type: ev.type,
            lane: def.key,
            subRow: assignedRow,
            title: ev.title,
            shortLabel,
            timeRangeLabel: `${startFormatted} – ${endFormatted}`,
            leftPct,
            widthPct,
          });
        }

        const subRowCount = Math.max(1, rowEnds.length);
        const heightPx = padY * 2 + subRowCount * pillH + (subRowCount - 1) * rowGap;

        return {
          key: def.key,
          label: def.label,
          badge: def.badge,
          subRowCount,
          heightPx,
          segments,
        };
      });

      const axisTzShort = formatInTimeZone(windowStartDate, axisTz, 'zzz');
      const rangeStartLabel = formatInTimeZone(windowStartDate, axisTz, 'MMM d');
      const rangeEndLabel = formatInTimeZone(new Date(windowEndMs), axisTz, 'MMM d');
      const dateRangeTitle =
        rangeStartLabel === rangeEndLabel
          ? `${rangeStartLabel} (${axisTzShort})`
          : `${rangeStartLabel} – ${rangeEndLabel} (${axisTzShort})`;

      const pxPerHour = selectedDayOffset === 'ALL' ? 28 : 54;
      const expandedWidthPx = Math.max(780, totalHours * pxPerHour);

      return {
        lanes,
        ticks,
        totalHours,
        dateRangeTitle,
        pillH,
        rowGap,
        padY,
        expandedWidthPx,
      };
    } catch {
      return null;
    }
  }, [
    filteredSchedule,
    selectedDayOffset,
    flight.originTimezone,
    flight.destinationTimezone,
    flight.flightNumber,
    origShort,
    destShort,
    isTimelineExpanded,
  ]);

  // Determine current active event (prioritized hero + concurrent chips) & next upcoming event
  const { primaryActiveEvent, secondaryActiveEvents, nextEvent } = useMemo(() => {
    const currentMs = now.getTime();
    const active = schedule
      .filter(e => e.startTime.getTime() <= currentMs && e.endTime.getTime() >= currentMs)
      .sort((a, b) => (EVENT_PRIORITY[a.type] ?? 99) - (EVENT_PRIORITY[b.type] ?? 99));
    const upcoming = schedule.find(e => e.startTime.getTime() > currentMs) || schedule[0];
    return {
      primaryActiveEvent: active[0] || null,
      secondaryActiveEvents: active.slice(1),
      nextEvent: upcoming,
    };
  }, [schedule, now]);

  const profileSummaryText = useMemo(() => {
    const speedLabel =
      prefs.speed === 'SLOW' ? 'Slow 1h/d' : prefs.speed === 'FAST' ? 'Fast 2h/d' : 'Balanced 1.5h/d';
    const stratLabel = prefs.strategy === 'PRE_FLIGHT' ? 'Pre-Flight Shift' : 'Arrival Only';
    const pillars = [
      prefs.useMelatonin ? 'Melatonin' : null,
      prefs.useCaffeine ? 'Caffeine' : null,
    ]
      .filter(Boolean)
      .join(' + ');
    return `${prefs.normalBedtime}–${prefs.normalWakeTime} · ${speedLabel} · ${stratLabel}${
      pillars ? ` · ${pillars}` : ''
    }`;
  }, [prefs]);

  if (!mounted) return null;

  let originNowFormatted = '--:--';
  let destNowFormatted = '--:--';
  try {
    originNowFormatted = formatInTimeZone(now, flight.originTimezone, 'h:mm a');
    destNowFormatted = formatInTimeZone(now, flight.destinationTimezone, 'h:mm a');
  } catch {
    // Fallback if invalid timezone string
  }

  return (
    <main className="main-container">
      {/* Compact Header & Route Clock Strip */}
      <header className="top-bar glass-card">
        <div className="brand-row">
          <div className="brand-left">
            <div className="logo-badge">
              <Plane size={20} aria-hidden="true" />
            </div>
            <div>
              <h1>Chrono Healer</h1>
              <p className="subtitle">Offline Circadian Companion</p>
            </div>
          </div>

          <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
            <span>{isOnline ? 'Online' : 'Offline Mode'}</span>
          </div>
        </div>

        <div className="route-clock-strip">
          <div className="clock-node">
            <span className="clock-code">{origShort}</span>
            <strong className="clock-time">{originNowFormatted}</strong>
          </div>

          <div className="shift-pill">
            {phaseSummary.direction === 'NONE'
              ? 'No Time Shift'
              : `${Math.abs(phaseSummary.shiftHours)}h ${
                  phaseSummary.direction === 'EAST' ? 'East →' : '← West'
                }`}
          </div>

          <div className="clock-node right">
            <span className="clock-code">{destShort}</span>
            <strong className="clock-time accent-text">{destNowFormatted}</strong>
          </div>
        </div>
      </header>

      {/* Left-to-Right Chronological Navigation: 1. Plan Trip -> 2. Schedule -> 3. Flight Deck */}
      <nav className="mode-tabs" aria-label="Primary Views">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'PLANNER' ? 'active' : ''}`}
          onClick={() => setActiveTab('PLANNER')}
        >
          <Sparkles size={16} aria-hidden="true" />
          <span>1. Plan Trip</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'TIMELINE' ? 'active' : ''}`}
          onClick={() => setActiveTab('TIMELINE')}
        >
          <Calendar size={16} aria-hidden="true" />
          <span>2. Schedule</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'DECK' ? 'active' : ''}`}
          onClick={() => setActiveTab('DECK')}
        >
          <Clock size={16} aria-hidden="true" />
          <span>3. Flight Deck</span>
        </button>
      </nav>

      {/* VIEW 1: PLAN TRIP (SAVED TRIPS ON TOP + EXPLICIT DEMO FLIGHT SOURCES) */}
      {activeTab === 'PLANNER' && (
        <div className="planner-stack">
          {/* Saved Trips Offline Switcher (Promoted to top when user has saved trips) */}
          {savedTrips.length > 0 && (
            <aside className="saved-trips-section glass-card">
              <div className="section-title-row">
                <Bookmark size={18} aria-hidden="true" className="info-icon" />
                <div>
                  <h2>Your Saved Trips ({savedTrips.length})</h2>
                  <p className="muted-sm">
                    Itineraries you saved on this device for instant offline access.
                  </p>
                </div>
              </div>

              <div className="saved-list">
                {savedTrips.map(trip => (
                  <div
                    key={trip.id}
                    className={`saved-trip-item ${trip.id === activeTripId ? 'selected' : ''}`}
                  >
                    <button
                      type="button"
                      className="saved-trip-main"
                      onClick={() => handleLoadTrip(trip)}
                    >
                      <strong>{trip.name}</strong>
                      <span>
                        Dep: {trip.flight.departureTimeLocal.replace('T', ' ')} ·{' '}
                        {trip.prefs.speed.toLowerCase()} pace
                      </span>
                    </button>
                    <button
                      type="button"
                      className="delete-trip-btn"
                      aria-label={`Delete ${trip.name}`}
                      onClick={() => handleDeleteTrip(trip.id)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          )}

          <section className="form-section glass-card">
            <h2>Plan a New Flight</h2>

            {/* Quick Flight Number Lookup with Clear Source Transparency */}
            <div className="input-group">
              <label htmlFor="flight-num-input">
                Flight Number (Optional — Checks live callsign route or built-in samples)
              </label>
              <div className="lookup-bar">
                <input
                  id="flight-num-input"
                  type="text"
                  placeholder="Enter any flight # (e.g. BA112, UA928) or leave blank"
                  value={flightNumberQuery}
                  onChange={e => setFlightNumberQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => executeFlightLookup(flightNumberQuery)}
                >
                  <Search size={16} aria-hidden="true" />
                  <span>Lookup</span>
                </button>
                {flightNumberQuery && (
                  <button
                    type="button"
                    className="btn-secondary btn-subtle"
                    aria-label="Clear flight number"
                    onClick={handleClearFlightQuery}
                  >
                    <X size={15} aria-hidden="true" />
                    <span>Clear</span>
                  </button>
                )}
              </div>

              <p className="preset-caption">
                Built-in Sample Routes (Offline demo examples to test quickly — not live departures
                or your trip history):
              </p>
              <div className="preset-chips-scroll" role="group" aria-label="Built-in Sample Routes">
                {FLIGHT_ROUTE_PRESETS.slice(0, 5).map(p => (
                  <button
                    key={p.flightNumber}
                    type="button"
                    className={`mini-chip ${
                      flightNumberQuery.toUpperCase() === p.flightNumber ? 'active' : ''
                    }`}
                    onClick={() => executeFlightLookup(p.flightNumber)}
                  >
                    {p.flightNumber} · {p.originIata}→{p.destinationIata}
                  </button>
                ))}
              </div>
              {lookupStatus && <p className="feedback-text">{lookupStatus}</p>}
            </div>

            <form onSubmit={handleGenerateAndSave}>
              {/* Origin & Destination with Clean Swap */}
              <div className="route-inputs-box">
                <div className="input-group">
                  <label htmlFor="origin-tz-input">Origin Airport or City</label>
                  <input
                    id="origin-tz-input"
                    list="locations-datalist"
                    placeholder="JFK, New York, London, Tokyo..."
                    value={originInput}
                    onChange={e => setOriginInput(e.target.value)}
                  />
                  <p className="feedback-text">
                    <MapPin size={12} aria-hidden="true" />
                    <span>{resolveTimezone(originInput, flight.originTimezone)}</span>
                  </p>
                </div>

                <div className="swap-row">
                  <button
                    type="button"
                    className="btn-secondary swap-btn"
                    onClick={handleSwapLocations}
                  >
                    <ArrowLeftRight size={15} aria-hidden="true" />
                    <span>Swap Route</span>
                  </button>
                </div>

                <div className="input-group">
                  <label htmlFor="dest-tz-input">Destination Airport or City</label>
                  <input
                    id="dest-tz-input"
                    list="locations-datalist"
                    placeholder="LHR, London, HND, Sydney..."
                    value={destInput}
                    onChange={e => setDestInput(e.target.value)}
                  />
                  <p className="feedback-text">
                    <MapPin size={12} aria-hidden="true" />
                    <span>{resolveTimezone(destInput, flight.destinationTimezone)}</span>
                  </p>
                </div>
              </div>

              <div className="row datetime-row">
                <div className="input-group half">
                  <label htmlFor="dep-datetime-input">Departure (Origin Local)</label>
                  <input
                    id="dep-datetime-input"
                    type="datetime-local"
                    value={flight.departureTimeLocal.slice(0, 16)}
                    onChange={e => setFlight({ ...flight, departureTimeLocal: e.target.value })}
                  />
                </div>

                <div className="input-group half">
                  <label htmlFor="arr-datetime-input">Arrival (Destination Local)</label>
                  <input
                    id="arr-datetime-input"
                    type="datetime-local"
                    value={flight.arrivalTimeLocal.slice(0, 16)}
                    onChange={e => setFlight({ ...flight, arrivalTimeLocal: e.target.value })}
                  />
                </div>
              </div>

              <datalist id="locations-datalist">
                {locationOptions.map(opt => (
                  <option key={opt.key} value={opt.label} />
                ))}
              </datalist>

              {/* Progressive Disclosure for Personal Circadian Preferences */}
              <details className="customize-panel">
                <summary className="customize-summary">
                  <div className="summary-left">
                    <SlidersHorizontal size={17} aria-hidden="true" className="info-icon" />
                    <div>
                      <strong>Customize Sleep, Pace &amp; Supplements</strong>
                      <span className="summary-sub">{profileSummaryText}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} aria-hidden="true" className="disclosure-chevron" />
                </summary>

                <div className="customize-body">
                  <div className="row">
                    <div className="input-group half">
                      <label htmlFor="bedtime-input">Usual Bedtime (Home)</label>
                      <input
                        id="bedtime-input"
                        type="time"
                        value={prefs.normalBedtime}
                        onChange={e => setPrefs({ ...prefs, normalBedtime: e.target.value })}
                      />
                    </div>
                    <div className="input-group half">
                      <label htmlFor="waketime-input">Usual Wake Time (Home)</label>
                      <input
                        id="waketime-input"
                        type="time"
                        value={prefs.normalWakeTime}
                        onChange={e => setPrefs({ ...prefs, normalWakeTime: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row">
                    <div className="input-group half">
                      <label htmlFor="strategy-select">Adjustment Strategy</label>
                      <select
                        id="strategy-select"
                        value={prefs.strategy}
                        onChange={e =>
                          setPrefs({ ...prefs, strategy: e.target.value as AdjustmentStrategy })
                        }
                      >
                        <option value="PRE_FLIGHT">Start shifting before flight (up to 3d)</option>
                        <option value="ARRIVAL_ONLY">Shift upon departure/arrival only</option>
                      </select>
                    </div>

                    <div className="input-group half">
                      <label htmlFor="speed-select">Adaptation Pace</label>
                      <select
                        id="speed-select"
                        value={prefs.speed}
                        onChange={e =>
                          setPrefs({ ...prefs, speed: e.target.value as AdaptationSpeed })
                        }
                      >
                        <option value="SLOW">Gentle (1.0h / day)</option>
                        <option value="AVERAGE">Balanced (1.5h / day)</option>
                        <option value="FAST">Aggressive (2.0h / day)</option>
                      </select>
                    </div>
                  </div>

                  <div className="toggles-grid">
                    <label className="toggle-card">
                      <input
                        type="checkbox"
                        checked={prefs.useMelatonin}
                        onChange={e => setPrefs({ ...prefs, useMelatonin: e.target.checked })}
                      />
                      <div className="toggle-text">
                        <strong>Melatonin Cues</strong>
                        <span>0.5mg–3mg timed 45m before target sleep</span>
                      </div>
                    </label>

                    <label className="toggle-card">
                      <input
                        type="checkbox"
                        checked={prefs.useCaffeine}
                        onChange={e => setPrefs({ ...prefs, useCaffeine: e.target.checked })}
                      />
                      <div className="toggle-text">
                        <strong>Strategic Caffeine</strong>
                        <span>Morning alertness window + sleep cutoff</span>
                      </div>
                    </label>
                  </div>
                </div>
              </details>

              <button type="submit" className="btn-primary">
                Save Trip &amp; View Schedule
              </button>
            </form>
          </section>
        </div>
      )}

      {/* VIEW 2: SCHEDULE (EXPANDABLE 4-LANE SWIMLANE TIMELINE + AGENDA ROWS) */}
      {activeTab === 'TIMELINE' && (
        <section className="timeline-section">
          <div className="timeline-header glass-card">
            <div className="timeline-title-bar">
              <div>
                <h2>Circadian Schedule</h2>
                <p className="muted-sm">
                  {origShort} → {destShort} · Tap any bar or row to inspect the science
                </p>
              </div>
              <div className="deck-header-actions">
                <button type="button" onClick={handleExportICS} className="btn-secondary">
                  <Calendar size={15} aria-hidden="true" />
                  <span>Add .ics</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('DECK')}
                  className="btn-secondary"
                >
                  <span>Flight Deck</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Day Filter Strip */}
            <div className="day-pills-scroll" role="tablist" aria-label="Select Trip Day">
              {uniqueDayOffsets.map(offset => (
                <button
                  key={offset}
                  type="button"
                  role="tab"
                  aria-selected={selectedDayOffset === offset}
                  className={`day-pill ${selectedDayOffset === offset ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDayOffset(offset);
                    setHighlightedEventId(null);
                  }}
                >
                  {offset === 0
                    ? '✈️ Flight Day'
                    : offset < 0
                      ? `Day ${offset}`
                      : `Day +${offset}`}
                </button>
              ))}
              <button
                type="button"
                role="tab"
                aria-selected={selectedDayOffset === 'ALL'}
                className={`day-pill ${selectedDayOffset === 'ALL' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedDayOffset('ALL');
                  setHighlightedEventId(null);
                }}
              >
                All Days ({schedule.length})
              </button>
            </div>

            {/* Multi-Lane Chronological Swimlane Timeline with Expand/Zoom Mode */}
            {swimlaneModel && (
              <div className="visual-band-container" aria-label="Multi-Lane Circadian Timeline">
                <div className="swimlane-header-bar">
                  <div className="swimlane-title-meta">
                    <strong>Visual Timeline</strong>
                    <span>
                      {swimlaneModel.dateRangeTitle}
                      {isTimelineExpanded ? ' · Swipe horizontally to inspect' : ''}
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`btn-secondary zoom-toggle-btn ${isTimelineExpanded ? 'active' : ''}`}
                    aria-pressed={isTimelineExpanded}
                    onClick={() => setIsTimelineExpanded(prev => !prev)}
                  >
                    {isTimelineExpanded ? (
                      <>
                        <Minimize2 size={15} aria-hidden="true" />
                        <span>Compact Fit</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 size={15} aria-hidden="true" />
                        <span>Expand Timeline</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="swimlane-chart">
                  {/* Fixed Left Gutter (never scrolls away or collides during horizontal pan) */}
                  <div className="swimlane-gutter" aria-hidden="true">
                    <div className="swimlane-axis-spacer" />
                    {swimlaneModel.lanes.map(lane => (
                      <div
                        key={lane.key}
                        className="swimlane-gutter-cell"
                        style={{ height: `${lane.heightPx}px` }}
                      >
                        <span className="lane-emoji">{lane.badge}</span>
                        <span className="lane-name">{lane.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Horizontally Scrollable Time Canvas */}
                  <div className="swimlane-scroll-viewport">
                    <div
                      className={`swimlane-canvas ${isTimelineExpanded ? 'expanded' : 'compact'}`}
                      style={
                        isTimelineExpanded
                          ? {
                              width: `${swimlaneModel.expandedWidthPx}px`,
                              minWidth: `${swimlaneModel.expandedWidthPx}px`,
                            }
                          : { width: '100%' }
                      }
                    >
                      {/* Chronological Time Axis Header */}
                      <div className="swimlane-axis">
                        {swimlaneModel.ticks.map((tick, idx) => (
                          <div
                            key={`${tick.timeLabel}-${idx}`}
                            className={`swimlane-tick ${
                              idx === 0
                                ? 'align-start'
                                : idx === swimlaneModel.ticks.length - 1
                                  ? 'align-end'
                                  : ''
                            }`}
                            style={{ left: `${tick.pct.toFixed(2)}%` }}
                          >
                            {tick.dateLabel && (
                              <span className="tick-date">{tick.dateLabel}</span>
                            )}
                            <span className="tick-time">{tick.timeLabel}</span>
                          </div>
                        ))}
                      </div>

                      {/* 4 Non-Overlapping Swimlane Tracks */}
                      {swimlaneModel.lanes.map(lane => (
                        <div
                          key={lane.key}
                          className="swimlane-track"
                          style={{ height: `${lane.heightPx}px` }}
                        >
                          {/* Subtle Vertical Gridlines */}
                          {swimlaneModel.ticks.map((tick, idx) => (
                            <span
                              key={`grid-${lane.key}-${idx}`}
                              className="swimlane-gridline"
                              style={{ left: `${tick.pct.toFixed(2)}%` }}
                              aria-hidden="true"
                            />
                          ))}

                          {lane.segments.map(seg => {
                            const showText = isTimelineExpanded || seg.widthPct >= 14;
                            const topPx =
                              swimlaneModel.padY +
                              seg.subRow * (swimlaneModel.pillH + swimlaneModel.rowGap);

                            return (
                              <button
                                key={seg.id}
                                type="button"
                                className={`swimlane-pill ${seg.type.toLowerCase()} ${
                                  highlightedEventId === seg.id ? 'selected' : ''
                                } ${isTimelineExpanded ? 'expanded' : 'compact'}`}
                                style={{
                                  left: `${seg.leftPct.toFixed(2)}%`,
                                  width: `${Math.max(isTimelineExpanded ? 3.5 : 1.8, seg.widthPct).toFixed(2)}%`,
                                  top: `${topPx}px`,
                                  height: `${swimlaneModel.pillH}px`,
                                }}
                                title={`${seg.title} (${seg.timeRangeLabel})`}
                                aria-label={`${seg.title}, ${seg.timeRangeLabel}`}
                                onClick={() => handleFocusScheduleEvent(seg.id)}
                              >
                                {showText && (
                                  <span className="swimlane-pill-text">{seg.shortLabel}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="visual-legend">
                  <span>
                    <i className="legend-dot flight" /> Flight
                  </span>
                  <span>
                    <i className="legend-dot sleep" /> Sleep / Nap
                  </span>
                  <span>
                    <i className="legend-dot seek_light" /> Seek Light
                  </span>
                  <span>
                    <i className="legend-dot avoid_light" /> Avoid Light
                  </span>
                  <span>
                    <i className="legend-dot cues" /> Meals / Caffeine / Melatonin
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Clean Tap-to-Expand Agenda List */}
          <div className="agenda-card glass-card" role="region" aria-label="Circadian Orders">
            {filteredSchedule.map(event => {
              let startTimeShort = '';
              let endTimeShort = '';
              let dateBadge = '';
              try {
                startTimeShort = formatInTimeZone(event.startTime, event.displayTimezone, 'h:mm a');
                endTimeShort = formatInTimeZone(
                  event.endTime,
                  event.displayTimezone,
                  'h:mm a zzz'
                );
                dateBadge = formatInTimeZone(event.startTime, event.displayTimezone, 'EEE, MMM d');
              } catch {
                startTimeShort = format(event.startTime, 'h:mm a');
                endTimeShort = format(event.endTime, 'h:mm a');
                dateBadge = format(event.startTime, 'EEE, MMM d');
              }

              return (
                <details
                  key={event.id}
                  id={`agenda-row-${event.id}`}
                  className={`agenda-row ${event.type.toLowerCase()} ${
                    highlightedEventId === event.id ? 'highlighted' : ''
                  }`}
                  open={!!expandedEventIds[event.id]}
                  onToggle={e => {
                    const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                    setExpandedEventIds(prev =>
                      prev[event.id] === isOpen ? prev : { ...prev, [event.id]: isOpen }
                    );
                  }}
                >
                  <summary className="agenda-summary">
                    {renderEventBadge(event.type)}

                    <div className="agenda-main">
                      <div className="agenda-meta-line">
                        <span className="agenda-time">
                          {startTimeShort} – {endTimeShort}
                        </span>
                        <span className="agenda-date-chip">
                          {selectedDayOffset === 'ALL'
                            ? `${
                                event.dayOffset === 0
                                  ? 'Flight Day'
                                  : event.dayOffset < 0
                                    ? `Day ${event.dayOffset}`
                                    : `Day +${event.dayOffset}`
                              } · ${dateBadge}`
                            : dateBadge}
                        </span>
                      </div>
                      <strong className="agenda-title">{event.title}</strong>
                      <span className="agenda-desc">{event.description}</span>
                    </div>

                    <ChevronRight size={18} aria-hidden="true" className="agenda-chevron" />
                  </summary>

                  <div className="agenda-science">
                    <Info size={15} aria-hidden="true" />
                    <span>{event.explanation}</span>
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {/* VIEW 3: FLIGHT DECK (LIVE IN-FLIGHT "NOW" FOCUS + DELAY SHIFTER) */}
      {activeTab === 'DECK' && (
        <section className="deck-view">
          <div className="glass-card highlight-card">
            <div className="card-badge-row">
              <span className="live-dot-badge">
                <span className="pulse-dot" /> RIGHT NOW
              </span>
              <div className="deck-header-actions">
                <button
                  type="button"
                  onClick={() => setActiveTab('TIMELINE')}
                  className="btn-secondary"
                >
                  <Calendar size={15} aria-hidden="true" />
                  <span>Day Schedule</span>
                </button>
                <button type="button" onClick={handleExportICS} className="btn-secondary">
                  <span>Export .ics</span>
                </button>
              </div>
            </div>

            {primaryActiveEvent ? (
              <div className="now-focus-area">
                <div className={`active-event-banner ${primaryActiveEvent.type.toLowerCase()}`}>
                  <div className="banner-header">
                    {renderEventBadge(primaryActiveEvent.type)}
                    <div className="banner-title-group">
                      <h2>{primaryActiveEvent.title}</h2>
                      <p className="time-meta">
                        Until{' '}
                        {formatInTimeZone(
                          primaryActiveEvent.endTime,
                          primaryActiveEvent.displayTimezone,
                          'h:mm a zzz'
                        )}{' '}
                        ({Math.max(1, differenceInMinutes(primaryActiveEvent.endTime, now))}m
                        remaining)
                      </p>
                    </div>
                  </div>
                  <p className="banner-desc">{primaryActiveEvent.description}</p>
                  <details className="inline-science-details">
                    <summary>Why this recommendation matters</summary>
                    <p>{primaryActiveEvent.explanation}</p>
                  </details>
                </div>

                {secondaryActiveEvents.length > 0 && (
                  <div className="concurrent-cues">
                    <span className="concurrent-label">Also active right now:</span>
                    <div className="concurrent-chips">
                      {secondaryActiveEvents.map(sec => (
                        <div key={sec.id} className="concurrent-chip">
                          {renderEventBadge(sec.type)}
                          <span>{sec.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="now-standby">
                <h2>No Active Window Right Now</h2>
                <p>
                  Stay hydrated, move gently in the cabin or terminal, and prepare for your next
                  scheduled cue below.
                </p>
              </div>
            )}

            {nextEvent && (
              <div className="next-up-box">
                <span className="next-label">UP NEXT</span>
                <div className="next-row">
                  {renderEventBadge(nextEvent.type)}
                  <div className="next-info">
                    <strong>{nextEvent.title}</strong>
                    <span>
                      {formatInTimeZone(
                        nextEvent.startTime,
                        nextEvent.displayTimezone,
                        'EEE, MMM d · h:mm a zzz'
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* On-Demand Collapsible Delay / Reroute Drawer */}
          <details className="glass-card disclosure-card" open={!!delayNotice}>
            <summary className="disclosure-summary">
              <div className="summary-left">
                <AlertTriangle size={18} aria-hidden="true" className="warn-icon" />
                <div>
                  <strong>Flight Delayed or Re-routed?</strong>
                  <span className="summary-sub">Tap to shift times or change airport offline</span>
                </div>
              </div>
              <ChevronRight size={18} aria-hidden="true" className="disclosure-chevron" />
            </summary>

            <div className="disclosure-body">
              <div className="delay-buttons-row">
                <button
                  type="button"
                  className="btn-chip"
                  onClick={() => handleQuickDelay(-30)}
                >
                  -30m Early
                </button>
                <button
                  type="button"
                  className="btn-chip"
                  onClick={() => handleQuickDelay(30)}
                >
                  +30m Delay
                </button>
                <button
                  type="button"
                  className="btn-chip"
                  onClick={() => handleQuickDelay(60)}
                >
                  +1h Delay
                </button>
                <button
                  type="button"
                  className="btn-chip"
                  onClick={() => handleQuickDelay(120)}
                >
                  +2h Delay
                </button>
              </div>

              <div className="reroute-row">
                <input
                  list="locations-datalist"
                  placeholder="Diverted airport code or city (optional, e.g. CDG)"
                  value={rerouteInput}
                  onChange={e => setRerouteInput(e.target.value)}
                />
                {rerouteInput.trim() && (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleQuickDelay(0)}
                  >
                    Apply Re-route
                  </button>
                )}
              </div>

              {delayNotice && (
                <p className="delay-feedback">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{delayNotice}</span>
                </p>
              )}
            </div>
          </details>

          {/* On-Demand Collapsible Wellness Checklist */}
          <details className="glass-card disclosure-card">
            <summary className="disclosure-summary">
              <div className="summary-left">
                <Droplets size={18} aria-hidden="true" className="info-icon" />
                <div>
                  <strong>In-Flight Hydration &amp; Adaptation Tips</strong>
                  <span className="summary-sub">
                    {prefs.speed.toLowerCase()} pace ({Math.abs(phaseSummary.shiftHours)}h total
                    shift)
                  </span>
                </div>
              </div>
              <ChevronRight size={18} aria-hidden="true" className="disclosure-chevron" />
            </summary>
            <div className="disclosure-body">
              <ul className="tips-list">
                <li>
                  <strong>Set Watch Immediately:</strong> Switch your watch/phone to {destShort}{' '}
                  time as soon as you board.
                </li>
                <li>
                  <strong>Hydration Rule:</strong> Drink ~250ml (8 oz) of water per hour in flight;
                  avoid alcohol, which fragments REM sleep.
                </li>
                <li>
                  <strong>Adaptation Pace:</strong> Shifting{' '}
                  {prefs.speed === 'SLOW' ? '1.0' : prefs.speed === 'FAST' ? '2.0' : '1.5'}h per day
                  across {Math.abs(phaseSummary.shiftHours)} hours.
                </li>
              </ul>
            </div>
          </details>
        </section>
      )}
    </main>
  );
}

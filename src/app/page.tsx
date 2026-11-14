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
} from 'lucide-react';

type MobileTab = 'DECK' | 'TIMELINE' | 'PLANNER';

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
  // Default to Flight Day (0) instead of dumping all 40 events at once
  const [selectedDayOffset, setSelectedDayOffset] = useState<number | 'ALL'>(0);
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
      setSchedule(generateJetLagSchedule(initialTrip.flight, initialTrip.prefs));
      setActiveTab('DECK');
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
      setLookupStatus(
        `${result.airline} · ${result.origin.iata} → ${result.destination.iata} (${
          result.source === 'online' ? 'Live Route' : 'Offline Database'
        })`
      );
    } else {
      setLookupStatus(
        'Flight not in offline presets — select Origin & Destination airports below.'
      );
    }
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
    setActiveTab('DECK');
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
    setActiveTab('DECK');
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

  // Compute 24h visual segments for the selected single day
  const visualBarSegments = useMemo(() => {
    if (selectedDayOffset === 'ALL' || filteredSchedule.length === 0) return [];
    const barTypes = new Set<EventType>(['SLEEP', 'NAP', 'SEEK_LIGHT', 'AVOID_LIGHT', 'FLIGHT']);
    return filteredSchedule
      .filter(ev => barTypes.has(ev.type))
      .map(ev => {
        try {
          const startH = Number(formatInTimeZone(ev.startTime, ev.displayTimezone, 'H'));
          const startM = Number(formatInTimeZone(ev.startTime, ev.displayTimezone, 'm'));
          const startPct = ((startH * 60 + startM) / 1440) * 100;
          const durMins = Math.max(30, Math.min(720, differenceInMinutes(ev.endTime, ev.startTime)));
          const widthPct = Math.min(100 - startPct, (durMins / 1440) * 100);
          return {
            id: ev.id,
            type: ev.type,
            title: ev.title,
            left: `${startPct.toFixed(1)}%`,
            width: `${Math.max(3, widthPct).toFixed(1)}%`,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as {
      id: string;
      type: EventType;
      title: string;
      left: string;
      width: string;
    }[];
  }, [filteredSchedule, selectedDayOffset]);

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

  const origShort =
    flight.originCode || flight.originTimezone.split('/').pop()?.replace(/_/g, ' ');
  const destShort =
    flight.destinationCode || flight.destinationTimezone.split('/').pop()?.replace(/_/g, ' ');

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

      {/* Clean Non-Overlapping Segmented Switcher */}
      <nav className="mode-tabs" aria-label="Primary Views">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'DECK' ? 'active' : ''}`}
          onClick={() => setActiveTab('DECK')}
        >
          <Clock size={17} aria-hidden="true" />
          <span>Flight Deck</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'TIMELINE' ? 'active' : ''}`}
          onClick={() => setActiveTab('TIMELINE')}
        >
          <Calendar size={17} aria-hidden="true" />
          <span>Schedule</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'PLANNER' ? 'active' : ''}`}
          onClick={() => setActiveTab('PLANNER')}
        >
          <Sparkles size={17} aria-hidden="true" />
          <span>Plan Trip</span>
        </button>
      </nav>

      {/* VIEW 1: FLIGHT DECK (FOCUSED "NOW" CARD + COLLAPSIBLE DRAWERS) */}
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
                  <span>Day Schedule</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
                <button type="button" onClick={handleExportICS} className="btn-secondary">
                  <Calendar size={15} aria-hidden="true" />
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
                  <strong>In-Flight Hydration & Adaptation Tips</strong>
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

      {/* VIEW 2: SCHEDULE (24H VISUAL BAR + SINGLE-DAY AGENDA ROWS) */}
      {activeTab === 'TIMELINE' && (
        <section className="timeline-section">
          <div className="timeline-header glass-card">
            <div className="timeline-title-bar">
              <div>
                <h2>Circadian Schedule</h2>
                <p className="muted-sm">
                  {origShort} → {destShort} · Tap any order to read the science
                </p>
              </div>
              <button type="button" onClick={handleExportICS} className="btn-secondary">
                <Calendar size={16} aria-hidden="true" />
                <span>Add to Calendar (.ics)</span>
              </button>
            </div>

            {/* Day Filter Strip (Defaults to Flight Day 0) */}
            <div className="day-pills-scroll" role="tablist" aria-label="Select Trip Day">
              {uniqueDayOffsets.map(offset => (
                <button
                  key={offset}
                  type="button"
                  role="tab"
                  aria-selected={selectedDayOffset === offset}
                  className={`day-pill ${selectedDayOffset === offset ? 'active' : ''}`}
                  onClick={() => setSelectedDayOffset(offset)}
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
                onClick={() => setSelectedDayOffset('ALL')}
              >
                All Days ({schedule.length})
              </button>
            </div>

            {/* 24-Hour Visual Circadian Band (shown when viewing a single day) */}
            {selectedDayOffset !== 'ALL' && visualBarSegments.length > 0 && (
              <div className="visual-band-container" aria-label="24-Hour Visual Overview">
                <div className="visual-band-labels">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>24:00</span>
                </div>
                <div className="day-visual-bar">
                  {visualBarSegments.map(seg => (
                    <div
                      key={seg.id}
                      className={`bar-segment ${seg.type.toLowerCase()}`}
                      style={{ left: seg.left, width: seg.width }}
                      title={seg.title}
                    />
                  ))}
                </div>
                <div className="visual-legend">
                  <span>
                    <i className="legend-dot sleep" /> Sleep
                  </span>
                  <span>
                    <i className="legend-dot seek_light" /> Seek Light
                  </span>
                  <span>
                    <i className="legend-dot avoid_light" /> Avoid Light
                  </span>
                  <span>
                    <i className="legend-dot flight" /> Flight
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Clean Tap-to-Expand Agenda List (Zero competing buttons!) */}
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
                  className={`agenda-row ${event.type.toLowerCase()}`}
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

      {/* VIEW 3: PLAN TRIP (ESSENTIALS FIRST + PROGRESSIVE DISCLOSURE) */}
      {activeTab === 'PLANNER' && (
        <div className="planner-stack">
          <section className="form-section glass-card">
            <h2>Plan Your Flight</h2>

            {/* Quick Flight Number Lookup */}
            <div className="input-group">
              <label htmlFor="flight-num-input">
                Flight Number (Optional — Auto-fills Route & Times)
              </label>
              <div className="lookup-bar">
                <input
                  id="flight-num-input"
                  type="text"
                  placeholder="e.g. BA112, UA928, JL5, QF11"
                  value={flightNumberQuery}
                  onChange={e => setFlightNumberQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => executeFlightLookup(flightNumberQuery)}
                >
                  <Search size={16} aria-hidden="true" />
                  <span>Auto-Fill</span>
                </button>
              </div>
              <div className="preset-chips-scroll" role="group" aria-label="Quick Route Presets">
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
                      <strong>Customize Sleep, Pace & Supplements</strong>
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
                Generate & Open Flight Deck
              </button>
            </form>
          </section>

          {/* Saved Trips Offline Switcher */}
          {savedTrips.length > 0 && (
            <aside className="saved-trips-section glass-card">
              <div className="section-title-row">
                <Bookmark size={18} aria-hidden="true" className="info-icon" />
                <div>
                  <h2>Saved Offline Trips ({savedTrips.length})</h2>
                  <p className="muted-sm">Tap any itinerary to load it offline.</p>
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
        </div>
      )}
    </main>
  );
}

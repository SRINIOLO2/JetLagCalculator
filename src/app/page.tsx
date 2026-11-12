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
} from 'lucide-react';

type MobileTab = 'DECK' | 'TIMELINE' | 'PLANNER';

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
  const [selectedDayOffset, setSelectedDayOffset] = useState<number | 'ALL'>('ALL');
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});
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

  const getEventIcon = (type: JetLagEvent['type']) => {
    switch (type) {
      case 'SLEEP':
        return <Moon size={20} aria-hidden="true" className="icon moon" />;
      case 'NAP':
        return <BedDouble size={20} aria-hidden="true" className="icon nap" />;
      case 'SEEK_LIGHT':
        return <Sun size={20} aria-hidden="true" className="icon sun" />;
      case 'AVOID_LIGHT':
        return <EyeOff size={20} aria-hidden="true" className="icon avoid" />;
      case 'CAFFEINE':
        return <Coffee size={20} aria-hidden="true" className="icon coffee" />;
      case 'MELATONIN':
        return <Pill size={20} aria-hidden="true" className="icon melatonin" />;
      case 'MEAL':
        return <Utensils size={20} aria-hidden="true" className="icon meal" />;
      case 'FLIGHT':
        return <Plane size={20} aria-hidden="true" className="icon plane" />;
      default:
        return <Calendar size={20} aria-hidden="true" />;
    }
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
    return schedule.filter(e => e.dayOffset === selectedDayOffset);
  }, [schedule, selectedDayOffset]);

  // Determine current active event & next upcoming event for Flight Deck
  const { activeEvents, nextEvent } = useMemo(() => {
    const currentMs = now.getTime();
    const active = schedule.filter(
      e => e.startTime.getTime() <= currentMs && e.endTime.getTime() >= currentMs
    );
    const upcoming = schedule.find(e => e.startTime.getTime() > currentMs) || schedule[0];
    return { activeEvents: active, nextEvent: upcoming };
  }, [schedule, now]);

  const toggleExplanation = (id: string) => {
    setExpandedExplanations(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!mounted) return null;

  let originNowFormatted = '--:--';
  let destNowFormatted = '--:--';
  try {
    originNowFormatted = formatInTimeZone(now, flight.originTimezone, 'EEE h:mm a');
    destNowFormatted = formatInTimeZone(now, flight.destinationTimezone, 'EEE h:mm a');
  } catch {
    // Fallback if invalid timezone string
  }

  return (
    <main className="main-container">
      {/* Top Status & Dual-Clock Bar */}
      <header className="top-bar glass-card">
        <div className="brand-row">
          <div className="brand-left">
            <div className="logo-badge">
              <Plane size={22} aria-hidden="true" className="logo-icon" />
            </div>
            <div>
              <h1>Chrono Healer</h1>
              <p className="subtitle">In-Flight Circadian Companion</p>
            </div>
          </div>

          <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? <Wifi size={14} aria-hidden="true" /> : <WifiOff size={14} aria-hidden="true" />}
            <span>{isOnline ? 'Online Ready' : 'Airplane / Offline Mode'}</span>
          </div>
        </div>

        <div className="dual-clock-strip">
          <div className="clock-box">
            <span className="clock-label">
              Origin · {flight.originCode || flight.originTimezone.split('/').pop()?.replace(/_/g, ' ')}
            </span>
            <strong className="clock-value">{originNowFormatted}</strong>
          </div>
          <div className="shift-pill">
            {phaseSummary.direction === 'NONE'
              ? 'Same Timezone'
              : `${Math.abs(phaseSummary.shiftHours)}h ${
                  phaseSummary.direction === 'EAST' ? 'Eastward Advance' : 'Westward Delay'
                }`}
          </div>
          <div className="clock-box right">
            <span className="clock-label">
              Dest · {flight.destinationCode || flight.destinationTimezone.split('/').pop()?.replace(/_/g, ' ')}
            </span>
            <strong className="clock-value accent-text">{destNowFormatted}</strong>
          </div>
        </div>
      </header>

      {/* Primary Segmented Navigation Bar */}
      <nav className="mode-tabs" aria-label="App Views">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'DECK' ? 'active' : ''}`}
          onClick={() => setActiveTab('DECK')}
        >
          <Clock size={18} aria-hidden="true" />
          <span>Flight Deck</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'TIMELINE' ? 'active' : ''}`}
          onClick={() => setActiveTab('TIMELINE')}
        >
          <Calendar size={18} aria-hidden="true" />
          <span>Timeline ({schedule.length})</span>
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'PLANNER' ? 'active' : ''}`}
          onClick={() => setActiveTab('PLANNER')}
        >
          <Sparkles size={18} aria-hidden="true" />
          <span>Trip Setup</span>
        </button>
      </nav>

      {/* VIEW 1: FLIGHT DECK (IN-FLIGHT LIVE STATUS & DELAY ADJUSTMENT) */}
      {activeTab === 'DECK' && (
        <section className="deck-view">
          <div className="glass-card highlight-card">
            <div className="card-badge-row">
              <span className="live-dot-badge">
                <span className="pulse-dot" /> LIVE CIRCADIAN GUIDANCE
              </span>
              <div className="deck-header-actions">
                <button
                  type="button"
                  onClick={() => setActiveTab('TIMELINE')}
                  className="btn-secondary"
                >
                  <span>Full Schedule</span>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
                <button type="button" onClick={handleExportICS} className="btn-secondary">
                  <Calendar size={15} aria-hidden="true" />
                  <span>Export .ics</span>
                </button>
              </div>
            </div>

            {activeEvents.length > 0 ? (
              <div className="now-events-list">
                <h2>Right Now</h2>
                {activeEvents.map(ev => (
                  <div key={ev.id} className={`active-event-banner ${ev.type.toLowerCase()}`}>
                    <div className="banner-header">
                      {getEventIcon(ev.type)}
                      <div>
                        <h3>{ev.title}</h3>
                        <p className="time-meta">
                          Until{' '}
                          {formatInTimeZone(ev.endTime, ev.displayTimezone, 'h:mm a zzz')} (
                          {Math.max(1, differenceInMinutes(ev.endTime, now))}m left)
                        </p>
                      </div>
                    </div>
                    <p className="banner-desc">{ev.description}</p>
                    <p className="banner-science">
                      <Info size={15} aria-hidden="true" />
                      <span>{ev.explanation}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="now-standby">
                <h2>Between Scheduled Windows</h2>
                <p>
                  Stay hydrated, stretch gently in the cabin or terminal, and follow your next
                  scheduled cue below.
                </p>
              </div>
            )}

            {nextEvent && (
              <div className="next-up-box">
                <span className="next-label">NEXT SCHEDULED ACTION</span>
                <div className="next-row">
                  {getEventIcon(nextEvent.type)}
                  <div className="next-info">
                    <strong>{nextEvent.title}</strong>
                    <span>
                      {formatInTimeZone(
                        nextEvent.startTime,
                        nextEvent.displayTimezone,
                        'EEE, MMM d · h:mm a'
                      )}{' '}
                      ({nextEvent.displayTimezone.split('/').pop()?.replace(/_/g, ' ')})
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mid-Flight Delay / Reroute Card */}
          <div className="glass-card delay-card">
            <div className="section-title-row">
              <AlertTriangle size={20} aria-hidden="true" className="warn-icon" />
              <div>
                <h2>Flight Delayed or Re-routed?</h2>
                <p className="muted-sm">
                  Recalculate your entire circadian timeline offline in one tap.
                </p>
              </div>
            </div>

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
                placeholder="Diverted / New destination airport (optional, e.g. CDG)"
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

          {/* In-Flight Essentials Checklist */}
          <div className="glass-card tips-card">
            <h2>
              <Droplets size={18} aria-hidden="true" /> Essential Flight Wellness Reminders
            </h2>
            <ul className="tips-list">
              <li>
                <strong>Set Watch Immediately:</strong> Switch your phone/watch display to{' '}
                {flight.destinationCode || flight.destinationTimezone} as soon as you board.
              </li>
              <li>
                <strong>Hydration Rule:</strong> Drink ~250ml (8 oz) of water for every hour in the
                air; avoid alcohol, which fragments REM sleep and worsens dehydration.
              </li>
              <li>
                <strong>Adaptation Guideline:</strong> At your selected{' '}
                <strong>{prefs.speed.toLowerCase()}</strong> pace, your body shifts{' '}
                {prefs.speed === 'SLOW' ? '1.0' : prefs.speed === 'FAST' ? '2.0' : '1.5'} hours per
                day across this {Math.abs(phaseSummary.shiftHours)}-hour timezone change.
              </li>
            </ul>
          </div>
        </section>
      )}

      {/* VIEW 2: TIMELINE (DAY-BY-DAY SCHEDULE) */}
      {activeTab === 'TIMELINE' && (
        <section className="timeline-section">
          <div className="timeline-header glass-card">
            <div className="timeline-title-bar">
              <div>
                <h2>Day-by-Day Circadian Protocol</h2>
                <p className="muted-sm">
                  {flight.originCode || flight.originTimezone} →{' '}
                  {flight.destinationCode || flight.destinationTimezone}
                </p>
              </div>
              <button type="button" onClick={handleExportICS} className="btn-secondary">
                <Calendar size={16} aria-hidden="true" />
                <span>Add to Calendar (.ics)</span>
              </button>
            </div>

            {/* Horizontal Day Pills */}
            <div className="day-pills-scroll" role="tablist" aria-label="Filter schedule by day">
              <button
                type="button"
                className={`day-pill ${selectedDayOffset === 'ALL' ? 'active' : ''}`}
                onClick={() => setSelectedDayOffset('ALL')}
              >
                All Days
              </button>
              {uniqueDayOffsets.map(offset => (
                <button
                  key={offset}
                  type="button"
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
            </div>
          </div>

          <div className="timeline">
            {filteredSchedule.map(event => {
              const isExpanded = !!expandedExplanations[event.id];
              let timeRangeStr = '';
              try {
                const startFmt = formatInTimeZone(
                  event.startTime,
                  event.displayTimezone,
                  'EEE, MMM d · h:mm a'
                );
                const endFmt = formatInTimeZone(
                  event.endTime,
                  event.displayTimezone,
                  'h:mm a zzz'
                );
                timeRangeStr = `${startFmt} – ${endFmt}`;
              } catch {
                timeRangeStr = `${format(event.startTime, 'EEE, MMM d · h:mm a')} – ${format(
                  event.endTime,
                  'h:mm a'
                )}`;
              }

              return (
                <div
                  key={event.id}
                  className={`timeline-item ${event.type.toLowerCase()} slide-in`}
                >
                  <div className="timeline-icon-wrapper">
                    {getEventIcon(event.type)}
                    <div className="line-connector" />
                  </div>
                  <div className="timeline-content glass-card">
                    <div className="event-top-row">
                      <span className="day-tag">
                        {event.dayOffset === 0
                          ? 'Flight Day'
                          : event.dayOffset < 0
                            ? `Day ${event.dayOffset}`
                            : `Day +${event.dayOffset}`}
                      </span>
                      <button
                        type="button"
                        className="why-btn"
                        aria-expanded={isExpanded}
                        onClick={() => toggleExplanation(event.id)}
                      >
                        <Info size={14} aria-hidden="true" />
                        <span>{isExpanded ? 'Hide science' : 'Why this matters'}</span>
                      </button>
                    </div>
                    <h3>{event.title}</h3>
                    <p className="time">{timeRangeStr}</p>
                    <p className="event-desc">{event.description}</p>
                    {isExpanded && <div className="science-callout">{event.explanation}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* VIEW 3: TRIP PLANNER & SAVED TRIPS */}
      {activeTab === 'PLANNER' && (
        <div className="planner-grid">
          <section className="form-section glass-card">
            <h2>1. Flight Lookup & Locations</h2>

            {/* Flight Number Quick Fill */}
            <div className="input-group">
              <label htmlFor="flight-num-input">
                Flight Number (Auto-fills Airports & Schedule)
              </label>
              <div className="lookup-bar">
                <input
                  id="flight-num-input"
                  type="text"
                  placeholder="e.g. BA112, UA928, JL5, QF11, SQ23"
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
              </div>
              <div className="preset-chips" role="group" aria-label="Popular Flight Presets">
                {FLIGHT_ROUTE_PRESETS.slice(0, 6).map(p => (
                  <button
                    key={p.flightNumber}
                    type="button"
                    className={`mini-chip ${
                      flightNumberQuery.toUpperCase() === p.flightNumber ? 'active' : ''
                    }`}
                    onClick={() => executeFlightLookup(p.flightNumber)}
                  >
                    {p.flightNumber} ({p.originIata}→{p.destinationIata})
                  </button>
                ))}
              </div>
              {lookupStatus && <p className="feedback-text">{lookupStatus}</p>}
            </div>

            <form onSubmit={handleGenerateAndSave}>
              <div className="location-pair-group">
                <div className="input-group">
                  <label htmlFor="origin-tz-input">Origin Airport / City / Timezone</label>
                  <input
                    id="origin-tz-input"
                    list="locations-datalist"
                    placeholder="Search IATA code or city (e.g. JFK, New York, Tokyo)"
                    value={originInput}
                    onChange={e => setOriginInput(e.target.value)}
                  />
                  <p className="feedback-text">
                    <MapPin size={12} aria-hidden="true" />
                    <span>
                      IANA Zone: {resolveTimezone(originInput, flight.originTimezone)}
                    </span>
                  </p>
                </div>

                <div className="swap-row">
                  <button
                    type="button"
                    className="btn-secondary swap-btn"
                    onClick={handleSwapLocations}
                  >
                    <ArrowLeftRight size={15} aria-hidden="true" />
                    <span>Swap Origin & Destination</span>
                  </button>
                </div>

                <div className="input-group">
                  <label htmlFor="dest-tz-input">Destination Airport / City / Timezone</label>
                  <input
                    id="dest-tz-input"
                    list="locations-datalist"
                    placeholder="Search IATA code or city (e.g. LHR, London, HND)"
                    value={destInput}
                    onChange={e => setDestInput(e.target.value)}
                  />
                  <p className="feedback-text">
                    <MapPin size={12} aria-hidden="true" />
                    <span>
                      IANA Zone: {resolveTimezone(destInput, flight.destinationTimezone)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="row datetime-row">
                <div className="input-group half">
                  <label htmlFor="dep-datetime-input">
                    Departure (Local Origin Time)
                  </label>
                  <input
                    id="dep-datetime-input"
                    type="datetime-local"
                    value={flight.departureTimeLocal.slice(0, 16)}
                    onChange={e => setFlight({ ...flight, departureTimeLocal: e.target.value })}
                  />
                </div>

                <div className="input-group half">
                  <label htmlFor="arr-datetime-input">
                    Arrival (Local Destination Time)
                  </label>
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

              <div className="divider" />

              <h2>2. Personal Circadian Profile</h2>

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

              <div className="input-group">
                <label htmlFor="strategy-select">Pre-Flight Adjustment Strategy</label>
                <select
                  id="strategy-select"
                  value={prefs.strategy}
                  onChange={e =>
                    setPrefs({ ...prefs, strategy: e.target.value as AdjustmentStrategy })
                  }
                >
                  <option value="PRE_FLIGHT">
                    Start adjusting before departure (up to 3 days prior)
                  </option>
                  <option value="ARRIVAL_ONLY">
                    Adjust entirely upon departure/arrival (short trips)
                  </option>
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="speed-select">Adaptation Speed</label>
                <select
                  id="speed-select"
                  value={prefs.speed}
                  onChange={e => setPrefs({ ...prefs, speed: e.target.value as AdaptationSpeed })}
                >
                  <option value="SLOW">Gentle / Slow (1.0 hour shift per day)</option>
                  <option value="AVERAGE">Balanced / Average (1.5 hours shift per day)</option>
                  <option value="FAST">Aggressive / Fast (2.0 hours shift per day)</option>
                </select>
              </div>

              <div className="toggles-grid">
                <label className="toggle-card">
                  <input
                    type="checkbox"
                    checked={prefs.useMelatonin}
                    onChange={e => setPrefs({ ...prefs, useMelatonin: e.target.checked })}
                  />
                  <div className="toggle-text">
                    <strong>Include Melatonin</strong>
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
                    <span>Morning alertness window + strict sleep cutoff</span>
                  </div>
                </label>
              </div>

              <button type="submit" className="btn-primary">
                Save Trip & Open Flight Deck
              </button>
            </form>
          </section>

          {/* Saved Trips Offline Drawer */}
          <aside className="saved-trips-section glass-card">
            <div className="section-title-row">
              <Bookmark size={20} aria-hidden="true" />
              <div>
                <h2>Saved Offline Trips</h2>
                <p className="muted-sm">
                  Stored on your device so you can open or adjust them mid-flight without Wi-Fi.
                </p>
              </div>
            </div>

            {savedTrips.length === 0 ? (
              <p className="muted-sm">
                No saved trips yet. Tap &ldquo;Save Trip &amp; Open Flight Deck&rdquo; to store
                your itinerary for offline access.
              </p>
            ) : (
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
                      className="delete-trip-btn icon-button"
                      aria-label={`Delete ${trip.name}`}
                      onClick={() => handleDeleteTrip(trip.id)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

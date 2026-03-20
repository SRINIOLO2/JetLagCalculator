'use client';
import { useState, useEffect } from 'react';
import { generateJetLagSchedule, FlightDetails, UserPreferences, JetLagEvent } from '@/utils/jetLagAlgorithm';
import { generateICS } from '@/utils/icsGenerator';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Sun, Moon, Coffee, Plane, EyeOff, Calendar, MapPin } from 'lucide-react';

export default function Home() {
  const [timezoneOptions, setTimezoneOptions] = useState<{value: string, label: string}[]>([]);

  const [flight, setFlight] = useState<FlightDetails>({
    departureTime: new Date(new Date().setHours(18, 0, 0, 0)).toISOString(),
    arrivalTime: new Date(new Date(new Date().getTime() + 86400000).setHours(6, 0, 0, 0)).toISOString(),
    originTimezone: 'America/New_York',
    destinationTimezone: 'Europe/London',
  });

  const [originInput, setOriginInput] = useState('(UTC-05:00) America/New_York');
  const [destInput, setDestInput] = useState('(UTC+00:00) Europe/London');

  const [prefs, setPrefs] = useState<UserPreferences>({
    normalBedtime: '23:00',
    normalWakeTime: '07:00'
  });

  const [schedule, setSchedule] = useState<JetLagEvent[]>([]);

  // Prevent hydration errors by not rendering client-only date formats immediately
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Generate a comprehensive list of all timezones and format them as (UTC+/-XX:XX) Region/City
    const options = Intl.supportedValuesOf('timeZone').map(tz => {
      try {
        const offset = formatInTimeZone(new Date(), tz, 'xxx');
        return { value: tz, label: `(UTC${offset}) ${tz}` };
      } catch (e) {
        return { value: tz, label: tz };
      }
    }).sort((a, b) => a.label.localeCompare(b.label));
    setTimezoneOptions(options);
  }, []);

  // Attempt to map the inputted timezone string back to the IANA timezone value
  const resolveTz = (input: string, fallback: string) => {
    const match = timezoneOptions.find(t => t.label.toLowerCase() === input.toLowerCase());
    return match ? match.value : fallback;
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();

    const updatedFlight = {
      ...flight,
      originTimezone: resolveTz(originInput, flight.originTimezone),
      destinationTimezone: resolveTz(destInput, flight.destinationTimezone)
    };
    
    // Note: Daylight Savings Time (DST) is inherently respected by the algorithm 
    // because it uses date-fns-tz's getTimezoneOffset which evaluates the offset 
    // based on the historical/future specific flight departure or arrival date.
    const events = generateJetLagSchedule(updatedFlight, prefs);
    setSchedule(events);
  };

  const handleExportICS = () => {
    if (schedule.length === 0) return;
    const icsString = generateICS(schedule);
    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'jet-lag-schedule.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'SLEEP': return <Moon size={24} className="icon moon" />;
      case 'SEEK_LIGHT': return <Sun size={24} className="icon sun" />;
      case 'AVOID_LIGHT': return <EyeOff size={24} className="icon avoid" />;
      case 'CAFFEINE': return <Coffee size={24} className="icon coffee" />;
      case 'FLIGHT': return <Plane size={24} className="icon plane" />;
      default: return <Calendar size={24} />;
    }
  };

  if (!mounted) return null;

  return (
    <main className="main-container">
      <header className="header">
        <div className="logo">
          <Plane size={36} className="logo-icon" />
        </div>
        <h1>Chrono Healer</h1>
        <p>Intelligently schedule sleep, light, and caffeine to beat jet lag.</p>
      </header>

      <div className="content-grid">
        <section className="form-section glass-card">
          <h2>Flight Itinerary</h2>
          <form onSubmit={handleGenerate}>
            <div className="input-group">
              <label>Departure Time</label>
              <input type="datetime-local" value={flight.departureTime.slice(0, 16)} onChange={e => setFlight({...flight, departureTime: new Date(e.target.value).toISOString()})} />
            </div>
            <div className="input-group">
              <label>Origin Timezone</label>
              <input 
                list="timezones-list" 
                placeholder="Search for a timezone (e.g. America/Los_Angeles)"
                value={originInput}
                onChange={e => setOriginInput(e.target.value)}
              />
              <p className="feedback-text"><MapPin size={12}/> {resolveTz(originInput, 'Unknown')}</p>
            </div>
            <div className="input-group mt-2">
              <label>Arrival Time</label>
              <input type="datetime-local" value={flight.arrivalTime.slice(0, 16)} onChange={e => setFlight({...flight, arrivalTime: new Date(e.target.value).toISOString()})} />
            </div>
            <div className="input-group">
              <label>Destination Timezone</label>
              <input 
                list="timezones-list" 
                placeholder="Search for a timezone (e.g. Europe/London)"
                value={destInput}
                onChange={e => setDestInput(e.target.value)}
              />
              <p className="feedback-text"><MapPin size={12}/> {resolveTz(destInput, 'Unknown')}</p>
            </div>
            
            <datalist id="timezones-list">
              {timezoneOptions.map(tz => (
                <option key={tz.value} value={tz.label} />
              ))}
            </datalist>
            
            <div className="divider"></div>
            
            <h2>Your Routine</h2>
            <div className="row">
              <div className="input-group half">
                <label>Bedtime</label>
                <input type="time" value={prefs.normalBedtime} onChange={e => setPrefs({...prefs, normalBedtime: e.target.value})} />
              </div>
              <div className="input-group half">
                <label>Wake Time</label>
                <input type="time" value={prefs.normalWakeTime} onChange={e => setPrefs({...prefs, normalWakeTime: e.target.value})} />
              </div>
            </div>

            <button type="submit" className="btn-primary">
              Generate Protocol
            </button>
          </form>
        </section>

        <section className="timeline-section">
          {schedule.length > 0 ? (
            <>
              <div className="timeline-header flex justify-between">
                <h2>Your Protocol</h2>
                <button onClick={handleExportICS} className="btn-secondary"><Calendar size={16}/> Add to Calendar</button>
              </div>
              <div className="timeline">
                {schedule.map((event, index) => (
                  <div key={`${event.id}-${index}`} className={`timeline-item ${event.type.toLowerCase()} slide-in`} style={{animationDelay: `${index * 0.05}s`}}>
                    <div className="timeline-icon-wrapper">
                      {getIcon(event.type)}
                      <div className="line-connector"></div>
                    </div>
                    <div className="timeline-content glass-card">
                      <h3>{event.description}</h3>
                      <p className="time">
                        {format(event.startTime, 'E, MMM d')} &middot; {format(event.startTime, 'h:mm a')} – {format(event.endTime, 'h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state glass-card">
              <Plane size={48} className="empty-icon" />
              <h3>Ready for Takeoff</h3>
              <p>Enter your flight details to generate your personalized circadian rhythm protocol.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

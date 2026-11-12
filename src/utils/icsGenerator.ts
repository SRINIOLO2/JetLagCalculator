import { EventType, JetLagEvent } from './jetLagAlgorithm';

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const EVENT_EMOJI: Record<EventType, string> = {
  SLEEP: '🛏️',
  NAP: '🛋️',
  SEEK_LIGHT: '☀️',
  AVOID_LIGHT: '🕶️',
  CAFFEINE: '☕',
  MELATONIN: '💊',
  MEAL: '🍽️',
  FLIGHT: '✈️',
};

export function generateICS(events: JetLagEvent[], tripName = 'Jet Lag Protocol'): string {
  const safeName = escapeICSText(`Chrono Healer - ${tripName}`);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chrono Healer//Jet Lag Calculator v2.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${safeName}`,
  ];

  const dtStamp = formatICSDate(new Date());

  for (const event of events) {
    const emoji = EVENT_EMOJI[event.type] || '📅';
    const summary = escapeICSText(`${emoji} ${event.title || event.description}`);
    const fullDescription = escapeICSText(
      `${event.description}\n\nWhy this matters: ${event.explanation}`
    );

    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}-${event.startTime.getTime()}@chronohealer.local`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${formatICSDate(event.startTime)}`,
      `DTEND:${formatICSDate(event.endTime)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${fullDescription}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:${summary}`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

import { JetLagEvent } from './jetLagAlgorithm';

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export function generateICS(events: JetLagEvent[]): string {
  let icsData = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Chrono Healer//Jet Lag Calculator//EN\nCALSCALE:GREGORIAN\n";

  events.forEach(event => {
    icsData += "BEGIN:VEVENT\n";
    icsData += `UID:${event.id}@chronohealer.com\n`;
    icsData += `DTSTAMP:${formatICSDate(new Date())}\n`;
    icsData += `DTSTART:${formatICSDate(event.startTime)}\n`;
    icsData += `DTEND:${formatICSDate(event.endTime)}\n`;
    
    // Add emojis to summaries for better visibility in Google Calendar
    let summary = event.description;
    switch(event.type) {
      case 'SLEEP': summary = `🛏️ ${summary}`; break;
      case 'SEEK_LIGHT': summary = `☀️ ${summary}`; break;
      case 'AVOID_LIGHT': summary = `🕶️ ${summary}`; break;
      case 'CAFFEINE': summary = `☕ ${summary}`; break;
      case 'FLIGHT': summary = `✈️ ${summary}`; break;
    }
    
    icsData += `SUMMARY:${summary}\n`;
    icsData += `DESCRIPTION:Chrono Healer Jet Lag Itinerary\n`;
    icsData += "END:VEVENT\n";
  });

  icsData += "END:VCALENDAR";
  return icsData;
}

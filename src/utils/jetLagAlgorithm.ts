import { addDays, subDays, isBefore, isAfter, parseISO, format, differenceInHours, addHours, subHours } from 'date-fns';
import { formatInTimeZone, getTimezoneOffset } from 'date-fns-tz';

export type EventType = 'SLEEP' | 'SEEK_LIGHT' | 'AVOID_LIGHT' | 'CAFFEINE' | 'FLIGHT' | 'FLIGHT_ARRIVAL';

export interface JetLagEvent {
  id: string;
  type: EventType;
  startTime: Date;
  endTime: Date;
  description: string;
}

export interface FlightDetails {
  departureTime: string; // ISO String
  arrivalTime: string; // ISO String
  originTimezone: string;
  destinationTimezone: string;
}

export interface UserPreferences {
  normalBedtime: string; // "HH:mm" format (24h)
  normalWakeTime: string; // "HH:mm" format (24h)
}

function getOffsetHours(date: Date, tz: string) {
  // getTimezoneOffset returns ms
  return getTimezoneOffset(tz, date) / (1000 * 60 * 60);
}

export function generateJetLagSchedule(flight: FlightDetails, prefs: UserPreferences): JetLagEvent[] {
  const depTime = new Date(flight.departureTime);
  const arrTime = new Date(flight.arrivalTime);
  
  const originOffset = getOffsetHours(depTime, flight.originTimezone);
  const destOffset = getOffsetHours(depTime, flight.destinationTimezone);
  
  const tzDifference = destOffset - originOffset;
  const isEastward = tzDifference > 0;
  
  const events: JetLagEvent[] = [];
  
  // Basic conflict resolution regions (Boarding and Landing)
  const boardingStart = subHours(depTime, 1);
  const boardingEnd = addHours(depTime, 1);
  const landingStart = subHours(arrTime, 1);
  const landingEnd = addHours(arrTime, 1);

  // Flight Event
  events.push({
    id: `flight-dep`,
    type: 'FLIGHT',
    startTime: depTime,
    endTime: arrTime,
    description: `Flight from ${flight.originTimezone} to ${flight.destinationTimezone}`,
  });

  // Simplified logic block demonstrating phase shift rules:
  // In a full timeshifter, we linearly shift the bedtime towards destination timezone over days.
  const shiftDays = Math.min(Math.abs(tzDifference), 3); // Shift up to 3 days pre-flight
  
  for (let i = shiftDays; i >= -2; i--) {
    // i > 0: Pre-flight. i == 0: Travel day. i < 0: Post-flight.
    const currentDay = subDays(depTime, i);
    
    // Parse normal bedtime today
    const [bedH, bedM] = prefs.normalBedtime.split(':').map(Number);
    const [wakeH, wakeM] = prefs.normalWakeTime.split(':').map(Number);
    
    // Base sleep time in origin time
    let sleepDate = new Date(currentDay);
    sleepDate.setHours(bedH, bedM, 0, 0);
    // If bedtime is early morning, it might roll over to next day, but simplify for now.
    
    let wakeDate = addDays(new Date(currentDay), 1);
    wakeDate.setHours(wakeH, wakeM, 0, 0);

    // Shift logic: Eastward: bed earlier, wake earlier. Westward: bed later, wake later.
    // We adjust by 1 hour per day of shift limit.
    let shiftAmount = isEastward ? -1 : 1; 
    let dailyShift = shiftAmount * (shiftDays - i + 1); 
    
    // Once in destination or on travel day, jump straight to destination time for simplicity,
    // or keep shifting.
    if (i <= 0) {
      // Just map to destination time base
      sleepDate = addHours(sleepDate, tzDifference);
      wakeDate = addHours(wakeDate, tzDifference);
    } else {
      sleepDate = addHours(sleepDate, dailyShift);
      wakeDate = addHours(wakeDate, dailyShift);
    }
    
    // Basic conflict detection with flight bounds
    if (isBefore(sleepDate, boardingEnd) && isAfter(wakeDate, boardingStart)) {
      // Shift sleep off boarding
      sleepDate = boardingEnd;
    }
    if (isBefore(sleepDate, landingEnd) && isAfter(wakeDate, landingStart)) {
      wakeDate = landingStart;
    }
    
    // Only add sleep event if valid length
    if (isBefore(sleepDate, wakeDate) && differenceInHours(wakeDate, sleepDate) > 2) {
      const sleepHours = differenceInHours(wakeDate, sleepDate);
      events.push({
        id: `sleep-${i}`,
        type: 'SLEEP',
        startTime: sleepDate,
        endTime: wakeDate,
        description: `Recommended Sleep (${Math.abs(i)} days ${i > 0 ? 'before' : 'after'}) - ${sleepHours} hours`,
      });
      
      // Light seeking based on direction
      if (isEastward) {
        // Seek morning light
        events.push({
          id: `light-${i}`,
          type: 'SEEK_LIGHT',
          startTime: wakeDate,
          endTime: addHours(wakeDate, 2),
          description: 'Seek bright light to advance clock',
        });
      } else {
        // Seek evening light (before sleep)
        events.push({
          id: `light-${i}`,
          type: 'SEEK_LIGHT',
          startTime: subHours(sleepDate, 3),
          endTime: sleepDate,
          description: 'Seek bright light to delay clock',
        });
      }
      
      // Caffeine
      events.push({
        id: `caffeine-${i}`,
        type: 'CAFFEINE',
        startTime: wakeDate,
        endTime: addHours(wakeDate, 4),
        description: 'Strategic Caffeine',
      });
      
      // Avoid light
      events.push({
        id: `avoid-light-${i}`,
        type: 'AVOID_LIGHT',
        startTime: subHours(sleepDate, 3),
        endTime: sleepDate,
        description: 'Avoid light / wear sunglasses',
      });
    }
  }

  return events.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}

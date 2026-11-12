export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
  tz: string;
}

export const OFFLINE_AIRPORTS: Airport[] = [
  // North America
  { iata: 'JFK', name: 'John F. Kennedy International', city: 'New York', country: 'USA', tz: 'America/New_York' },
  { iata: 'EWR', name: 'Newark Liberty International', city: 'New York / Newark', country: 'USA', tz: 'America/New_York' },
  { iata: 'LGA', name: 'LaGuardia', city: 'New York', country: 'USA', tz: 'America/New_York' },
  { iata: 'BOS', name: 'Logan International', city: 'Boston', country: 'USA', tz: 'America/New_York' },
  { iata: 'IAD', name: 'Washington Dulles International', city: 'Washington D.C.', country: 'USA', tz: 'America/New_York' },
  { iata: 'DCA', name: 'Ronald Reagan Washington National', city: 'Washington D.C.', country: 'USA', tz: 'America/New_York' },
  { iata: 'MIA', name: 'Miami International', city: 'Miami', country: 'USA', tz: 'America/New_York' },
  { iata: 'ATL', name: 'Hartsfield-Jackson Atlanta International', city: 'Atlanta', country: 'USA', tz: 'America/New_York' },
  { iata: 'MCO', name: 'Orlando International', city: 'Orlando', country: 'USA', tz: 'America/New_York' },
  { iata: 'CLT', name: 'Charlotte Douglas International', city: 'Charlotte', country: 'USA', tz: 'America/New_York' },
  { iata: 'PHL', name: 'Philadelphia International', city: 'Philadelphia', country: 'USA', tz: 'America/New_York' },
  { iata: 'DTW', name: 'Detroit Metropolitan', city: 'Detroit', country: 'USA', tz: 'America/Detroit' },
  { iata: 'ORD', name: "O'Hare International", city: 'Chicago', country: 'USA', tz: 'America/Chicago' },
  { iata: 'DFW', name: 'Dallas/Fort Worth International', city: 'Dallas', country: 'USA', tz: 'America/Chicago' },
  { iata: 'IAH', name: 'George Bush Intercontinental', city: 'Houston', country: 'USA', tz: 'America/Chicago' },
  { iata: 'MSP', name: 'Minneapolis–Saint Paul International', city: 'Minneapolis', country: 'USA', tz: 'America/Chicago' },
  { iata: 'AUS', name: 'Austin-Bergstrom International', city: 'Austin', country: 'USA', tz: 'America/Chicago' },
  { iata: 'DEN', name: 'Denver International', city: 'Denver', country: 'USA', tz: 'America/Denver' },
  { iata: 'SLC', name: 'Salt Lake City International', city: 'Salt Lake City', country: 'USA', tz: 'America/Denver' },
  { iata: 'PHX', name: 'Phoenix Sky Harbor International', city: 'Phoenix', country: 'USA', tz: 'America/Phoenix' },
  { iata: 'LAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'USA', tz: 'America/Los_Angeles' },
  { iata: 'SFO', name: 'San Francisco International', city: 'San Francisco', country: 'USA', tz: 'America/Los_Angeles' },
  { iata: 'SEA', name: 'Seattle-Tacoma International', city: 'Seattle', country: 'USA', tz: 'America/Los_Angeles' },
  { iata: 'SAN', name: 'San Diego International', city: 'San Diego', country: 'USA', tz: 'America/Los_Angeles' },
  { iata: 'LAS', name: 'Harry Reid International', city: 'Las Vegas', country: 'USA', tz: 'America/Los_Angeles' },
  { iata: 'PDX', name: 'Portland International', city: 'Portland', country: 'USA', tz: 'America/Los_Angeles' },
  { iata: 'ANC', name: 'Ted Stevens Anchorage International', city: 'Anchorage', country: 'USA', tz: 'America/Anchorage' },
  { iata: 'HNL', name: 'Daniel K. Inouye International', city: 'Honolulu', country: 'USA', tz: 'Pacific/Honolulu' },
  { iata: 'YYZ', name: 'Toronto Pearson International', city: 'Toronto', country: 'Canada', tz: 'America/Toronto' },
  { iata: 'YUL', name: 'Montréal-Trudeau International', city: 'Montreal', country: 'Canada', tz: 'America/Toronto' },
  { iata: 'YVR', name: 'Vancouver International', city: 'Vancouver', country: 'Canada', tz: 'America/Vancouver' },
  { iata: 'YYC', name: 'Calgary International', city: 'Calgary', country: 'Canada', tz: 'America/Edmonton' },
  { iata: 'MEX', name: 'Mexico City International', city: 'Mexico City', country: 'Mexico', tz: 'America/Mexico_City' },
  { iata: 'CUN', name: 'Cancún International', city: 'Cancun', country: 'Mexico', tz: 'America/Cancun' },

  // Europe
  { iata: 'LHR', name: 'Heathrow', city: 'London', country: 'UK', tz: 'Europe/London' },
  { iata: 'LGW', name: 'Gatwick', city: 'London', country: 'UK', tz: 'Europe/London' },
  { iata: 'STN', name: 'Stansted', city: 'London', country: 'UK', tz: 'Europe/London' },
  { iata: 'MAN', name: 'Manchester', city: 'Manchester', country: 'UK', tz: 'Europe/London' },
  { iata: 'EDI', name: 'Edinburgh', city: 'Edinburgh', country: 'UK', tz: 'Europe/London' },
  { iata: 'DUB', name: 'Dublin', city: 'Dublin', country: 'Ireland', tz: 'Europe/Dublin' },
  { iata: 'CDG', name: 'Charles de Gaulle', city: 'Paris', country: 'France', tz: 'Europe/Paris' },
  { iata: 'ORY', name: 'Orly', city: 'Paris', country: 'France', tz: 'Europe/Paris' },
  { iata: 'NCE', name: "Nice Côte d'Azur", city: 'Nice', country: 'France', tz: 'Europe/Paris' },
  { iata: 'AMS', name: 'Schiphol', city: 'Amsterdam', country: 'Netherlands', tz: 'Europe/Amsterdam' },
  { iata: 'FRA', name: 'Frankfurt', city: 'Frankfurt', country: 'Germany', tz: 'Europe/Berlin' },
  { iata: 'MUC', name: 'Munich', city: 'Munich', country: 'Germany', tz: 'Europe/Berlin' },
  { iata: 'BER', name: 'Berlin Brandenburg', city: 'Berlin', country: 'Germany', tz: 'Europe/Berlin' },
  { iata: 'ZRH', name: 'Zurich', city: 'Zurich', country: 'Switzerland', tz: 'Europe/Zurich' },
  { iata: 'GVA', name: 'Geneva', city: 'Geneva', country: 'Switzerland', tz: 'Europe/Zurich' },
  { iata: 'VIE', name: 'Vienna International', city: 'Vienna', country: 'Austria', tz: 'Europe/Vienna' },
  { iata: 'BRU', name: 'Brussels', city: 'Brussels', country: 'Belgium', tz: 'Europe/Brussels' },
  { iata: 'MAD', name: 'Adolfo Suárez Madrid–Barajas', city: 'Madrid', country: 'Spain', tz: 'Europe/Madrid' },
  { iata: 'BCN', name: ' Josep Tarradellas Barcelona–El Prat', city: 'Barcelona', country: 'Spain', tz: 'Europe/Madrid' },
  { iata: 'LIS', name: 'Humberto Delgado', city: 'Lisbon', country: 'Portugal', tz: 'Europe/Lisbon' },
  { iata: 'FCO', name: 'Leonardo da Vinci–Fiumicino', city: 'Rome', country: 'Italy', tz: 'Europe/Rome' },
  { iata: 'MXP', name: 'Milan Malpensa', city: 'Milan', country: 'Italy', tz: 'Europe/Rome' },
  { iata: 'ATH', name: 'Athens International', city: 'Athens', country: 'Greece', tz: 'Europe/Athens' },
  { iata: 'IST', name: 'Istanbul', city: 'Istanbul', country: 'Turkey', tz: 'Europe/Istanbul' },
  { iata: 'CPH', name: 'Copenhagen', city: 'Copenhagen', country: 'Denmark', tz: 'Europe/Copenhagen' },
  { iata: 'ARN', name: 'Stockholm Arlanda', city: 'Stockholm', country: 'Sweden', tz: 'Europe/Stockholm' },
  { iata: 'OSL', name: 'Oslo Gardermoen', city: 'Oslo', country: 'Norway', tz: 'Europe/Oslo' },
  { iata: 'HEL', name: 'Helsinki-Vantaa', city: 'Helsinki', country: 'Finland', tz: 'Europe/Helsinki' },
  { iata: 'WAW', name: 'Warsaw Chopin', city: 'Warsaw', country: 'Poland', tz: 'Europe/Warsaw' },
  { iata: 'PRG', name: 'Václav Havel Airport Prague', city: 'Prague', country: 'Czechia', tz: 'Europe/Prague' },
  { iata: 'BUD', name: 'Budapest Ferenc Liszt', city: 'Budapest', country: 'Hungary', tz: 'Europe/Budapest' },
  { iata: 'KEF', name: 'Keflavík International', city: 'Reykjavik', country: 'Iceland', tz: 'Atlantic/Reykjavik' },

  // Asia-Pacific
  { iata: 'HND', name: 'Tokyo Haneda', city: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo' },
  { iata: 'NRT', name: 'Narita International', city: 'Tokyo', country: 'Japan', tz: 'Asia/Tokyo' },
  { iata: 'KIX', name: 'Kansai International', city: 'Osaka', country: 'Japan', tz: 'Asia/Tokyo' },
  { iata: 'ICN', name: 'Incheon International', city: 'Seoul', country: 'South Korea', tz: 'Asia/Seoul' },
  { iata: 'GMP', name: 'Gimpo International', city: 'Seoul', country: 'South Korea', tz: 'Asia/Seoul' },
  { iata: 'TPE', name: 'Taiwan Taoyuan International', city: 'Taipei', country: 'Taiwan', tz: 'Asia/Taipei' },
  { iata: 'HKG', name: 'Hong Kong International', city: 'Hong Kong', country: 'Hong Kong', tz: 'Asia/Hong_Kong' },
  { iata: 'PVG', name: 'Shanghai Pudong International', city: 'Shanghai', country: 'China', tz: 'Asia/Shanghai' },
  { iata: 'PEK', name: 'Beijing Capital International', city: 'Beijing', country: 'China', tz: 'Asia/Shanghai' },
  { iata: 'CAN', name: 'Guangzhou Baiyun International', city: 'Guangzhou', country: 'China', tz: 'Asia/Shanghai' },
  { iata: 'SIN', name: 'Changi', city: 'Singapore', country: 'Singapore', tz: 'Asia/Singapore' },
  { iata: 'BKK', name: 'Suvarnabhumi', city: 'Bangkok', country: 'Thailand', tz: 'Asia/Bangkok' },
  { iata: 'KUL', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia', tz: 'Asia/Kuala_Lumpur' },
  { iata: 'CGK', name: 'Soekarno–Hatta International', city: 'Jakarta', country: 'Indonesia', tz: 'Asia/Jakarta' },
  { iata: 'DPS', name: 'I Gusti Ngurah Rai International', city: 'Bali / Denpasar', country: 'Indonesia', tz: 'Asia/Makassar' },
  { iata: 'MNL', name: 'Ninoy Aquino International', city: 'Manila', country: 'Philippines', tz: 'Asia/Manila' },
  { iata: 'SGN', name: 'Tan Son Nhat International', city: 'Ho Chi Minh City', country: 'Vietnam', tz: 'Asia/Ho_Chi_Minh' },
  { iata: 'HAN', name: 'Noi Bai International', city: 'Hanoi', country: 'Vietnam', tz: 'Asia/Bangkok' },
  { iata: 'DEL', name: 'Indira Gandhi International', city: 'New Delhi', country: 'India', tz: 'Asia/Kolkata' },
  { iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj International', city: 'Mumbai', country: 'India', tz: 'Asia/Kolkata' },
  { iata: 'BLR', name: 'Kempegowda International', city: 'Bengaluru', country: 'India', tz: 'Asia/Kolkata' },
  { iata: 'SYD', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', tz: 'Australia/Sydney' },
  { iata: 'MEL', name: 'Melbourne', city: 'Melbourne', country: 'Australia', tz: 'Australia/Melbourne' },
  { iata: 'BNE', name: 'Brisbane', city: 'Brisbane', country: 'Australia', tz: 'Australia/Brisbane' },
  { iata: 'PER', name: 'Perth', city: 'Perth', country: 'Australia', tz: 'Australia/Perth' },
  { iata: 'AKL', name: 'Auckland', city: 'Auckland', country: 'New Zealand', tz: 'Pacific/Auckland' },

  // Middle East & Africa
  { iata: 'DXB', name: 'Dubai International', city: 'Dubai', country: 'UAE', tz: 'Asia/Dubai' },
  { iata: 'AUH', name: 'Zayed International', city: 'Abu Dhabi', country: 'UAE', tz: 'Asia/Dubai' },
  { iata: 'DOH', name: 'Hamad International', city: 'Doha', country: 'Qatar', tz: 'Asia/Qatar' },
  { iata: 'TLV', name: 'Ben Gurion', city: 'Tel Aviv', country: 'Israel', tz: 'Asia/Jerusalem' },
  { iata: 'RUH', name: 'King Khalid International', city: 'Riyadh', country: 'Saudi Arabia', tz: 'Asia/Riyadh' },
  { iata: 'JED', name: 'King Abdulaziz International', city: 'Jeddah', country: 'Saudi Arabia', tz: 'Asia/Riyadh' },
  { iata: 'CAI', name: 'Cairo International', city: 'Cairo', country: 'Egypt', tz: 'Africa/Cairo' },
  { iata: 'CMN', name: 'Mohammed V International', city: 'Casablanca', country: 'Morocco', tz: 'Africa/Casablanca' },
  { iata: 'JNB', name: 'O. R. Tambo International', city: 'Johannesburg', country: 'South Africa', tz: 'Africa/Johannesburg' },
  { iata: 'CPT', name: 'Cape Town International', city: 'Cape Town', country: 'South Africa', tz: 'Africa/Johannesburg' },
  { iata: 'NBO', name: 'Jomo Kenyatta International', city: 'Nairobi', country: 'Kenya', tz: 'Africa/Nairobi' },

  // South America
  { iata: 'GRU', name: 'São Paulo/Guarulhos International', city: 'Sao Paulo', country: 'Brazil', tz: 'America/Sao_Paulo' },
  { iata: 'GIG', name: 'Rio de Janeiro/Galeão International', city: 'Rio de Janeiro', country: 'Brazil', tz: 'America/Sao_Paulo' },
  { iata: 'EZE', name: 'Ministro Pistarini International', city: 'Buenos Aires', country: 'Argentina', tz: 'America/Argentina/Buenos_Aires' },
  { iata: 'SCL', name: 'Arturo Merino Benítez International', city: 'Santiago', country: 'Chile', tz: 'America/Santiago' },
  { iata: 'BOG', name: 'El Dorado International', city: 'Bogota', country: 'Colombia', tz: 'America/Bogota' },
  { iata: 'LIM', name: 'Jorge Chávez International', city: 'Lima', country: 'Peru', tz: 'America/Lima' },
];

export function formatAirportLabel(airport: Airport): string {
  return `${airport.iata} - ${airport.city} (${airport.tz})`;
}

export function findAirportByIata(iata: string): Airport | undefined {
  const code = iata.trim().toUpperCase();
  return OFFLINE_AIRPORTS.find(a => a.iata === code);
}

export function searchLocations(query: string, extraTimezones: string[] = []): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return OFFLINE_AIRPORTS.slice(0, 25);

  const exactIata = OFFLINE_AIRPORTS.filter(a => a.iata.toLowerCase() === q);
  const partialMatches = OFFLINE_AIRPORTS.filter(
    a =>
      a.iata.toLowerCase() !== q &&
      (a.iata.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.country.toLowerCase().includes(q) ||
        a.tz.toLowerCase().includes(q))
  );

  const results = [...exactIata, ...partialMatches];

  if (results.length < 15) {
    const tzs =
      extraTimezones.length > 0
        ? extraTimezones
        : typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function'
          ? Intl.supportedValuesOf('timeZone')
          : [];

    for (const tz of tzs) {
      if (tz.toLowerCase().includes(q) && !results.some(r => r.tz === tz)) {
        const cityPart = tz.split('/').pop()?.replace(/_/g, ' ') || tz;
        results.push({
          iata: tz.slice(0, 3).toUpperCase(),
          name: `${cityPart} Timezone`,
          city: cityPart,
          country: tz.split('/')[0] || 'Global',
          tz,
        });
        if (results.length >= 25) break;
      }
    }
  }

  return results.slice(0, 25);
}

export function resolveTimezone(input: string, fallback = 'UTC'): string {
  const raw = input.trim();
  if (!raw) return fallback;

  // 1. Check if formatted as "... (Region/City)"
  const parenMatch = raw.match(/\(([A-Za-z0-9_+-]+\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?)\)/);
  if (parenMatch) {
    return parenMatch[1];
  }

  // 2. Check if formatted as "(UTC+XX:XX) Region/City"
  const utcPrefixMatch = raw.match(/^\(UTC[+-]\d{2}:\d{2}\)\s+(.+)$/i);
  if (utcPrefixMatch) {
    return utcPrefixMatch[1].trim();
  }

  // 3. Check 3-letter IATA code or "JFK - ..."
  const iataPrefix = raw.match(/^([A-Za-z]{3})(?:\s*-\s*|$)/);
  if (iataPrefix) {
    const found = findAirportByIata(iataPrefix[1]);
    if (found) return found.tz;
  }

  // 4. Direct match on city or airport in OFFLINE_AIRPORTS
  const lower = raw.toLowerCase();
  const byAirport = OFFLINE_AIRPORTS.find(
    a =>
      a.iata.toLowerCase() === lower ||
      a.city.toLowerCase() === lower ||
      formatAirportLabel(a).toLowerCase() === lower
  );
  if (byAirport) return byAirport.tz;

  // 5. Direct valid IANA timezone check
  if (raw.includes('/')) {
    return raw;
  }

  return fallback;
}

# Chrono Healer v2.0 — In-Flight Circadian & Jet Lag Companion ✈️⏱️

Chrono Healer is a mobile-first, 100% offline-capable Progressive Web App (PWA) that builds personalized circadian phase-shifting protocols—combining **Sleep**, **Light Exposure**, **Melatonin**, **Caffeine**, **Anchor Meals**, and **Strategic Power Naps**—to eliminate jet lag before, during, and after your flight.

---

## Why v2.0?

Built for real-world air travel where cellular and Wi-Fi connectivity cannot be trusted at 35,000 feet:
- **100% Airplane Mode Operation**: Powered by an offline Service Worker (`public/sw.js`), an embedded global IATA airport & city database (`src/data/airports.ts`), and local device storage (`localStorage`).
- **Live "Flight Deck" Mode**: Shows dual live clocks (Origin vs. Destination), your active circadian window ("Right Now"), countdown to your next cue, and one-tap **Mid-Flight Delay / Re-route** adjustment (`-30m`, `+30m`, `+1h`, `+2h`, or diverted airport).
- **Flight Number Auto-Fill**: Enter a flight number (e.g., `BA112`, `UA928`, `JL5`, `QF11`, `SQ23`) to populate airports and scheduled times via live aviation lookup when online, or built-in route presets when offline.
- **Scientifically Grounded Multi-Pillar Engine**:
  - **International Date Line Shortest-Path Math**: Automatically computes whether your circadian clock should advance (Eastward) or delay (Westward) across any timezone pair (`[-12h, +12h]`).
  - **Phase Response Curve (PRC) Light Windows**: Schedules *Seek Bright Light* and *Avoid Bright Light* windows around your biological core body temperature minimum ($T_{\min}$).
  - **Customizable Pacing**: Choose **Slow** (`1.0h/day`), **Average** (`1.5h/day`), or **Fast** (`2.0h/day`) adaptation, starting either **Pre-Flight** (up to 3 days prior) or **Upon Departure/Arrival**.
  - **Optional Melatonin & Caffeine Pillars**: Toggle 0.5mg–3mg chronobiotic melatonin cues and morning alertness caffeine windows with strict sleep cutoffs.
  - **Peripheral Clock Meal & Nap Guidance**: Schedules high-protein anchor breakfasts and automatically inserts a 30-minute power nap whenever flight transit truncates core sleep below 5 hours.
- **Calendar Export with Alarms**: Exports RFC 5545 `.ics` files complete with visual emojis, scientific explanations, and 15-minute `VALARM` notifications for Apple Calendar, Google Calendar, and Outlook.

---

## How to Use Across Your Trip

1. **7 to 3 Days Before Departure (At Home / Online)**
   - Open Chrono Healer, enter your flight number or search your Origin & Destination airports by IATA code or city.
   - Choose your usual sleep routine, adaptation speed, and whether to start shifting before departure.
   - Tap **Save Trip & Open Flight Deck** and export the `.ics` file to your phone's calendar.
2. **Install to Your Phone for In-Flight Access**
   - **iOS (Safari)**: Tap the **Share** button → **Add to Home Screen**.
   - **Android (Chrome)**: Tap the **Menu (⋮)** → **Install App / Add to Home Screen**.
3. **In the Air (Airplane Mode)**
   - Launch Chrono Healer from your Home Screen.
   - Check the **Flight Deck** tab to see what window you are currently in.
   - If your flight is delayed on the tarmac or diverted, tap `+30m`, `+1h`, or `+2h Delay` to recalculate your entire remaining schedule offline in milliseconds.

---

## Development & Testing

```bash
# Install dependencies
npm install

# Run the local development server
npm run dev

# Run the automated Vitest test suite
npm test

# Build the static production export (outputs to ./out)
npm run build
```

---

## Versioning Structure

We follow Semantic Versioning (`MAJOR.MINOR.PATCH`):

- **v2.0.0** — Complete mobile-first PWA rebuild. Added Flight Deck live view, mid-flight delay & reroute engine, embedded offline IATA airport database, flight number lookup, International Date Line shortest-path algorithm, customizable adaptation speeds (`SLOW`, `AVERAGE`, `FAST`), pre-flight vs. arrival-only modes, melatonin/caffeine/meal/nap pillars with scientific explanations, offline trip persistence, Service Worker caching, and Vitest automated test suite.
- **v1.1.0** — Feature update. Renamed to Chrono Healer, added HTML datalist for IANA timezones, and verified DST handling.
- **v1.0.0** — Initial Proof-of-Concept release.

---

## License & Disclaimer

Released under the [MIT License](./LICENSE). Circadian, light, caffeine, and melatonin recommendations are provided for informational and educational purposes only and do not constitute medical advice.

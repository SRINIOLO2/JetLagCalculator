# Chrono Healer (Jet Lag Calculator) ✈️⏱️

Chrono Healer is a strictly local-first, privacy-respecting Progressive Web App (PWA) designed to intelligently schedule your sleep, light exposure, and caffeine intake to completely eliminate jet lag across multiple timezones.

## Key Features
- **Zero API Dependencies**: All timezone parsing (for over 400 global locations) is handled natively by your browser using the exact IANA Time Zone Database specifications and the `Intl` API.
- **Offline First**: As a fully configured PWA, Chrono Healer operates entirely offline with zero data leaving your device. Add it to your home screen!
- **Algorithm-driven**: Automatically calculates Eastward vs. Westward travel phase shifts, ensuring recommended sleep patterns never conflict with active boarding, takeoff, or landing. Evaluates and respects Daylight Savings Time (DST) completely dynamically.
- **Frictionless Calendar Integration**: Export your customized protocol instantly as an `.ics` file loaded with visual emojis (☀️, ☕, 🛏️) to import seamlessly into Google Calendar, Apple Calendar, or Outlook.

## Quick Start
To build and run the application locally:
```bash
npm install
npm run dev
```
Navigate to `http://localhost:3000`

## Versioning Structure
We strictly use semantic versioning `MAJOR.MINOR.PATCH`.

* **v1.1.0** - Feature Update. Renamed application to Chrono Healer. Implemented Native HTML Datalist autocomplete for 400+ time zones (replacing limited static dropdown). Displayed explicit UTC offsets. Added total sleep duration to generated schedule blocks. Verified complete algorithm compatibility with historical/future Daylight Savings Time boundaries.
* **v1.0.0** - Initial Release. Fully functional Next.js PWA setup. Implementation of core timezone shift logic tracking Eastward/Westward travel algorithms. Aesthetic UI module construction with Lucide icons. Robust `.ics` calendar export builder.

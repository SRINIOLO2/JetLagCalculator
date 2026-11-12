# AGENTS.md — Chrono Healer Engineering & Agent Guidelines

This document defines the architectural invariants, module responsibilities, and verification gates for AI coding agents and contributors working on **Chrono Healer**.

---

## 1. Core Architectural Invariants

1. **Strictly Local-First & Offline-Capable**:
   - Every core feature (airport lookup, timezone resolution, circadian schedule generation, mid-flight delay shifting, saved trips, and `.ics` calendar export) MUST run 100% client-side without requiring an internet connection or backend server.
   - Online features (such as live flight callsign/route APIs in `src/utils/flightLookup.ts`) must always use short timeouts and degrade gracefully to embedded offline presets without throwing unhandled errors.
2. **Static Export Compatibility**:
   - Next.js is configured with `output: "export"` in `next.config.mjs`. Do not introduce server-only Next.js features (`headers()`, `cookies()`, dynamic server routes without `generateStaticParams`, or runtime API routes) that break static export.
3. **Explicit Wall-Clock Timezone Math**:
   - Never use `new Date("YYYY-MM-DDTHH:mm")` to parse flight departure or arrival times, because `new Date()` interprets strings without offsets in the *host browser's current system timezone*.
   - Always use `fromZonedTime(localString, ianaTimezone)` and `formatInTimeZone(utcDate, ianaTimezone, formatStr)` from `date-fns-tz` so that calculations are identical regardless of where the user's phone is currently located.
4. **Shortest Circadian Path Across the International Date Line**:
   - Timezone differences must be normalized into the range `[-12, +12]` hours via `calculateShortestPhaseShift` so transpacific flights (e.g., `LAX` to `HND`) shift along the biologically shortest direction (7h Westward delay rather than 17h Eastward advance).

---

## 2. Codebase Map

| File | Responsibility |
|------|----------------|
| `src/data/airports.ts` | Offline database of 100+ global IATA airports, city search, and IANA timezone resolution (`searchLocations`, `resolveTimezone`). |
| `src/utils/flightLookup.ts` | Flight number normalization, online route fetch with 2.5s timeout, and offline route preset fallback (`lookupFlightNumber`). |
| `src/utils/jetLagAlgorithm.ts` | Pure TypeScript circadian engine generating `SLEEP`, `NAP`, `SEEK_LIGHT`, `AVOID_LIGHT`, `MELATONIN`, `CAFFEINE`, `MEAL`, and `FLIGHT` events, plus `applyFlightDelay`. |
| `src/utils/icsGenerator.ts` | RFC 5545 `.ics` generator with emoji prefixes, scientific explanations, and 15-minute `VALARM` reminders. |
| `src/utils/tripStorage.ts` | Safe `localStorage` CRUD helper for persisting multiple itineraries offline (`loadSavedTrips`, `saveTrip`, `deleteTrip`). |
| `src/components/ServiceWorkerRegistrar.tsx` | Registers `./sw.js` in the browser for offline Airplane Mode caching. |
| `public/sw.js` | Stale-While-Revalidate Service Worker caching the app shell and static assets. |
| `src/app/page.tsx` | Mobile-first 3-tab UI (`Flight Deck`, `Timeline`, `Trip Setup`) with live dual clocks and one-tap delay recalculation. |

---

## 3. Testing & Verification Gate

All changes to scheduling logic, timezone resolution, storage, or calendar export MUST follow Test-Driven Development (TDD) and pass both verification commands before completion:

```bash
npm test
npm run build
```

- **Unit & Algorithm Tests**: Located in `src/utils/__tests__/*.test.ts` and executed via Vitest (`vitest.config.ts`).
- When fixing a bug or adding a scheduling rule, write a deterministic failing test in `src/utils/__tests__/` first, watch it fail, and then implement the minimal production code to make it pass.

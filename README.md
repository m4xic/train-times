# Train Times

A live National Rail departure board, built as an iPhone-first PWA. Add it to your home screen and it looks and feels like a native app — dark mode, safe area insets, no browser chrome.

## Features

- **Live departure boards** for any UK National Rail station, auto-refreshing every 10 seconds
- **Nearby stations** — the home screen uses your device's geolocation to surface the 3 closest stations
- **Quick routes** — configurable shortcuts for your regular journeys (commutes, frequent trips)
- **Destination filter** — narrow a board down to trains calling at a specific station
- **Calling points** — expand any departure to see its full stopping pattern, loaded on demand
- **Departed trains toggle** — hide or reveal trains that have already left
- **Infinite scroll** — load more departures beyond the initial 20
- **Installable PWA** — works offline-capable, adds to iOS/Android home screen with standalone display

## How it works

### API

Departure data comes from [National Rail's OpenLDB Darwin API](https://lite.realtime.nationalrail.co.uk/OpenLDBWS/) — a SOAP/XML web service that provides real-time train information from the Darwin data feed.

Two operations are used:

- **`GetDepartureBoard`** — fetches the live board for a station (up to 150 trains). This is the primary operation used for listing departures. An earlier version used `GetDepBoardWithDetails` which includes calling points inline, but that operation is silently hard-capped at 10 results server-side, so it was replaced.
- **`GetServiceDetails`** — fetches the full calling point list for a single service, identified by its `serviceID`. Called lazily only when a user expands a departure card, avoiding unnecessary API load.

The API requires a token, which is kept secret on the server — the browser never sees it. All requests go through a Next.js API route (`/api/departures`, `/api/service`) that acts as a secure proxy.

### Departed train detection

Darwin's `etd` (estimated time of departure) field drives status logic:

- `"On time"` or missing → check `std` (scheduled time) against the current clock. If the scheduled time has passed, the train is marked **Departed**.
- `"Delayed"` → show as delayed with no specific time.
- A specific time string (e.g. `"18:42"`) → if that time has passed, mark **Departed**; otherwise show it as the new expected time.

A `timeOffset=-2` parameter is passed to the API so that trains from 2 minutes ago are included in the response, giving the departed toggle something useful to show.

### Geolocation

The home screen requests the browser's Geolocation API on load. If granted, it runs a Haversine distance calculation in-browser against a full dataset of UK National Rail stations (`stations.json`) to find the 3 nearest. If permission is denied or unavailable, the section is silently hidden. No coordinates are ever sent to the server.

### Stack

- **Next.js 16** (Pages Router) — chosen over a static site because the API token needs to stay server-side
- **React 18** — state, effects, refs, `useLayoutEffect` for synchronous DOM measurement
- **fast-xml-parser** — parses the SOAP/XML responses from Darwin into plain JS objects
- **Vercel** — deployment, with the `LDB_TOKEN` stored as an environment variable

### PWA / iOS

`pages/_document.js` includes the iOS-specific meta tags (`apple-mobile-web-app-capable`, `black-translucent` status bar) and a Web App Manifest. The CSS uses `env(safe-area-inset-*)` so content respects the iPhone notch and home bar. The navbar is `position: sticky` with a frosted-glass backdrop blur, matching the iOS native feel.

---

## Getting started

### Prerequisites

- Node.js 18+
- A National Rail OpenLDB API token — register at [https://realtime.nationalrail.co.uk/OpenLDBWSRegistration](https://realtime.nationalrail.co.uk/OpenLDBWSRegistration)

### Local development

```bash
# Install dependencies
npm install

# Create your environment file
echo "LDB_TOKEN=your_token_here" > .env.local

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploying to Vercel

1. Push the repo to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add `LDB_TOKEN` as an Environment Variable in the Vercel project settings
4. Deploy — Vercel will build and serve it automatically on every push to `main`

---

## Customising quick routes

Edit `lib/presets.js`:

```js
export const presets = [
  {
    label: 'Home',
    from: { name: 'London Paddington', crs: 'PAD' },
    to:   { name: 'Reading', crs: 'RDG' },
  },
  {
    label: 'Work',
    from: { name: 'Reading', crs: 'RDG' },
    to:   { name: 'London Paddington', crs: 'PAD' },
  },
  // A station board without a destination filter:
  {
    label: 'Local',
    from: { name: 'Clapham Junction', crs: 'CLJ' },
  },
]
```

CRS codes are the standard 3-letter National Rail station codes (e.g. `PAD` for Paddington, `EDB` for Edinburgh).

---

## Project structure

```
pages/
  index.js              # Home screen — nearby stations, quick routes, search
  station/[crs].js      # Live departure board for a station
  api/
    departures.js       # Proxy → GetDepartureBoard
    service.js          # Proxy → GetServiceDetails (calling points)
lib/
  ldb.js                # OpenLDB SOAP client
  presets.js            # Quick route configuration
  stations.js           # Station list for search autocomplete
stations.json           # Full UK station dataset with coordinates (for geolocation)
styles/
  globals.css           # All styles — iOS dark design tokens, component styles
public/
  manifest.json         # PWA manifest
  icons/                # App icons (icon-192.png, icon-512.png)
```

---

## How this was built

This project was built collaboratively between the repo owner and [Claude](https://claude.ai) (Anthropic's AI) using [Claude Code](https://claude.com/claude-code), Anthropic's agentic CLI tool.

The brief was to build a National Rail PWA that would feel at home on an iPhone — minimal, fast, and functional. From that starting point, the project evolved through a back-and-forth conversation:

**Architecture decisions** were made together. We chose Vercel over GitHub Pages specifically because a serverless proxy was needed to keep the API token off the client. Next.js Pages Router was the natural fit — simple file-based routing, API routes built in, no overengineering.

**The Darwin API took some debugging.** The initial `SOAPAction` header value was wrong (the operation was introduced in 2015 but the schema is versioned to 2021 — the action uses the *introduction* date, not the schema version). Claude fetched the live WSDL to identify the correct values. The endpoint also needed correcting from `ldb11.asmx` to `ldb12.asmx`. These aren't clearly documented, and working through the SOAP spec together was one of the more involved parts of the build.

**A significant architectural change** happened when it became clear that `GetDepBoardWithDetails` — which was the original choice because it includes calling points inline — silently caps responses at 10 trains regardless of how many you request. This was confirmed by testing directly against the API at various `numRows` values and comparing with `GetDepartureBoard`. The fix was to switch to `GetDepartureBoard` for the board (which has no such cap) and load calling points lazily via `GetServiceDetails` when a card is expanded.

**Departed train detection** went through several iterations. The first version used `std` (scheduled time) to infer departure — which broke for trains sitting at platforms well past their scheduled time that Darwin still reported as "On time". A second version tried to use `atd` (actual time of departure) from the API, but that field only exists on `ServiceDetails`, not the board response. The final version trusts Darwin's `etd` field as the primary signal: if it's a specific clock time that has passed, the train is departed; if it says "On time", fall back to comparing `std` against the current time.

**The UI details** — the iOS toggle switch, the sticky frosted navbar, the pulsing live dot, the dynamic calling points truncation — were refined through the conversation, with the user reviewing on a real iPhone and giving feedback on what felt right.

**Geolocation** was added as a late feature. The user supplied a `stations.json` file with coordinates for every UK National Rail station; Claude wired in the Haversine distance calculation and the geolocation permission flow, with the section silently suppressed if permission is denied.

The whole thing was written without any UI component library or CSS framework — just React, plain CSS with custom properties, and the Darwin API.

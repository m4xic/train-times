# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build
npm run start    # run production build locally
```

No test suite or linter is configured.

## Environment

Requires `LDB_TOKEN` in `.env.local` (locally) or Vercel environment variables (production). The token authenticates against the OpenLDB (Darwin) SOAP API.

## Architecture

**Pages Router** (Next.js) with two routes and two API proxies:

- `pages/index.js` — landing page: nearby stations (geolocation + `stations.json`), built-in presets (`lib/presets.js`), user-saved routes (localStorage), full station search (`stations.json`)
- `pages/station/[crs].js` — departures board for a CRS station code; optional `?to=<CRS>` destination filter; auto-refreshes every 10 s; infinite scroll loads up to 150 services
- `pages/api/departures.js` — proxies `GET /api/departures?from=<CRS>[&to=<CRS>][&rows=N]` to `getDepartures()` in `lib/ldb.js`
- `pages/api/service.js` — proxies `GET /api/service?id=<serviceID>` to `getServiceDetails()` in `lib/ldb.js`; called lazily when a user expands a departure card

**`lib/ldb.js`** — all OpenLDB SOAP logic:
- `getDepartures(crs, filterCrs, numRows)` — calls `GetDepartureBoard`
- `getServiceDetails(serviceID)` — calls `GetServiceDetails`
- Uses `fast-xml-parser` with `removeNSPrefix: true` to flatten the SOAP/XML namespace mess

**Two station datasets** exist and serve different purposes:
- `lib/stations.js` — ~100 curated stations used for destination filter autocomplete on the board page
- `stations.json` — full list of all UK stations (with lat/long) used for geolocation sorting and the full station search on the home page; shape is `{ stationName, crsCode, lat, long }`

**Critical API constraint:** Always use `GetDepartureBoard` (not `GetDepBoardWithDetails`) — the latter is hard-capped at 10 results server-side regardless of `numRows`.

## Customising presets

Edit `lib/presets.js` — each entry: `{ label, from: { name, crs }, to?: { name, crs } }`.

## Styling

All styles live in `styles/globals.css` using CSS custom properties with an iOS dark-mode design language. No CSS modules or component-level styles.

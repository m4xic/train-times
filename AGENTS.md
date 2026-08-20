# Repository guidance for coding agents

## Commands

```bash
npm run dev      # start the development server at localhost:3000
npm run build    # create a production build
npm run start    # serve the production build
npm audit        # check production and development dependencies
```

No automated test suite or linter is currently configured. Run `npm run build`
and `npm audit` before submitting changes.

## Environment

The app requires `LDB_TOKEN` in `.env.local` for local development or in the
deployment platform's environment variables. Never commit this credential or
expose it to browser code.

## Architecture

This is a Next.js Pages Router application with two pages and two server-side
API proxies:

- `pages/index.js` provides station search, nearby stations, built-in presets,
  and user-saved routes.
- `pages/station/[crs].js` shows the live departures board, destination filter,
  calling points, automatic refresh, and infinite scrolling.
- `pages/api/departures.js` validates and proxies departure-board requests.
- `pages/api/service.js` validates and proxies service-detail requests.
- `lib/ldb.js` contains the OpenLDB SOAP client and XML parsing logic.
- `stations.json` supplies station names, CRS codes, and coordinates.
- `styles/globals.css` contains all application styling.

Always use OpenLDB's `GetDepartureBoard` operation for board results.
`GetDepBoardWithDetails` is capped at 10 results; calling points should instead
be loaded lazily with `GetServiceDetails`.

## Pull requests

- Summarize the change and the checks performed.
- When work originates from a GitHub issue, include `Closes #<issue-number>` in
  the pull request body so merging the pull request closes and links the issue.
- In responses to requests for code changes, include the URL of the created
  pull request.

## Customising presets

Edit `lib/presets.js`. Each entry has the shape
`{ label, from: { name, crs }, to?: { name, crs } }`.

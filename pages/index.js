import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { presets } from '../lib/presets'
import { stations } from '../lib/stations'
import allStations from '../stations.json'

const STORAGE_KEY = 'custom-routes'

// ─── Geolocation helpers ──────────────────────────────────────────

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLon = (lon2 - lon1) * (Math.PI / 180)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function getNearby(lat, lon, count = 3) {
  return allStations
    .map((s) => ({ ...s, km: distanceKm(lat, lon, s.lat, s.long) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, count)
}

function searchAllStations(query, limit = 6) {
  if (query.length < 2) return []
  const q = query.toLowerCase()
  return allStations
    .filter(
      (s) =>
        s.stationName.toLowerCase().includes(q) ||
        s.crsCode.toLowerCase() === q
    )
    .slice(0, limit)
}

// ─── Shared layout components ─────────────────────────────────────

function GovHeader() {
  return (
    <header className="govuk-header">
      <div className="govuk-header__container govuk-width-container">
        <div className="govuk-header__content">
          <a href="/" className="govuk-header__link govuk-header__service-name">
            Train Times
          </a>
        </div>
      </div>
    </header>
  )
}

function PhaseBanner() {
  return (
    <div className="govuk-phase-banner">
      <p className="govuk-phase-banner__content">
        <strong className="govuk-tag govuk-phase-banner__content__tag">Beta</strong>
        <span className="govuk-phase-banner__text">
          Live National Rail departure information
        </span>
      </p>
    </div>
  )
}

// ─── Home page ────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [nearby, setNearby] = useState(undefined)
  const [customRoutes, setCustomRoutes] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addFrom, setAddFrom] = useState(null)
  const [addTo, setAddTo] = useState(null)
  const [fromSearch, setFromSearch] = useState('')
  const [toSearch, setToSearch] = useState('')

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      setCustomRoutes(saved)
    } catch {}
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) { setNearby(null); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => setNearby(getNearby(pos.coords.latitude, pos.coords.longitude)),
      () => setNearby(null),
      { timeout: 8000 }
    )
  }, [])

  const results =
    search.length >= 2
      ? stations
          .filter(
            (s) =>
              s.name.toLowerCase().includes(search.toLowerCase()) ||
              s.crs.toLowerCase() === search.toLowerCase()
          )
          .slice(0, 8)
      : []

  const fromResults = searchAllStations(fromSearch)
  const toResults = searchAllStations(toSearch)

  const saveRoute = () => {
    if (!addFrom) return
    const route = {
      id: Date.now(),
      label: addName.trim() || null,
      from: { name: addFrom.stationName, crs: addFrom.crsCode },
      to: addTo ? { name: addTo.stationName, crs: addTo.crsCode } : null,
    }
    const updated = [...customRoutes, route]
    setCustomRoutes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    cancelAdd()
  }

  const removeRoute = (id) => {
    const updated = customRoutes.filter((r) => r.id !== id)
    setCustomRoutes(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  }

  const cancelAdd = () => {
    setShowAdd(false)
    setAddName('')
    setAddFrom(null)
    setAddTo(null)
    setFromSearch('')
    setToSearch('')
  }

  const hasRoutes = presets.length > 0 || customRoutes.length > 0

  return (
    <>
      <Head>
        <title>Train Times</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <GovHeader />

      <div className="govuk-width-container">
        <PhaseBanner />

        <main className="govuk-main-wrapper" id="main-content">

          {/* Nearby stations */}
          {nearby !== null && (
            <section aria-labelledby="nearby-heading">
              <h2 className="govuk-heading-m" id="nearby-heading">Nearby stations</h2>
              {nearby === undefined ? (
                <p className="govuk-body govuk-hint">Finding nearby stations…</p>
              ) : (
                <ul className="route-list">
                  {nearby.map((s) => (
                    <li key={s.crsCode}>
                      <button
                        className="route-link"
                        onClick={() => router.push(`/station/${s.crsCode}`)}
                      >
                        <span>{s.stationName}</span>
                        <span className="route-meta">
                          {s.km < 1
                            ? `${Math.round(s.km * 1000)} m away`
                            : `${s.km.toFixed(1)} km away`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Quick routes */}
          <section aria-labelledby="routes-heading">
            <h2 className="govuk-heading-m" id="routes-heading">Quick routes</h2>

            {!hasRoutes && !showAdd && (
              <p className="govuk-hint">No quick routes saved yet.</p>
            )}

            {hasRoutes && (
              <ul className="route-list">
                {presets.map((p, i) => (
                  <li key={i}>
                    <button
                      className="route-link"
                      onClick={() => router.push(`/station/${p.from.crs}${p.to ? `?to=${p.to.crs}` : ''}`)}
                    >
                      <span>
                        {p.label && <span className="route-meta">{p.label} &mdash; </span>}
                        {p.from.name}
                        {p.to && <> &rarr; {p.to.name}</>}
                      </span>
                    </button>
                  </li>
                ))}
                {customRoutes.map((r) => (
                  <li key={r.id} style={{ display: 'flex', alignItems: 'center' }}>
                    <button
                      className="route-link"
                      style={{ flex: 1 }}
                      onClick={() => router.push(`/station/${r.from.crs}${r.to ? `?to=${r.to.crs}` : ''}`)}
                    >
                      <span>
                        {r.label && <span className="route-meta">{r.label} &mdash; </span>}
                        {r.from.name}
                        {r.to && <> &rarr; {r.to.name}</>}
                      </span>
                    </button>
                    <button
                      className="route-delete-btn"
                      onClick={() => removeRoute(r.id)}
                      aria-label={`Remove ${r.label || r.from.name} route`}
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {showAdd ? (
              <div className="govuk-inset-text" style={{ marginTop: 0 }}>
                <div className="govuk-form-group">
                  <label className="govuk-label" htmlFor="add-route-name">
                    Route name{' '}
                    <span className="govuk-hint" style={{ display: 'inline' }}>(optional)</span>
                  </label>
                  <input
                    className="govuk-input govuk-input--width-20"
                    id="add-route-name"
                    type="text"
                    placeholder="e.g. Home, Work, Commute"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                <StationPicker
                  label="From station"
                  id="add-from"
                  selected={addFrom}
                  onSelect={setAddFrom}
                  onClear={() => { setAddFrom(null); setFromSearch('') }}
                  search={fromSearch}
                  setSearch={setFromSearch}
                  results={fromResults}
                  autoFocus
                />

                <StationPicker
                  label="To station"
                  hint="optional"
                  id="add-to"
                  selected={addTo}
                  onSelect={setAddTo}
                  onClear={() => { setAddTo(null); setToSearch('') }}
                  search={toSearch}
                  setSearch={setToSearch}
                  results={toResults}
                />

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    className="govuk-button"
                    onClick={saveRoute}
                    disabled={!addFrom}
                  >
                    Save route
                  </button>
                  <button
                    className="govuk-button govuk-button--secondary"
                    onClick={cancelAdd}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="govuk-button govuk-button--secondary"
                onClick={() => setShowAdd(true)}
              >
                Add route
              </button>
            )}
          </section>

          {/* All stations search */}
          <section aria-labelledby="search-heading">
            <h2 className="govuk-heading-m" id="search-heading">All stations</h2>

            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="station-search">
                Search by name or CRS code
              </label>
              <input
                className="govuk-input"
                type="search"
                id="station-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>

            {results.length > 0 && (
              <ul className="route-list">
                {results.map((s) => (
                  <li key={s.crs}>
                    <button
                      className="route-link"
                      onClick={() => router.push(`/station/${s.crs}`)}
                    >
                      <span>{s.name}</span>
                      <span className="route-meta">{s.crs}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

        </main>
      </div>

      <footer className="govuk-footer">
        <div className="govuk-width-container">
          <div className="govuk-footer__meta">
            <div className="govuk-footer__meta-item govuk-footer__meta-item--grow">
              <p className="govuk-body-s" style={{ color: 'var(--govuk-secondary-text-colour)' }}>
                Live data from National Rail Darwin OpenLDB
              </p>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}

// ─── Station picker sub-form ──────────────────────────────────────

function StationPicker({ label, hint, id, selected, onSelect, onClear, search, setSearch, results, autoFocus }) {
  return (
    <div className="govuk-form-group">
      <label className="govuk-label" htmlFor={id}>
        {label}
        {hint && (
          <span className="govuk-hint" style={{ display: 'inline', marginLeft: 6 }}>
            ({hint})
          </span>
        )}
      </label>
      {selected ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="govuk-body">{selected.stationName}</span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--govuk-link-colour)', textDecoration: 'underline' }}
            onClick={onClear}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            className="govuk-input govuk-input--width-20"
            id={id}
            type="search"
            placeholder="Search station…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {results.length > 0 && (
            <ul className="route-list" style={{ marginTop: 4 }}>
              {results.map((s) => (
                <li key={s.crsCode}>
                  <button className="route-link" onClick={() => onSelect(s)}>
                    <span>{s.stationName}</span>
                    <span className="route-meta">{s.crsCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

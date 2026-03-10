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

// ─── Station search helper ────────────────────────────────────────

function searchAllStations(query, limit = 6) {
  if (query.length < 2) return []
  const q = query.toLowerCase()
  return allStations
    .filter(
      (s) =>
        s.stationName.toLowerCase().includes(q) ||
        s.crsCode.toLowerCase().includes(q)
    )
    .slice(0, limit)
}

// ─── Home page ────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter()

  // Station search (All Stations section)
  const [search, setSearch] = useState('')

  // Geolocation
  const [nearby, setNearby] = useState(undefined) // undefined = loading, null = denied, array = results

  // Custom routes
  const [customRoutes, setCustomRoutes] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [addName, setAddName] = useState('')
  const [addFrom, setAddFrom] = useState(null)
  const [addTo, setAddTo] = useState(null)
  const [fromSearch, setFromSearch] = useState('')
  const [toSearch, setToSearch] = useState('')

  // Load custom routes from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
      setCustomRoutes(saved)
    } catch {}
  }, [])

  // Geolocation
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
              s.crs.toLowerCase().includes(search.toLowerCase())
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

  return (
    <>
      <Head>
        <title>Train Times</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </Head>

      <div className="navbar">
        <span className="navbar-title">Train Times</span>
      </div>

      <div className="container">

        {/* Nearby stations */}
        {nearby !== null && (
          <>
            <div className="section-header">Nearby Stations</div>
            <div className="preset-grid">
              {nearby === undefined ? (
                <div className="nearby-loading">
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  <span>Finding nearby stations…</span>
                </div>
              ) : (
                nearby.map((s) => (
                  <button
                    key={s.crsCode}
                    className="preset-card"
                    onClick={() => router.push(`/station/${s.crsCode}`)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="preset-card-label">
                        {s.km < 1
                          ? `${Math.round(s.km * 1000)} m away`
                          : `${s.km.toFixed(1)} km away`}
                      </div>
                      <div className="preset-card-route">{s.stationName}</div>
                    </div>
                    <svg className="preset-card-chevron" width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
                      <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {/* Quick Routes */}
        <div className="section-header">Quick Routes</div>

        <div className="preset-grid">
          {/* Built-in presets */}
          {presets.map((p, i) => (
            <PresetCard
              key={i}
              preset={p}
              onClick={() => router.push(`/station/${p.from.crs}${p.to ? `?to=${p.to.crs}` : ''}`)}
            />
          ))}

          {/* User-saved routes */}
          {customRoutes.map((r) => (
            <div
              key={r.id}
              className="preset-card custom-route-card"
              onClick={() => router.push(`/station/${r.from.crs}${r.to ? `?to=${r.to.crs}` : ''}`)}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="preset-card-label">{r.label || 'My route'}</div>
                <div className="preset-card-route">
                  {r.from.name}
                  {r.to && (
                    <>
                      <span className="preset-card-arrow"> → </span>
                      {r.to.name}
                    </>
                  )}
                </div>
              </div>
              <button
                className="route-delete-btn"
                onClick={(e) => { e.stopPropagation(); removeRoute(r.id) }}
                aria-label="Remove route"
              >
                ×
              </button>
            </div>
          ))}

          {/* Add route form */}
          {showAdd ? (
            <div className="add-route-form">
              <div className="add-route-field">
                <div className="add-route-label">Name <span className="add-route-optional">(optional)</span></div>
                <input
                  className="add-route-input"
                  type="text"
                  placeholder="e.g. Home, Work, Commute…"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>

              <div className="add-route-field">
                <div className="add-route-label">From</div>
                {addFrom ? (
                  <div className="add-route-selected">
                    <span>{addFrom.stationName}</span>
                    <button className="add-route-clear" onClick={() => { setAddFrom(null); setFromSearch('') }}>×</button>
                  </div>
                ) : (
                  <>
                    <input
                      className="add-route-input"
                      type="search"
                      placeholder="Search station…"
                      value={fromSearch}
                      onChange={(e) => setFromSearch(e.target.value)}
                      autoFocus
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                    {fromResults.length > 0 && (
                      <div className="add-route-results">
                        {fromResults.map((s) => (
                          <div
                            key={s.crsCode}
                            className="add-route-result-item"
                            onClick={() => { setAddFrom(s); setFromSearch('') }}
                          >
                            <span>{s.stationName}</span>
                            <span className="search-result-crs">{s.crsCode}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="add-route-field">
                <div className="add-route-label">To <span className="add-route-optional">(optional)</span></div>
                {addTo ? (
                  <div className="add-route-selected">
                    <span>{addTo.stationName}</span>
                    <button className="add-route-clear" onClick={() => { setAddTo(null); setToSearch('') }}>×</button>
                  </div>
                ) : (
                  <>
                    <input
                      className="add-route-input"
                      type="search"
                      placeholder="Search station…"
                      value={toSearch}
                      onChange={(e) => setToSearch(e.target.value)}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck="false"
                    />
                    {toResults.length > 0 && (
                      <div className="add-route-results">
                        {toResults.map((s) => (
                          <div
                            key={s.crsCode}
                            className="add-route-result-item"
                            onClick={() => { setAddTo(s); setToSearch('') }}
                          >
                            <span>{s.stationName}</span>
                            <span className="search-result-crs">{s.crsCode}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="add-route-actions">
                <button className="add-route-cancel" onClick={cancelAdd}>Cancel</button>
                <button
                  className="add-route-save"
                  onClick={saveRoute}
                  disabled={!addFrom}
                >
                  Save route
                </button>
              </div>
            </div>
          ) : (
            <button className="add-route-btn" onClick={() => setShowAdd(true)}>
              + Add route
            </button>
          )}
        </div>

        {/* All Stations search */}
        <div className="section-header">All Stations</div>

        <div className="search-wrap">
          <svg className="search-icon" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 12l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="search-input"
            placeholder="Search stations…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
        </div>

        {results.length > 0 && (
          <div className="search-results">
            {results.map((s) => (
              <div
                key={s.crs}
                className="search-result-item"
                onClick={() => router.push(`/station/${s.crs}`)}
              >
                <span className="search-result-name">{s.name}</span>
                <span className="search-result-crs">{s.crs}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  )
}

function PresetCard({ preset, onClick }) {
  return (
    <button className="preset-card" onClick={onClick}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="preset-card-label">{preset.label}</div>
        <div className="preset-card-route">
          {preset.from.name}
          {preset.to && (
            <>
              <span className="preset-card-arrow"> → </span>
              {preset.to.name}
            </>
          )}
        </div>
      </div>
      <svg className="preset-card-chevron" width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
        <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

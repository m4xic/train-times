import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { stations } from '../../lib/stations'

const REFRESH_SECS = 10
const ROWS_STEP = 20
const MAX_ROWS = 150

export default function StationPage() {
  const router = useRouter()
  const { crs, to } = router.query

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [countdown, setCountdown] = useState(REFRESH_SECS)
  const [numRows, setNumRows] = useState(ROWS_STEP)

  // Keep a ref so the auto-refresh interval always uses the current numRows
  // without needing to recreate the interval every time rows change.
  const numRowsRef = useRef(ROWS_STEP)
  const sentinelRef = useRef(null)

  const hasMore = data && data.services.length >= numRows && numRows < MAX_ROWS
  // True when the API returned fewer trains than we asked for — definitive end of data.
  // Also true after a load-more confirmed nothing new (numRows was increased but count didn't grow).
  const reachedEnd = data && !hasMore && (
    data.services.length < numRows ||   // fewer returned than requested → confirmed end
    numRows > ROWS_STEP                 // load-more was attempted and exhausted
  )

  const [showDeparted, setShowDeparted] = useState(false)

  // Destination filter UI
  const [showFilter, setShowFilter] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')
  const filterResults =
    filterSearch.length >= 2
      ? stations
          .filter(
            (s) =>
              s.name.toLowerCase().includes(filterSearch.toLowerCase()) ||
              s.crs.toLowerCase() === filterSearch.toLowerCase()
          )
          .slice(0, 6)
      : []

  const stationName =
    data?.stationName ||
    stations.find((s) => s.crs === crs?.toUpperCase())?.name ||
    crs?.toUpperCase() ||
    '…'

  const filterName = to
    ? data?.filterLocationName ||
      stations.find((s) => s.crs === to.toUpperCase())?.name ||
      to.toUpperCase()
    : null

  const fetchData = useCallback(async (rows) => {
    if (!crs) return
    setError(null)
    try {
      const url = `/api/departures?from=${crs}${to ? `&to=${to}` : ''}&rows=${rows}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load departures')
      setData(json)
      setCountdown(REFRESH_SECS)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [crs, to])

  // Fetch on mount / when crs or to changes — reset rows too
  useEffect(() => {
    if (!router.isReady) return
    setLoading(true)
    setData(null)
    setNumRows(ROWS_STEP)
    numRowsRef.current = ROWS_STEP
    fetchData(ROWS_STEP)
  }, [router.isReady, crs, to]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh countdown — uses ref so it doesn't recreate when rows change
  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchData(numRowsRef.current)
          return REFRESH_SECS
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [fetchData])

  // Load the next page of trains
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    const nextRows = Math.min(numRows + ROWS_STEP, MAX_ROWS)
    setLoadingMore(true)
    try {
      const url = `/api/departures?from=${crs}${to ? `&to=${to}` : ''}&rows=${nextRows}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load')
      setData(json)
      setNumRows(nextRows)
      numRowsRef.current = nextRows
      setCountdown(REFRESH_SECS)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingMore(false)
    }
  }, [crs, to, numRows, loadingMore, hasMore])

  // Infinite scroll — fire loadMore when sentinel enters the viewport
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore() },
      { rootMargin: '200px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  const applyFilter = (destCrs) => {
    router.replace(`/station/${crs}?to=${destCrs}`)
    setShowFilter(false)
    setFilterSearch('')
  }

  const clearFilter = () => {
    router.replace(`/station/${crs}`)
  }

  return (
    <>
      <Head>
        <title>{stationName} Departures</title>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>

      {/* Navbar */}
      <div className="navbar">
        <button className="back-btn" onClick={() => router.push('/')}>
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none" aria-hidden="true">
            <path
              d="M7 1L1 7l6 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Stations
        </button>
        <span className="navbar-title" style={{ flex: 1 }}>
          {stationName}
        </span>
      </div>

      <div className="container">
        {/* Filter strip */}
        <div className="filter-strip">
          {to ? (
            <div className="filter-pill">
              <span>To: {filterName}</span>
              <button className="filter-pill-clear" onClick={clearFilter} aria-label="Clear filter">
                ×
              </button>
            </div>
          ) : (
            <button
              className="filter-toggle-btn"
              onClick={() => setShowFilter((v) => !v)}
            >
              {showFilter ? 'Cancel' : '+ Filter by destination'}
            </button>
          )}

          <label className="departed-toggle" title="Show departed trains">
            <span className="departed-toggle-label">Departed</span>
            <span className={`toggle-track${showDeparted ? ' on' : ''}`}>
              <span className="toggle-thumb" />
            </span>
            <input
              type="checkbox"
              checked={showDeparted}
              onChange={(e) => setShowDeparted(e.target.checked)}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
          </label>
        </div>

        {/* Destination search */}
        {showFilter && (
          <>
            <div className="filter-search-wrap search-wrap">
              <svg
                className="search-icon"
                viewBox="0 0 18 18"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                <path
                  d="M12 12l3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                className="search-input"
                placeholder="Search destination…"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
            </div>

            {filterResults.length > 0 && (
              <div className="search-results">
                {filterResults.map((s) => (
                  <div
                    key={s.crs}
                    className="search-result-item"
                    onClick={() => applyFilter(s.crs)}
                  >
                    <span className="search-result-name">{s.name}</span>
                    <span className="search-result-crs">{s.crs}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Refresh bar */}
        <div className="refresh-bar">
          <span className="refresh-text">
            <span className="live-dot" />
            {loading && data ? 'Updating…' : `Live · updates in ${countdown}s`}
          </span>
          <button className="refresh-btn" onClick={fetchData}>
            Refresh now
          </button>
        </div>

        {/* Loading */}
        {loading && !data && (
          <div className="loading-state">
            <div className="spinner" />
            <span>Loading departures…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-card">
            <div>{error}</div>
            <button className="error-retry" onClick={fetchData}>
              Try again
            </button>
          </div>
        )}

        {/* Departures */}
        {data && !error && (
          <>
            {data.services.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">No departures found</div>
                <div>
                  {to
                    ? `No trains to ${filterName} in the next 2 hours`
                    : 'No departures in the next 2 hours'}
                </div>
              </div>
            ) : (
              <>
                <div className="departures-list">
                  {data.services
                    .filter((s) => showDeparted || getStatus(s).type !== 'departed')
                    .map((service, i) => (
                      <DepartureCard key={i} service={service} />
                    ))}
                </div>

                <div ref={sentinelRef} />

                {loadingMore && (
                  <div className="loading-more">
                    <div className="spinner" />
                  </div>
                )}

                {reachedEnd && data.services.length > 0 && (
                  <div className="end-of-list">
                    {to ? (
                      <>
                        All trains to {filterName} shown ·{' '}
                        <button className="end-of-list-btn" onClick={clearFilter}>
                          Show all departures
                        </button>
                      </>
                    ) : (
                      'No more departures in the next 2 hours'
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ─── Departure card ────────────────────────────────────────────

function getStatus(service) {
  if (service.cancelled) return { type: 'cancelled', label: 'Cancelled' }

  const etd = service.etd

  if (etd === 'Delayed') return { type: 'delayed', label: 'Delayed' }

  // For "On time" or no etd, use std to detect departure
  if (!etd || etd === 'On time') {
    if (!service.std) return { type: 'on-time', label: 'On time' }
    const [h, m] = service.std.split(':').map(Number)
    const now = new Date()
    if (now.getHours() * 60 + now.getMinutes() > h * 60 + m)
      return { type: 'departed', label: 'Departed' }
    return { type: 'on-time', label: 'On time' }
  }

  // etd is a specific revised time — only mark departed if that time has passed
  const [h, m] = etd.split(':').map(Number)
  const now = new Date()
  const etdMins = h * 60 + m
  const nowMins = now.getHours() * 60 + now.getMinutes()
  if (nowMins > etdMins) return { type: 'departed', label: 'Departed' }
  return { type: 'delayed', label: `Exp ${etd}` }
}

function buildCallingText(names, visibleCount) {
  const visible = names.slice(0, visibleCount)
  const more = names.length - visibleCount
  const joined =
    visible.length === 1
      ? visible[0]
      : `${visible.slice(0, -1).join(', ')} and ${visible[visible.length - 1]}`
  return more > 0
    ? `Calling at ${visible.join(', ')} and ${more} more`
    : `Calling at ${joined}`
}

// Renders the calling-points summary line, reducing visible station count
// one-by-one (synchronously, before paint) until the text fits on one line.
function CallingPoints({ callingPoints }) {
  const names = callingPoints.map((cp) => cp.name)
  const [count, setCount] = useState(names.length)
  const spanRef = useRef(null)

  // Reset to full count whenever the service changes
  useLayoutEffect(() => {
    setCount(names.length)
  }, [callingPoints]) // eslint-disable-line react-hooks/exhaustive-deps

  // After each render, shrink by one if still overflowing
  useLayoutEffect(() => {
    const el = spanRef.current
    if (!el || count <= 1) return
    if (el.scrollWidth > el.clientWidth) {
      setCount((c) => c - 1)
    }
  })

  // Re-measure on resize (e.g. orientation change)
  useEffect(() => {
    const el = spanRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCount(names.length))
    ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [names.length])

  return (
    <span
      ref={spanRef}
      style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
    >
      {buildCallingText(names, count)}
    </span>
  )
}

function DepartureCard({ service }) {
  const [showCalling, setShowCalling] = useState(false)
  const [callingPoints, setCallingPoints] = useState(null)
  const [callingLoading, setCallingLoading] = useState(false)
  const [callingError, setCallingError] = useState(null)

  const status = getStatus(service)
  const destText = service.destinations.map((d) => d.name).join(' & ')
  const viaText = service.destinations.map((d) => d.via).filter(Boolean).join(' & ')
  const timeClass = status.type

  const toggleCalling = async () => {
    const next = !showCalling
    setShowCalling(next)
    if (next && callingPoints === null && !callingLoading && service.serviceID) {
      setCallingLoading(true)
      setCallingError(null)
      try {
        const res = await fetch(`/api/service?id=${encodeURIComponent(service.serviceID)}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load')
        setCallingPoints(json.callingPoints)
      } catch (e) {
        setCallingError(e.message)
      } finally {
        setCallingLoading(false)
      }
    }
  }

  // Summary text for the toggle button — show destination(s) when collapsed
  const summaryText = callingPoints
    ? null // CallingPoints component handles it
    : `Calling at ${service.destinations.map((d) => d.name).join(' & ')}`

  return (
    <div className="dep-card">
      <div className="dep-main">
        {/* Time + status */}
        <div className="dep-time-col">
          <div className={`dep-std ${timeClass}`}>{service.std || '??:??'}</div>
          {status.label && (
            <div className={`dep-etd ${timeClass}`}>{status.label}</div>
          )}
        </div>

        {/* Destination + operator */}
        <div className="dep-info-col">
          <div className="dep-destination">{destText}</div>
          {viaText && (
            <div className="dep-operator" style={{ fontStyle: 'italic' }}>
              {viaText}
            </div>
          )}
          <div className="dep-operator">{service.operator}</div>
        </div>

        {/* Platform */}
        <div className="dep-platform-col">
          <div className="dep-plat-label">Plat</div>
          {service.platform ? (
            <div className="dep-plat-number">{service.platform}</div>
          ) : (
            <div className="dep-plat-tbc">TBC</div>
          )}
        </div>
      </div>

      {/* Calling points toggle — always shown if service has an ID */}
      {service.serviceID && (
        <>
          <button
            className="calling-toggle"
            onClick={toggleCalling}
          >
            <svg
              className={`calling-toggle-chevron${showCalling ? ' open' : ''}`}
              width="12"
              height="7"
              viewBox="0 0 12 7"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M1 1l5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {callingPoints ? (
              <CallingPoints callingPoints={callingPoints} />
            ) : (
              <span style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'block' }}>
                Load calling points…
              </span>
            )}
          </button>

          {showCalling && (
            <div className="calling-list">
              {callingLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                </div>
              )}
              {callingError && (
                <div style={{ color: 'var(--red)', fontSize: 13 }}>{callingError}</div>
              )}
              {callingPoints && callingPoints.map((cp, i) => {
                const timeStr = cp.at || (cp.et && cp.et !== 'On time' ? cp.et : cp.st) || '—'
                const isDelayed = !cp.at && cp.et && cp.et !== 'On time'
                const isCancelled = cp.cancelled
                return (
                  <div key={i} className="calling-row">
                    <span className="calling-name">{cp.name}</span>
                    <span className={`calling-time${isCancelled ? ' cancelled' : isDelayed ? ' delayed' : ''}`}>
                      {timeStr}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { stations } from '../../lib/stations'

const REFRESH_SECS = 10
const ROWS_STEP = 20
const MAX_ROWS = 150

// ─── Status helpers ───────────────────────────────────────────────

function getStatus(service) {
  if (service.cancelled) return { type: 'cancelled', label: 'Cancelled' }

  const etd = service.etd

  if (etd === 'Delayed') return { type: 'delayed', label: 'Delayed' }

  if (!etd || etd === 'On time') {
    if (!service.std) return { type: 'on-time', label: 'On time' }
    const [h, m] = service.std.split(':').map(Number)
    const now = new Date()
    if (now.getHours() * 60 + now.getMinutes() > h * 60 + m)
      return { type: 'departed', label: 'Departed' }
    return { type: 'on-time', label: 'On time' }
  }

  const [h, m] = etd.split(':').map(Number)
  const now = new Date()
  if (now.getHours() * 60 + now.getMinutes() > h * 60 + m)
    return { type: 'departed', label: 'Departed' }
  return { type: 'delayed', label: etd }
}

const STATUS_TAG = {
  'on-time':  'govuk-tag--green',
  'delayed':  'govuk-tag--orange',
  'cancelled':'govuk-tag--red',
  'departed': 'govuk-tag--grey',
}

// ─── Layout components ────────────────────────────────────────────

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

// ─── Station page ─────────────────────────────────────────────────

export default function StationPage() {
  const router = useRouter()
  const { crs, to } = router.query

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [countdown, setCountdown] = useState(REFRESH_SECS)
  const [numRows, setNumRows] = useState(ROWS_STEP)
  const [showDeparted, setShowDeparted] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')

  const numRowsRef = useRef(ROWS_STEP)
  const sentinelRef = useRef(null)

  const hasMore = data && data.services.length >= numRows && numRows < MAX_ROWS
  const reachedEnd = data && !hasMore && (
    data.services.length < numRows ||
    numRows > ROWS_STEP
  )

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

  useEffect(() => {
    if (!router.isReady) return
    setLoading(true)
    setData(null)
    setNumRows(ROWS_STEP)
    numRowsRef.current = ROWS_STEP
    fetchData(ROWS_STEP)
  }, [router.isReady, crs, to]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const clearFilter = () => router.replace(`/station/${crs}`)

  const visibleServices = data?.services.filter(
    (s) => showDeparted || getStatus(s).type !== 'departed'
  ) ?? []

  return (
    <>
      <Head>
        <title>{stationName} Departures – Train Times</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <GovHeader />

      <div className="govuk-width-container">
        <PhaseBanner />

        <main className="govuk-main-wrapper" id="main-content">
          <a
            className="govuk-back-link"
            href="/"
            onClick={(e) => { e.preventDefault(); router.push('/') }}
          >
            Back
          </a>

          <h1 className="govuk-heading-l" style={{ marginBottom: '10px' }}>
            {stationName}
            {filterName && (
              <span className="govuk-caption-l">to {filterName}</span>
            )}
          </h1>

          {/* Controls */}
          <div className="filter-controls">
            <div>
              {to ? (
                <p className="govuk-body" style={{ marginBottom: 0 }}>
                  Showing trains to <strong>{filterName}</strong>.{' '}
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit', fontSize: 'inherit', color: 'var(--govuk-link-colour)', textDecoration: 'underline' }}
                    onClick={clearFilter}
                  >
                    Show all destinations
                  </button>
                </p>
              ) : (
                <button
                  className="govuk-button govuk-button--secondary govuk-!-margin-bottom-0"
                  onClick={() => setShowFilter((v) => !v)}
                >
                  {showFilter ? 'Cancel filter' : 'Filter by destination'}
                </button>
              )}
            </div>

            <div className="govuk-checkboxes govuk-checkboxes--small" style={{ marginBottom: 0 }}>
              <div className="govuk-checkboxes__item">
                <input
                  className="govuk-checkboxes__input"
                  id="show-departed"
                  type="checkbox"
                  checked={showDeparted}
                  onChange={(e) => setShowDeparted(e.target.checked)}
                />
                <label className="govuk-checkboxes__label" htmlFor="show-departed">
                  Show departed
                </label>
              </div>
            </div>
          </div>

          {/* Destination filter search */}
          {showFilter && !to && (
            <div className="govuk-form-group">
              <label className="govuk-label" htmlFor="dest-filter">
                Search destination station
              </label>
              <input
                className="govuk-input govuk-input--width-20"
                id="dest-filter"
                type="search"
                value={filterSearch}
                onChange={(e) => setFilterSearch(e.target.value)}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              {filterResults.length > 0 && (
                <ul className="route-list" style={{ marginTop: 4, maxWidth: '320px' }}>
                  {filterResults.map((s) => (
                    <li key={s.crs}>
                      <button className="route-link" onClick={() => applyFilter(s.crs)}>
                        <span>{s.name}</span>
                        <span className="route-meta">{s.crs}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Refresh bar */}
          <div className="refresh-bar">
            <p className="govuk-body-s govuk-!-margin-bottom-0">
              <span className="live-dot" aria-hidden="true" />
              {loading && data ? 'Updating…' : `Refreshes in ${countdown}s`}
            </p>
            <button className="refresh-btn" onClick={() => fetchData(numRowsRef.current)}>
              Refresh now
            </button>
          </div>

          {/* Loading */}
          {loading && !data && (
            <div className="spinner-wrap">
              <div className="spinner" role="status" aria-label="Loading departures" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="govuk-error-summary" data-module="govuk-error-summary">
              <div role="alert">
                <h2 className="govuk-error-summary__title">There is a problem</h2>
                <div className="govuk-error-summary__body">
                  <p className="govuk-body">{error}</p>
                  <button
                    className="govuk-button govuk-button--secondary"
                    onClick={() => fetchData(numRowsRef.current)}
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Departures table */}
          {data && !error && (
            <>
              {visibleServices.length === 0 ? (
                <div className="govuk-inset-text">
                  <p className="govuk-body">
                    {to
                      ? `No trains to ${filterName} in the next 2 hours.`
                      : 'No departures in the next 2 hours.'}
                  </p>
                </div>
              ) : (
                <div className="dep-table-wrap">
                  <table className="govuk-table dep-table">
                    <caption className="govuk-table__caption govuk-visually-hidden">
                      Departures from {stationName}{filterName ? ` to ${filterName}` : ''}
                    </caption>
                    <thead className="govuk-table__head">
                      <tr className="govuk-table__row">
                        <th className="govuk-table__header" scope="col">Departs</th>
                        <th className="govuk-table__header" scope="col">Destination</th>
                        <th className="govuk-table__header" scope="col">Status</th>
                        <th className="govuk-table__header" scope="col">Plat.</th>
                        <th className="govuk-table__header" scope="col">
                          <span className="govuk-visually-hidden">Calling points</span>
                        </th>
                      </tr>
                    </thead>
                    {visibleServices.map((service, i) => (
                      <ServiceRows key={i} service={service} />
                    ))}
                  </table>
                </div>
              )}

              <div ref={sentinelRef} />

              {loadingMore && (
                <div className="spinner-wrap">
                  <div className="spinner spinner--sm" role="status" aria-label="Loading more" />
                </div>
              )}

              {reachedEnd && visibleServices.length > 0 && (
                <div className="end-of-list">
                  {to ? (
                    <>
                      All trains to {filterName} shown &middot;{' '}
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

// ─── Service rows (one tbody per service) ────────────────────────

function ServiceRows({ service }) {
  const [showCalling, setShowCalling] = useState(false)
  const [callingPoints, setCallingPoints] = useState(null)
  const [callingLoading, setCallingLoading] = useState(false)
  const [callingError, setCallingError] = useState(null)

  const status = getStatus(service)
  const destText = service.destinations.map((d) => d.name).join(' & ')
  const viaText = service.destinations.map((d) => d.via).filter(Boolean).join(' & ')

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

  return (
    <tbody className="govuk-table__body">
      <tr className="govuk-table__row">
        <td className="govuk-table__cell dep-td-time">
          <span className="dep-time">{service.std || '??:??'}</span>
          {status.type === 'delayed' && service.etd && service.etd !== 'Delayed' && (
            <div className="dep-etd">Exp. {service.etd}</div>
          )}
        </td>

        <td className="govuk-table__cell dep-td-dest">
          <div>{destText}</div>
          {viaText && (
            <div className="govuk-body-s govuk-hint" style={{ marginBottom: 0 }}>{viaText}</div>
          )}
          <div className="govuk-body-s govuk-hint" style={{ marginBottom: 0 }}>{service.operator}</div>
        </td>

        <td className="govuk-table__cell dep-td-status">
          <strong className={`govuk-tag ${STATUS_TAG[status.type] ?? ''}`}>
            {status.label}
          </strong>
        </td>

        <td className="govuk-table__cell dep-td-plat" style={{ textAlign: 'center' }}>
          {service.platform
            ? <span className="dep-plat">{service.platform}</span>
            : <span className="govuk-hint">TBC</span>
          }
        </td>

        <td className="govuk-table__cell dep-td-stops">
          {service.serviceID && (
            <button
              className="dep-toggle-btn"
              onClick={toggleCalling}
              aria-expanded={showCalling}
            >
              {showCalling ? 'Hide stops' : 'Show stops'}
            </button>
          )}
        </td>
      </tr>

      {showCalling && (
        <tr className="govuk-table__row dep-calling-row">
          <td className="govuk-table__cell" colSpan={5}>
            {callingLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="spinner spinner--sm" />
                <span className="govuk-body-s">Loading…</span>
              </div>
            )}
            {callingError && (
              <p className="govuk-error-message">{callingError}</p>
            )}
            {callingPoints && (
              <ul className="dep-calling-list govuk-body-s">
                {callingPoints.map((cp, i) => {
                  const timeStr = cp.at || cp.et || cp.st || '—'
                  const isDelayed = cp.et && cp.et !== 'On time' && cp.et !== cp.st
                  return (
                    <li key={i}>
                      <span>{cp.name}</span>
                      <span className={`dep-calling-time${cp.cancelled ? ' cancelled' : isDelayed ? ' delayed' : ''}`}>
                        {timeStr}
                        {cp.cancelled && (
                          <strong className="govuk-tag govuk-tag--red govuk-!-margin-left-1" style={{ fontSize: '0.75rem' }}>
                            Cancelled
                          </strong>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </td>
        </tr>
      )}
    </tbody>
  )
}

import { XMLParser } from 'fast-xml-parser'

const ENDPOINT = 'https://lite.realtime.nationalrail.co.uk/OpenLDBWS/ldb12.asmx'

const SOAP_ACTION_BOARD = 'http://thalesgroup.com/RTTI/2012-01-13/ldb/GetDepartureBoard'
const SOAP_ACTION_DETAILS = 'http://thalesgroup.com/RTTI/2012-01-13/ldb/GetServiceDetails'
const FALLBACK_BOARD_ROWS = 10
const REQUEST_TIMEOUT_MS = 10000

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function buildBoardRequest(token, crs, filterCrs, numRows = 20) {
  const safeToken = escapeXml(token)
  const safeCrs = escapeXml(crs)
  const filter = filterCrs
    ? `<ldb:filterCrs>${escapeXml(filterCrs)}</ldb:filterCrs><ldb:filterType>to</ldb:filterType>`
    : ''

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types"
  xmlns:ldb="http://thalesgroup.com/RTTI/2021-11-01/ldb/">
  <soap:Header>
    <typ:AccessToken>
      <typ:TokenValue>${safeToken}</typ:TokenValue>
    </typ:AccessToken>
  </soap:Header>
  <soap:Body>
    <ldb:GetDepartureBoardRequest>
      <ldb:numRows>${numRows}</ldb:numRows>
      <ldb:crs>${safeCrs}</ldb:crs>
      ${filter}
      <ldb:timeOffset>-2</ldb:timeOffset>
    </ldb:GetDepartureBoardRequest>
  </soap:Body>
</soap:Envelope>`
}

function buildDetailsRequest(token, serviceID) {
  const safeToken = escapeXml(token)
  const safeServiceID = escapeXml(serviceID)
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:typ="http://thalesgroup.com/RTTI/2013-11-28/Token/types"
  xmlns:ldb="http://thalesgroup.com/RTTI/2021-11-01/ldb/">
  <soap:Header>
    <typ:AccessToken>
      <typ:TokenValue>${safeToken}</typ:TokenValue>
    </typ:AccessToken>
  </soap:Header>
  <soap:Body>
    <ldb:GetServiceDetailsRequest>
      <ldb:serviceID>${safeServiceID}</ldb:serviceID>
    </ldb:GetServiceDetailsRequest>
  </soap:Body>
</soap:Envelope>`
}

function ensureArray(x) {
  if (x === undefined || x === null) return []
  return Array.isArray(x) ? x : [x]
}

function makeParser() {
  return new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    processEntities: false,
    isArray: (name) =>
      ['service', 'callingPoint', 'callingPointList', 'location'].includes(name),
  })
}

function parseService(svc) {
  const destinations = ensureArray(svc.destination?.location).map((l) => ({
    name: l.locationName,
    crs: l.crs,
    via: l.via || null,
  }))

  return {
    serviceID: svc.serviceID || null,
    std: svc.std || null,
    etd: svc.etd || null,
    platform: svc.platform || null,
    operator: svc.operator || null,
    operatorCode: svc.operatorCode || null,
    serviceType: svc.serviceType || 'train',
    cancelled: svc.isCancelled === true || svc.isCancelled === 'true',
    destinations,
  }
}

async function requestDepartureBoard(token, crs, filterCrs, numRows) {
  const xml = buildBoardRequest(token, crs, filterCrs, numRows)
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: SOAP_ACTION_BOARD,
    },
    body: xml,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`OpenLDB HTTP error: ${response.status}`)

  const text = await response.text()
  const parser = makeParser()
  const doc = parser.parse(text)
  const body = doc?.Envelope?.Body

  if (body?.Fault) {
    const msg = body.Fault.faultstring || 'Unknown SOAP fault'
    throw new Error(`OpenLDB error: ${msg}`)
  }

  const board = body?.GetDepartureBoardResponse?.GetStationBoardResult

  if (!board) throw new Error('Unexpected response from OpenLDB')

  const services = ensureArray(board.trainServices?.service).map(parseService)

  return {
    stationName: board.locationName || crs,
    crs: board.crs || crs,
    generatedAt: board.generatedAt || null,
    filterLocationName: board.filterLocationName || null,
    services,
  }
}

export async function getDepartures(crs, filterCrs = null, numRows = 20) {
  const token = process.env.LDB_TOKEN
  if (!token) throw new Error('LDB_TOKEN environment variable is not set')

  const normalizedCrs = crs.toUpperCase()
  const normalizedFilterCrs = filterCrs?.toUpperCase() || null

  try {
    return await requestDepartureBoard(token, normalizedCrs, normalizedFilterCrs, numRows)
  } catch (error) {
    const isOpenLdbFault = error?.message?.startsWith('OpenLDB error:')
    if (!isOpenLdbFault || numRows <= FALLBACK_BOARD_ROWS) throw error

    return requestDepartureBoard(token, normalizedCrs, normalizedFilterCrs, FALLBACK_BOARD_ROWS)
  }
}

export async function getServiceDetails(serviceID) {
  const token = process.env.LDB_TOKEN
  if (!token) throw new Error('LDB_TOKEN environment variable is not set')

  const xml = buildDetailsRequest(token, serviceID)

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: SOAP_ACTION_DETAILS,
    },
    body: xml,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) throw new Error(`OpenLDB HTTP error: ${response.status}`)

  const text = await response.text()
  const parser = makeParser()
  const doc = parser.parse(text)
  const body = doc?.Envelope?.Body

  if (body?.Fault) {
    const msg = body.Fault.faultstring || 'Unknown SOAP fault'
    throw new Error(`OpenLDB error: ${msg}`)
  }

  const details = body?.GetServiceDetailsResponse?.GetServiceDetailsResult

  if (!details) throw new Error('Unexpected response from OpenLDB')

  const callingPoints = ensureArray(details.subsequentCallingPoints?.callingPointList)
    .flatMap((list) => ensureArray(list.callingPoint))
    .map((cp) => ({
      name: cp.locationName,
      crs: cp.crs,
      st: cp.st || null,
      et: cp.et || null,
      at: cp.at || null,
      cancelled: cp.isCancelled === true || cp.isCancelled === 'true',
    }))

  return { callingPoints }
}

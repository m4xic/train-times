import { getDepartures } from '../../lib/ldb'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { from, to, rows } = req.query

  if (!from || typeof from !== 'string' || !/^[A-Za-z]{3}$/.test(from)) {
    return res.status(400).json({ error: 'Invalid or missing "from" CRS code' })
  }

  if (to && (typeof to !== 'string' || !/^[A-Za-z]{3}$/.test(to))) {
    return res.status(400).json({ error: 'Invalid "to" CRS code' })
  }

  if (rows !== undefined && (typeof rows !== 'string' || !/^\d{1,3}$/.test(rows))) {
    return res.status(400).json({ error: 'Invalid "rows" value' })
  }

  try {
    const numRows = Math.min(Math.max(Number(rows) || 20, 1), 150)
    const data = await getDepartures(from, to || null, numRows)
    // Cache for 30 s on CDN, serve stale for up to 60 s while revalidating
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(data)
  } catch (err) {
    console.error('[departures]', err)
    return res.status(502).json({ error: 'Failed to fetch departures' })
  }
}

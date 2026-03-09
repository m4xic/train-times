import { getDepartures } from '../../lib/ldb'

export default async function handler(req, res) {
  const { from, to, rows } = req.query

  if (!from || typeof from !== 'string' || !/^[A-Za-z]{3}$/.test(from)) {
    return res.status(400).json({ error: 'Invalid or missing "from" CRS code' })
  }

  if (to && (typeof to !== 'string' || !/^[A-Za-z]{3}$/.test(to))) {
    return res.status(400).json({ error: 'Invalid "to" CRS code' })
  }

  try {
    const numRows = Math.min(Math.max(parseInt(rows) || 20, 1), 150)
    const data = await getDepartures(from, to || null, numRows)
    // Cache for 30 s on CDN, serve stale for up to 60 s while revalidating
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(data)
  } catch (err) {
    console.error('[departures]', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch departures' })
  }
}

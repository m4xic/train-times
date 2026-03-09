import { getServiceDetails } from '../../lib/ldb'

export default async function handler(req, res) {
  const { id } = req.query

  if (!id || typeof id !== 'string' || id.length === 0) {
    return res.status(400).json({ error: 'Missing service ID' })
  }

  try {
    const data = await getServiceDetails(id)
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(data)
  } catch (err) {
    console.error('[service]', err)
    return res.status(500).json({ error: err.message || 'Failed to fetch service details' })
  }
}

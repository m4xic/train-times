import { getServiceDetails } from '../../lib/ldb'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string' || id.length > 512 || /[\u0000-\u001f\u007f]/.test(id)) {
    return res.status(400).json({ error: 'Invalid or missing service ID' })
  }

  try {
    const data = await getServiceDetails(id)
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return res.status(200).json(data)
  } catch (err) {
    console.error('[service]', err)
    return res.status(502).json({ error: 'Failed to fetch service details' })
  }
}

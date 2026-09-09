// Vercel serverless proxy: crawlers hitting /share/:id are rewritten here,
// then we fetch Go's OG HTML (stats only — no JSON payloads).

export default async function handler(req, res) {
  const id = String(req.query.id || '')
  if (!/^[a-zA-Z0-9]{10}$/.test(id)) {
    res.status(404)
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.setHeader('x-robots-tag', 'noindex, nofollow')
    res.send('Share not found')
    return
  }

  const api = (process.env.API_BASE_URL || process.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  if (!api) {
    res.status(502).json({ error: 'API_BASE_URL is not configured' })
    return
  }

  const proto = req.headers['x-forwarded-proto'] || 'https'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  const publicBase = `${proto}://${host}`

  const upstream = await fetch(`${api}/share/${encodeURIComponent(id)}`, {
    headers: { 'X-Public-Base-URL': publicBase },
  })
  const html = await upstream.text()
  res.status(upstream.status)
  res.setHeader('content-type', 'text/html; charset=utf-8')
  const robots = upstream.headers.get('x-robots-tag')
  if (robots) {
    res.setHeader('x-robots-tag', robots)
  }
  res.send(html)
}

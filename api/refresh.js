// c:\Users\sam10\OneDrive\Documentos\AgroLink\api\refresh.js
export default async function handler(req, res) {
  const method = (req.method || 'POST').toUpperCase()
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
    res.status(204).end()
    return
  }
  if (method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const base = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com'
  const url = `${base.replace(/\/$/, '')}/api/v1/auth/refresh`

  const HOP = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','host'])
  const out = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k) continue
    const key = k.toLowerCase()
    if (HOP.has(key)) continue
    if (key.startsWith('x-vercel')) continue
    out.set(k, Array.isArray(v) ? v.join(',') : (v || ''))
  }
  if (!out.has('content-type')) out.set('content-type', 'application/json')
  out.set('accept', 'application/json')

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 12000)
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    const body = Buffer.concat(chunks)
    if (body.length && !out.has('content-length')) out.set('content-length', String(body.length))

    let resp
    let err
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        resp = await fetch(url, { method: 'POST', headers: out, body, signal: controller.signal })
        if (![502,503,504].includes(resp.status)) break
        await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
      } catch (e) {
        err = e
        if (attempt < 1) await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
      }
    }
    if (!resp) {
      res.status(502).json({ ok: false, error: (err && err.message) || 'fetch failed' })
      return
    }
    res.status(resp.status)
    resp.headers.forEach((value, key) => { if (!HOP.has(key.toLowerCase())) { try { res.setHeader(key, value) } catch {} } })
    const buf = Buffer.from(await resp.arrayBuffer())
    res.end(buf)
  } finally {
    clearTimeout(id)
  }
}
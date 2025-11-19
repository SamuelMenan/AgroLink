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
  const health = `${base.replace(/\/$/, '')}/actuator/health`
  try { await fetch(health, { cache: 'no-store' }) } catch {}
  await new Promise(r => setTimeout(r, 250))

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
    const bodyJson = body.length ? (() => { try { return JSON.parse(body.toString('utf8')) } catch { return {} } })() : {}
    if (body.length && !out.has('content-length')) out.set('content-length', String(body.length))

    let resp
    let err
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        resp = await fetch(url, { method: 'POST', headers: out, body, signal: controller.signal })
        if (![502,503,504].includes(resp.status)) break
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
      } catch (e) {
        err = e
        if (attempt < 2) await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
      }
    }
    if (!resp || (resp.status >= 500 && resp.status <= 599)) {
      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
      const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
      if (supabaseUrl && supabaseAnon) {
        const endpoint = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`
        const sb = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'accept': 'application/json', 'apikey': supabaseAnon, 'Authorization': `Bearer ${supabaseAnon}` },
          body: JSON.stringify({ refresh_token: bodyJson.refresh_token })
        })
        const text = await sb.text()
        res.status(sb.ok ? sb.status : 502)
        res.setHeader('content-type', 'application/json')
        res.end(text)
        return
      }
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
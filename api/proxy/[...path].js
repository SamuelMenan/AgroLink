// Serverless proxy to the Render backend to avoid browser CORS and handle retries/timeouts

const HOP_BY_HOP = new Set([
  'connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','host'
])

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export default async function handler(req, res) {
  const base = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com'
  const path = Array.isArray(req.query.path) ? req.query.path.join('/') : (req.query.path || '')
  const urlObj = new URL(req.url, 'http://localhost')
  const sp = urlObj.searchParams
  sp.delete('path')
  const qs = sp.toString()
  const url = `${base.replace(/\/$/, '')}/${path}${qs ? `?${qs}` : ''}`

  const method = req.method || 'GET'
  const outgoingHeaders = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (!k) continue
    const key = k.toLowerCase()
    if (HOP_BY_HOP.has(key)) continue
    // do not forward vercel specific headers
    if (key.startsWith('x-vercel')) continue
    outgoingHeaders.set(k, Array.isArray(v) ? v.join(',') : (v || ''))
  }

  // Explicitly set Accept to JSON when none
  if (!outgoingHeaders.has('accept')) outgoingHeaders.set('accept', '*/*')

  const makeRequest = async () => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 8000)
    try {
      let body
      if (!['GET','HEAD'].includes(method.toUpperCase())) {
        const chunks = []
        for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        body = Buffer.concat(chunks)
        if (body.length && !outgoingHeaders.has('content-length')) outgoingHeaders.set('content-length', String(body.length))
      }
      const resp = await fetch(url, {
        method,
        headers: outgoingHeaders,
        body,
        signal: controller.signal,
      })
      return resp
    } finally { clearTimeout(id) }
  }

  let resp
  let attempt = 0
  const max = 3
  let lastErr
  for (; attempt < max; attempt++) {
    try {
      resp = await makeRequest()
      if ([502,503,504].includes(resp.status) && attempt < max - 1) {
        await sleep(300 * (attempt + 1))
        continue
      }
      break
    } catch (e) {
      lastErr = e
      if (attempt < max - 1) { await sleep(300 * (attempt + 1)); continue }
      console.error('[proxy] fetch error', e && e.message)
      res.status(502).json({ ok: false, error: (e && e.message) || 'proxy fetch failed' })
      return
    }
  }

  // Forward status and headers (excluding hop-by-hop)
  res.status(resp.status)
  resp.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      try { res.setHeader(key, value) } catch {}
    }
  })
  const buf = Buffer.from(await resp.arrayBuffer())
  res.end(buf)
}

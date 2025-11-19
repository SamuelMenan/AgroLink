// c:\Users\sam10\OneDrive\Documentos\AgroLink\api\conversations\participants.js
export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()
  if (method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
    res.status(204).end(); return
  }
  if (method !== 'GET') { res.status(405).json({ error: 'Method Not Allowed' }); return }

  const urlObj = new URL(req.url, 'http://localhost')
  const cid = urlObj.searchParams.get('conversation_id') || ''
  if (!cid) { res.status(400).json({ error: 'conversation_id requerido' }); return }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) { res.status(503).json({ error: 'Supabase no configurado' }); return }

  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/conversation_participants?select=user_id&conversation_id=eq.${encodeURIComponent(cid)}`
  const authHeader = req.headers['authorization']
  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
    'apikey': supabaseAnon,
    'Authorization': (typeof authHeader === 'string' && authHeader.length) ? authHeader : `Bearer ${supabaseAnon}`,
  }

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 9000)
  try {
    const resp = await fetch(endpoint, { headers, signal: controller.signal })
    res.status(resp.status)
    resp.headers.forEach((v, k) => {
      const key = k.toLowerCase()
      if (!['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','host','content-encoding','content-length'].includes(key)) {
        try { res.setHeader(k, v) } catch {}
      }
    })
    if (!res.getHeader('content-type')) { try { res.setHeader('content-type', 'application/json') } catch {} }
    const buf = Buffer.from(await resp.arrayBuffer())
    res.end(buf)
  } catch (e) {
    res.status(502).json({ ok: false, error: (e && e.message) || 'fetch failed' })
  } finally { clearTimeout(id) }
}
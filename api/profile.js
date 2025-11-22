const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()
  const urlObj = new URL(req.url, 'http://localhost')
  const pathParts = urlObj.pathname.split('/')
  const userId = decodeURIComponent(pathParts[pathParts.length - 1] || '')

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PATCH,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (method === 'OPTIONS') { res.status(204).end(); return }
  if (method === 'HEAD') { res.status(200).end(); return }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(503).json({ error: 'Supabase no configurado' }); return
  }

  if (!userId) { res.status(400).json({ error: 'Falta userId en la ruta' }); return }

  const authHeader = req.headers.authorization || ''
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': authHeader && authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  }

  try {
    if (method === 'GET') {
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,full_name,email,phone,address,name_visibility,email_visibility,phone_visibility,address_visibility`, { headers })
      if (resp.status === 404) {
        res.status(200).json({
          user_id: userId,
          full_name: '',
          email: '',
          phone: '',
          address: '',
          name_visibility: 'contacts',
          email_visibility: 'contacts',
          phone_visibility: 'contacts',
          address_visibility: 'private'
        })
        return
      }
      const data = await resp.json().catch(() => [])
      const row = Array.isArray(data) && data.length > 0 ? data[0] : null
      res.status(200).json(row || {
        user_id: userId,
        full_name: '',
        email: '',
        phone: '',
        address: '',
        name_visibility: 'contacts',
        email_visibility: 'contacts',
        phone_visibility: 'contacts',
        address_visibility: 'private'
      })
      return
    }

    if (method === 'PATCH') {
      let body = null
      if ((req.headers['content-type'] || '').includes('application/json')) {
        const chunks = []
        for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        const raw = Buffer.concat(chunks).toString('utf8')
        body = raw ? JSON.parse(raw) : {}
      }
      const patch = body || {}
      if (typeof patch.full_name === 'string') {
        patch.full_name = patch.full_name.trim()
      }
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(patch)
      })
      const data = await resp.json().catch(() => [])
      const row = Array.isArray(data) && data.length > 0 ? data[0] : { user_id: userId, ...patch }
      res.status(resp.ok ? 200 : resp.status).json(row)
      return
    }

    res.status(405).json({ error: 'Método no permitido' })
  } catch (e) {
    res.status(500).json({ error: e && e.message ? e.message : 'Error interno' })
  }
}

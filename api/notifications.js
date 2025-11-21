/**
 * Unified notifications API - consolidates all notification operations
 * GET /api/notifications?user_id=xxx&limit=xxx - Get user notifications
 * PATCH /api/notifications/read-all?user_id=xxx - Mark all as read
 * POST /api/notifications - Create notification (if needed)
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,PATCH,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*')
  
  if (method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  
  if (!supabaseUrl || !supabaseAnon) {
    res.status(503).json({ error: 'Supabase no configurado' })
    return
  }

  const urlObj = new URL(req.url, 'http://localhost')
  const userId = urlObj.searchParams.get('user_id') || ''

  try {
    if (method === 'GET') {
      // Get user notifications - consolidated from by-user.js
      if (!userId) {
        res.status(400).json({ error: 'user_id requerido' })
        return
      }

      const limit = urlObj.searchParams.get('limit') || '12'
      const endpoint = `${supabaseUrl.replace(//$/, '')}/rest/v1/notifications?select=*` +
                       `&user_id=eq.${encodeURIComponent(userId)}` +
                       `&order=created_at.desc&limit=${encodeURIComponent(limit)}`

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
        let resp
        let lastErr
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            resp = await fetch(endpoint, { headers, signal: controller.signal })
            if (![502,503,504].includes(resp.status)) break
            await sleep(300 * (attempt + 1))
          } catch (e) {
            lastErr = e
            if (attempt < 2) await sleep(300 * (attempt + 1))
          }
        }
        
        if (!resp) {
          res.status(502).json({ ok: false, error: (lastErr && lastErr.message) || 'fetch failed' })
          return
        }
        
        res.status(resp.status)
        resp.headers.forEach((v, k) => {
          const key = k.toLowerCase()
          if (!['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade','host','content-encoding','content-length'].includes(key)) {
            try { res.setHeader(k, v) } catch {}
          }
        })
        
        if (!res.getHeader('content-type')) { 
          try { res.setHeader('content-type', 'application/json') } catch {} 
        }
        
        const buf = Buffer.from(await resp.arrayBuffer())
        res.end(buf)
        
      } finally {
        clearTimeout(id)
      }

    } else if (method === 'PATCH') {
      // Mark all notifications as read - consolidated from read-all.js
      if (!userId) {
        res.status(400).json({ error: 'user_id requerido' })
        return
      }

      const authHeader = req.headers['authorization']
      if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authorization requerido' })
        return
      }

      const endpoint = `${supabaseUrl.replace(//$/, '')}/rest/v1/notifications?user_id=eq.${encodeURIComponent(userId)}`
      const nowIso = new Date().toISOString()
      
      const headers = {
        'accept': 'application/json',
        'content-type': 'application/json',
        'apikey': supabaseAnon,
        'Authorization': String(authHeader),
        'Prefer': 'return=minimal',
      }

      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), 9000)
      
      try {
        const resp = await fetch(endpoint, { 
          method: 'PATCH', 
          headers, 
          body: JSON.stringify({ read_at: nowIso }), 
          signal: controller.signal 
        })
        
        res.status(resp.ok ? resp.status : 502)
        res.setHeader('content-type', 'application/json')
        const text = await resp.text().catch(() => '')
        res.end(text || '{}')
        
      } catch (e) {
        res.status(502).json({ ok: false, error: (e && e.message) || 'fetch failed' })
      } finally {
        clearTimeout(id)
      }

    } else {
      res.status(405).json({ error: 'Método no permitido' })
    }
  } catch (error) {
    console.error('[notifications] Error:', error)
    res.status(500).json({ error: 'Error interno del servidor', message: error.message })
  }
}
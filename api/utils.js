/**
 * Unified utility functions - consolidates health check and backend warmup
 * GET /api/utils/health - Health check
 * POST /api/utils/warm - Backend warmup
 * GET /api/utils/status - Combined status
 */

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function warmupBackend() {
  const target = process.env.BACKEND_URL || 'https://agrolinkbackend.onrender.com/actuator/health'
  const started = Date.now()
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 5000)
  
  try {
    console.log('[utils] Warming up backend:', target)
    const r = await fetch(target, { cache: 'no-store', signal: controller.signal })
    const text = await r.text().catch(() => '')
    const elapsed = Date.now() - started
    console.log('[utils] Backend warmup completed:', r.status, 'in', elapsed, 'ms')
    return { ok: true, status: r.status, body: text.slice(0, 200), elapsed }
  } catch (e) {
    console.log('[utils] Backend warmup error:', e && e.message)
    return { ok: false, error: (e && e.message) || 'fetch failed' }
  } finally {
    clearTimeout(id)
  }
}

export default async function handler(req, res) {
  const method = (req.method || 'GET').toUpperCase()
  const urlObj = new URL(req.url, 'http://localhost')
  const action = urlObj.pathname.split('/').pop() || 'status'
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  
  if (method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    switch (action) {
      case 'health':
        // Simple health check
        res.status(200).json({ 
          ok: true, 
          time: new Date().toISOString(),
          service: 'agrolink-utils'
        })
        break
        
      case 'warm':
        // Backend warmup
        if (method !== 'POST') {
          res.status(405).json({ error: 'Method not allowed' })
          return
        }
        
        const warmupResult = await warmupBackend()
        res.status(200).json(warmupResult)
        break
        
      case 'status':
      default:
        // Combined status check
        const healthCheck = { 
          ok: true, 
          time: new Date().toISOString(),
          service: 'agrolink-utils'
        }
        
        // Run backend warmup in background for status endpoint
        warmupBackend().then(result => {
          console.log('[utils] Background warmup completed:', result.ok)
        }).catch(err => {
          console.log('[utils] Background warmup failed:', err.message)
        })
        
        res.status(200).json({
          ...healthCheck,
          backend_warmup_initiated: true
        })
        break
    }
    
  } catch (error) {
    console.error('[utils] Error:', error)
    res.status(500).json({ 
      ok: false, 
      error: error.message || 'Internal server error' 
    })
  }
}
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  const origin = req.headers.origin
  const allowedOrigins = [
    'https://agro-link-jet.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173'
  ]
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,HEAD')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, x-client-request-id')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }
  if (req.method === 'HEAD') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Supabase no configurado' })
  }

  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado. Se requiere token de usuario.' })
  }
  const userToken = authHeader.split(' ')[1]
  if (!userToken || userToken === SUPABASE_ANON_KEY) {
    return res.status(401).json({ error: 'Se requiere token de usuario autenticado, no anon key' })
  }

  const urlObj = new URL(req.url, 'http://localhost')
  const pathParts = urlObj.pathname.split('/')
  const fnName = pathParts[pathParts.length - 1]
  if (!fnName) {
    return res.status(400).json({ error: 'Nombre de función RPC requerido' })
  }

  let body = {}
  if ((req.headers['content-type'] || '').includes('application/json')) {
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      const raw = Buffer.concat(chunks).toString('utf8')
      body = raw ? JSON.parse(raw) : {}
    } catch (e) {
      return res.status(400).json({ error: 'Body JSON inválido', details: e.message })
    }
  }

  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/${fnName}`
  const rpcResp = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const text = await rpcResp.text()
  if (!rpcResp.ok) {
    return res.status(rpcResp.status).json({ error: text })
  }
  try {
    const json = JSON.parse(text)
    return res.status(200).json(json)
  } catch {
    return res.status(200).json(text)
  }
}
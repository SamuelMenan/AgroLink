// Workaround for Vercel's DELETE method blocking - handles product deletion via POST
export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')
  
  console.log('[products-delete] Incoming request:', req.method)
  
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed, use POST' })
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnon) {
    res.status(502).json({ error: 'Supabase not configured' })
    return
  }

  // Read body to get product ID
  try {
    const chunks = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    const body = Buffer.concat(chunks)
    const { id } = JSON.parse(body.toString('utf8'))

    if (!id) {
      res.status(400).json({ error: 'Missing product ID' })
      return
    }

    console.log('[products-delete] Deleting product:', id)

    const supabaseHeaders = {
      'accept': 'application/json',
      'content-type': 'application/json',
      'apikey': supabaseAnon,
      'Authorization': req.headers.authorization || `Bearer ${supabaseAnon}`,
    }

    const supabaseEndpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/products?id=eq.${id}`
    
    const supabaseResp = await fetch(supabaseEndpoint, {
      method: 'DELETE',
      headers: supabaseHeaders,
      signal: AbortSignal.timeout(15000)
    })

    console.log('[products-delete] Supabase response:', supabaseResp.status)
    
    res.status(supabaseResp.status)
    res.end()
  } catch (e) {
    console.error('[products-delete] Error:', e)
    res.status(502).json({ error: e.message })
  }
}

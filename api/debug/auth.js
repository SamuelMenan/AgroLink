/**
 * Debug endpoint for authentication issues
 * GET /api/debug/auth - Returns decoded token information
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin
  const allowedOrigins = [
    'https://agro-link-jet.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173'
  ]
  
  const isAllowedOrigin = allowedOrigins.includes(origin)
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0]
  
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'No autenticado',
        details: { reason: 'Missing or invalid authorization header' }
      })
    }

    const token = authHeader.split(' ')[1]
    
    // Debug token information
    const debugInfo = {
      tokenLength: token.length,
      tokenPreview: token.substring(0, 20) + '...',
      tokenParts: token.split('.').length,
      isAnonymousToken: token === SUPABASE_ANON_KEY,
      hasValidFormat: token.split('.').length === 3
    }

    // Try to decode the token
    let decodedPayload = null
    let decodeError = null
    
    if (debugInfo.hasValidFormat) {
      try {
        const payloadStr = token.split('.')[1]
        const paddedPayload = payloadStr + '='.repeat((4 - payloadStr.length % 4) % 4)
        decodedPayload = JSON.parse(Buffer.from(paddedPayload, 'base64').toString('utf8'))
        
        debugInfo.userId = decodedPayload.sub || decodedPayload.user_id || decodedPayload.id || null
        debugInfo.payloadKeys = Object.keys(decodedPayload)
        debugInfo.tokenExpiration = decodedPayload.exp ? new Date(decodedPayload.exp * 1000).toISOString() : null
        debugInfo.tokenIssued = decodedPayload.iat ? new Date(decodedPayload.iat * 1000).toISOString() : null
      } catch (e) {
        decodeError = e.message
        debugInfo.decodeError = decodeError
      }
    }

    return res.status(200).json({
      debug: debugInfo,
      decodedPayload,
      timestamp: new Date().toISOString(),
      origin: origin
    })

  } catch (error) {
    console.error('[debug-auth] Error:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
/**
 * Phone verification endpoint for SMS recovery
 * POST /api/auth/verify-phone-recovery - Verifies SMS recovery code
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' })
  }

  try {
    const { phone, token } = req.body
    
    if (!phone || !token) {
      return res.status(400).json({ 
        error: 'Teléfono y código requeridos',
        details: { reason: 'Missing phone or token' }
      })
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
    
    // Call Supabase to verify the phone token
    const response = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        phone: cleanPhone,
        token: token.trim(),
        type: 'sms'
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[verify-phone-recovery] Supabase error:', data)
      
      // Handle specific Supabase errors
      if (response.status === 400) {
        return res.status(400).json({ 
          error: 'Código inválido o expirado.',
          details: { reason: 'Invalid or expired token' }
        })
      }
      
      if (response.status === 404) {
        return res.status(404).json({ 
          error: 'No se encontró una solicitud de recuperación para este número.',
          details: { reason: 'Recovery request not found' }
        })
      }

      return res.status(response.status).json({ 
        error: 'Error al verificar el código',
        details: data
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Código verificado exitosamente',
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: data.user
    })

  } catch (error) {
    console.error('[verify-phone-recovery] Unexpected error:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
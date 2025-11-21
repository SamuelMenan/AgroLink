/**
 * Phone password reset endpoint for SMS recovery
 * POST /api/auth/reset-phone-password - Resets password after phone verification
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
    const { phone, token, password } = req.body
    
    if (!phone || !token || !password) {
      return res.status(400).json({ 
        error: 'Teléfono, código y contraseña requeridos',
        details: { reason: 'Missing required fields' }
      })
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'La contraseña debe tener al menos 6 caracteres',
        details: { reason: 'Password too short' }
      })
    }

    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
    
    // First verify the token to get access
    const verifyResponse = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
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

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json()
      console.error('[reset-phone-password] Verification failed:', errorData)
      
      return res.status(verifyResponse.status).json({ 
        error: 'Código inválido o expirado',
        details: errorData
      })
    }

    const verifyData = await verifyResponse.json()
    const accessToken = verifyData.access_token

    // Now update the password using the access token
    const updateResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        password: password
      })
    })

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json()
      console.error('[reset-phone-password] Password update failed:', errorData)
      
      return res.status(updateResponse.status).json({ 
        error: 'Error al actualizar la contraseña',
        details: errorData
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    })

  } catch (error) {
    console.error('[reset-phone-password] Unexpected error:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
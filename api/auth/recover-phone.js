/**
 * Phone recovery endpoint for SMS password recovery
 * POST /api/auth/recover-phone - Sends SMS recovery code
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
    const { phone } = req.body
    
    if (!phone) {
      return res.status(400).json({ 
        error: 'Teléfono requerido',
        details: { reason: 'Missing phone number' }
      })
    }

    // Validate phone format (basic validation)
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
    if (cleanPhone.length < 10) {
      return res.status(400).json({ 
        error: 'Número de teléfono inválido',
        details: { reason: 'Invalid phone format' }
      })
    }

    // Call Supabase to send phone recovery
    const response = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        phone: cleanPhone,
        create_user: false // Don't create user if doesn't exist
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[recover-phone] Supabase error:', data)
      
      // Handle specific Supabase errors
      if (response.status === 400 && data.message?.includes('User not found')) {
        return res.status(404).json({ 
          error: 'No se encontró una cuenta con este número de teléfono.',
          details: { reason: 'User not found' }
        })
      }
      
      if (response.status === 429) {
        return res.status(429).json({ 
          error: 'Demasiados intentos. Intenta nuevamente en unos minutos.',
          details: { reason: 'Rate limited' }
        })
      }

      return res.status(response.status).json({ 
        error: 'Error al enviar el código SMS',
        details: data
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Código de verificación enviado exitosamente',
      phone: cleanPhone
    })

  } catch (error) {
    console.error('[recover-phone] Unexpected error:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
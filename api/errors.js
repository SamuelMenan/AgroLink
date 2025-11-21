/**
 * Error logging API endpoint
 * POST /api/errors - Log client-side errors for debugging
 */

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
  
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Credentials', 'true')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { errors, error, message, stack, componentStack, url, userAgent } = req.body
    
    // Handle both single error and batch error formats
    const errorsToLog = errors || [{
      message: message || error?.message || 'Unknown error',
      stack: stack || error?.stack,
      componentStack,
      url,
      userAgent,
      timestamp: new Date().toISOString(),
      severity: 'error'
    }]

    // Log errors to console for server-side monitoring
    console.group('🚨 Client Error Report')
    errorsToLog.forEach((error, index) => {
      console.error(`Error ${index + 1}:`)
      console.error('Message:', error.message)
      console.error('URL:', error.url)
      console.error('Timestamp:', error.timestamp)
      console.error('Stack:', error.stack)
      console.error('Component Stack:', error.componentStack)
      console.error('User Agent:', error.userAgent)
      console.error('Severity:', error.severity)
      if (error.context) {
        console.error('Context:', error.context)
      }
    })
    console.groupEnd()

    // In production, you might want to send these to an external service
    // like Sentry, LogRocket, etc.
    if (process.env.NODE_ENV === 'production') {
      // Example: send to external logging service
      // await sendToExternalLoggingService(errorsToLog)
    }

    // Store in memory for debugging (in production, use a proper database)
    if (!global.clientErrors) {
      global.clientErrors = []
    }
    global.clientErrors.push(...errorsToLog)
    
    // Keep only recent errors (last 100)
    if (global.clientErrors.length > 100) {
      global.clientErrors = global.clientErrors.slice(-100)
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Error logged successfully',
      loggedCount: errorsToLog.length
    })

  } catch (error) {
    console.error('Failed to log client error:', error)
    return res.status(500).json({ 
      error: 'Failed to log error',
      details: error.message 
    })
  }
}
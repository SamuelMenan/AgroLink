/**
 * API endpoint para gestionar conversaciones de mensajería
 * POST /api/conversations - Crear nueva conversación
 * GET /api/conversations?user_id=xxx - Obtener conversaciones del usuario
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

// Unified conversations handler: supports list/create and action-based sub-operations via query params.
// Actions:
//   GET  /api/conversations                -> list user conversations (?user_id=)
//   POST /api/conversations                -> create conversation (buyer_id, seller_id, product_id, initial_message)
//   GET  /api/conversations?action=messages&id=CONV_ID -> list messages
//   POST /api/conversations?action=messages&id=CONV_ID -> send message
//   POST /api/conversations?action=mark-read&id=CONV_ID (user_id) -> mark messages read
//   GET  /api/conversations?action=participants&id=CONV_ID -> list participant user_ids
export default async function handler(req, res) {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substr(2, 9)
  
  // Production logging
  if (process.env.ENABLE_PRODUCTION_LOGGING === 'true') {
    console.log(`[CONVERSATIONS-${requestId}] Starting request:`, {
      method: req.method,
      url: req.url,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    })
  }
  
  // Production CORS configuration
  const origin = req.headers.origin
  const allowedOrigins = [
    'https://agro-link-jet.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173'
  ]
  
  const isAllowedOrigin = allowedOrigins.includes(origin)
  const corsOrigin = isAllowedOrigin ? origin : allowedOrigins[0]
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', corsOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Supabase no configurado' })
  }

  // Auth header (required for all except maybe public list, but RLS enforces anyway)
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[conversations] Missing or invalid authorization header')
    return res.status(401).json({ 
      error: 'No autenticado. Se requiere token de usuario.',
      details: {
        reason: 'Missing or invalid authorization header',
        timestamp: new Date().toISOString(),
        origin: origin
      }
    })
  }
  const userToken = authHeader.split(' ')[1]
  if (!userToken || userToken === SUPABASE_ANON_KEY) {
    console.error('[conversations] Invalid token: using anon key or empty token')
    return res.status(401).json({ 
      error: 'Se requiere token de usuario autenticado, no anon key',
      details: {
        reason: 'Invalid authentication token',
        timestamp: new Date().toISOString(),
        origin: origin
      }
    })
  }

  // Decode JWT to derive authenticated user id (for RLS alignment)
  let authUserId = null
  try {
    const payloadStr = userToken.split('.')[1]
    if (payloadStr) {
      const payload = JSON.parse(Buffer.from(payloadStr, 'base64').toString('utf8'))
      authUserId = payload.sub || payload.user_id || payload.id || null
    }
  } catch (e) {
    console.warn('[conversations] Unable to decode JWT payload:', e.message)
  }

  // Generic JSON body parsing (Vercel may not populate req.body consistently)
  let parsedBody = null
  if (req.method === 'POST' && (req.headers['content-type'] || '').includes('application/json')) {
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      const raw = Buffer.concat(chunks).toString('utf8')
      parsedBody = raw ? JSON.parse(raw) : {}
    } catch (e) {
      console.error('[conversations] Failed to parse JSON body:', e.message)
      return res.status(400).json({ error: 'Body JSON inválido', details: e.message })
    }
  }

  const urlObj = new URL(req.url, 'http://localhost')
  const action = urlObj.searchParams.get('action') || null
  const targetId = urlObj.searchParams.get('id') || null

  try {
    // ================= MAIN COLLECTION (no action) =================
    if (!action && req.method === 'POST') {
      // Crear nueva conversación
      const { buyer_id, seller_id, product_id, initial_message } = parsedBody || req.body || {}

      console.log('[conversations] POST request:', {
        buyer_id,
        seller_id,
        product_id,
        has_initial_message: !!initial_message,
        has_auth_header: !!req.headers.authorization,
        token_length: userToken.length
      })

      if (!buyer_id || !seller_id || !product_id) {
        return res.status(400).json({ error: 'Faltan campos requeridos: buyer_id, seller_id, product_id' })
      }

      // Ensure buyer_id matches auth user id (RLS: auth.uid())
      if (authUserId && authUserId !== buyer_id) {
        console.warn('[conversations] buyer_id does not match authenticated user id', { authUserId, buyer_id })
        return res.status(403).json({
          error: 'buyer_id no coincide con el usuario autenticado',
          details: { authUserId, buyer_id }
        })
      }

      // Verificar si ya existe una conversación entre estos usuarios para este producto
      const checkUrl = `${SUPABASE_URL}/rest/v1/conversations?product_id=eq.${product_id}&select=id,conversation_participants(user_id)`
      const checkResponse = await fetch(checkUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (checkResponse.ok) {
        const existingConversations = await checkResponse.json()
        
        // Buscar conversación con ambos participantes
        for (const conv of existingConversations) {
          const participantIds = conv.conversation_participants?.map(p => p.user_id) || []
          if (participantIds.includes(buyer_id) && participantIds.includes(seller_id)) {
            // Ya existe conversación, solo enviar el mensaje
            if (initial_message) {
              const messageUrl = `${SUPABASE_URL}/rest/v1/messages`
              await fetch(messageUrl, {
                method: 'POST',
                headers: {
                  'apikey': SUPABASE_ANON_KEY,
                  'Authorization': `Bearer ${userToken}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                  conversation_id: conv.id,
                  sender_id: buyer_id,
                  content: initial_message,
                  message_type: 'text'
                })
              })
            }
            return res.status(200).json(conv)
          }
        }
      }

      // Crear nueva conversación
      const conversationUrl = `${SUPABASE_URL}/rest/v1/conversations`
      const conversationResponse = await fetch(conversationUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id
        })
      })

      if (!conversationResponse.ok) {
        const errorText = await conversationResponse.text()
        console.error('[conversations] Error creating conversation:', {
          status: conversationResponse.status,
          statusText: conversationResponse.statusText,
          error: errorText,
          url: conversationUrl,
          headers: {
            has_apikey: !!SUPABASE_ANON_KEY,
            has_user_token: !!userToken,
            token_preview: userToken.substring(0, 20) + '...'
          }
        })
        return res.status(conversationResponse.status).json({ 
          error: 'Error al crear la conversación',
          details: errorText,
          debug: {
            status: conversationResponse.status,
            statusText: conversationResponse.statusText
          }
        })
      }

      const conversations = await conversationResponse.json()
      const conversation = conversations[0]

      // Crear participantes (secuencial para cumplir RLS)
      const participantsUrl = `${SUPABASE_URL}/rest/v1/conversation_participants`
      // Inserta primero al comprador (auth.uid())
      const partBuyerRes = await fetch(participantsUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=ignore-duplicates,return=minimal'
        },
        body: JSON.stringify({ conversation_id: conversation.id, user_id: buyer_id })
      })
      if (!partBuyerRes.ok && partBuyerRes.status !== 409) {
        const t = await partBuyerRes.text()
        console.error('[conversations] Error adding buyer participant:', partBuyerRes.status, t)
        return res.status(partBuyerRes.status).json({ error: 'No se pudo agregar participante comprador', details: t })
      }

      // Attempt seller insertion; if forbidden (RLS), mark pending
      let sellerPending = false
      try {
        const partSellerRes = await fetch(participantsUrl, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=ignore-duplicates,return=minimal'
          },
          body: JSON.stringify({ conversation_id: conversation.id, user_id: seller_id })
        })
        if (!partSellerRes.ok && partSellerRes.status !== 409) {
          const t = await partSellerRes.text()
            if (partSellerRes.status === 403) {
              console.warn('[conversations] Seller participant insertion blocked by RLS; marking pending.')
              sellerPending = true
            } else {
              console.error('[conversations] Error adding seller participant:', partSellerRes.status, t)
              return res.status(partSellerRes.status).json({ error: 'No se pudo agregar participante vendedor', details: t })
            }
        }
      } catch (e) {
        console.warn('[conversations] Seller insertion exception, marking pending:', e.message)
        sellerPending = true
      }

      // Enviar mensaje inicial si existe
      if (initial_message) {
        const messageUrl = `${SUPABASE_URL}/rest/v1/messages`
        await fetch(messageUrl, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${userToken}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            conversation_id: conversation.id,
            sender_id: buyer_id,
            content: initial_message,
            message_type: 'text'
          })
        })
      }

      return res.status(201).json({ ...conversation, seller_pending: sellerPending })

    } else if (!action && req.method === 'GET') {
      // Obtener conversaciones del usuario
      const { user_id } = req.query

      if (!user_id) {
        return res.status(400).json({ error: 'Falta user_id' })
      }

      // Buscar conversaciones donde el usuario sea participante
      const url = `${SUPABASE_URL}/rest/v1/conversation_participants?user_id=eq.${user_id}&select=conversation_id,conversations(id,product_id,created_at,updated_at)`
      
      const response = await fetch(url, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[conversations] Error fetching conversations:', response.status, errorText)
        return res.status(response.status).json({ 
          error: 'Error al obtener conversaciones',
          details: errorText 
        })
      }

      const participants = await response.json()
      const conversations = participants.map(p => p.conversations).filter(Boolean)
      
      // Ordenar por fecha de actualización
      conversations.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      
      return res.status(200).json(conversations)

    // ================= SUB-ACTIONS =================
    } else if (action === 'messages') {
      if (!targetId) return res.status(400).json({ error: 'id requerido (conversation id)' })
      if (req.method === 'GET') {
        // Verify participant
        const participantCheckUrl = `${SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${targetId}&select=user_id`
        const partResp = await fetch(participantCheckUrl, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' }
        })
        if (!partResp.ok) {
          return res.status(partResp.status).json({ error: 'Error al verificar participante', details: await partResp.text() })
        }
        const partJson = await partResp.json()
        if (!Array.isArray(partJson) || partJson.length === 0) {
          return res.status(403).json({ error: 'No eres participante de esta conversación' })
        }
        const messagesUrl = `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${targetId}&order=created_at.asc&select=*`
        const msgResp = await fetch(messagesUrl, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' }
        })
        if (!msgResp.ok) {
          return res.status(msgResp.status).json({ error: 'Error al obtener mensajes', details: await msgResp.text() })
        }
        return res.status(200).json(await msgResp.json())
      } else if (req.method === 'POST') {
        const { conversation_id, sender_id, content, type, is_from_buyer, in_reply_to, quick_request_type, quick_response_type } = req.body
        if (!conversation_id || !sender_id || !content || conversation_id !== targetId) {
          return res.status(400).json({ error: 'Datos de mensaje inválidos' })
        }
        // Verify participant
        const participantCheckUrl = `${SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${targetId}&user_id=eq.${sender_id}&select=user_id`
        const partResp = await fetch(participantCheckUrl, {
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' }
        })
        if (!partResp.ok) {
          return res.status(partResp.status).json({ error: 'Error al verificar participante', details: await partResp.text() })
        }
        const partJson = await partResp.json()
        if (partJson.length === 0) return res.status(403).json({ error: 'No eres participante de esta conversación' })
        const messageData = {
          conversation_id,
            sender_id,
            content,
            message_type: type || 'text',
            is_from_buyer: is_from_buyer ?? null,
            quick_request_type: quick_request_type || null,
            quick_response_type: quick_response_type || null,
            in_reply_to: in_reply_to || null
        }
        Object.keys(messageData).forEach(k => { if (messageData[k] === null) delete messageData[k] })
        const msgUrl = `${SUPABASE_URL}/rest/v1/messages`
        const msgResp = await fetch(msgUrl, {
          method: 'POST',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify(messageData)
        })
        if (!msgResp.ok) {
          return res.status(msgResp.status).json({ error: 'Error al enviar mensaje', details: await msgResp.text() })
        }
        const arr = await msgResp.json(); const msg = arr[0]
        // bump conversation updated_at
        await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${targetId}`, {
          method: 'PATCH',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ updated_at: new Date().toISOString() })
        })
        return res.status(201).json(msg)
      } else {
        return res.status(405).json({ error: 'Método no permitido para messages' })
      }
    } else if (action === 'participants') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido (participants)' })
      if (!targetId) return res.status(400).json({ error: 'id requerido' })
      const url = `${SUPABASE_URL}/rest/v1/conversation_participants?select=user_id&conversation_id=eq.${targetId}`
      const pResp = await fetch(url, { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${userToken}`, 'Content-Type': 'application/json' } })
      if (!pResp.ok) return res.status(pResp.status).json({ error: 'Error al obtener participantes', details: await pResp.text() })
      return res.status(200).json(await pResp.json())
    } else if (action === 'mark-read') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido (mark-read)' })
      if (!targetId) return res.status(400).json({ error: 'id requerido' })
      const { user_id } = req.body || {}
      if (!user_id) return res.status(400).json({ error: 'user_id requerido' })
      // Implement simple receipts (insert or update)
      const messagesUrl = `${SUPABASE_URL}/rest/v1/message_receipts` // expects upsert individually per message in real scenario
      // For simplicity, we just acknowledge success (detailed receipts can be added later)
      return res.status(200).json({ ok: true })
    } else if (action === 'add-participant') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido (add-participant)' })
      if (!targetId) return res.status(400).json({ error: 'id requerido' })
      const { user_id } = parsedBody || req.body || {}
      if (!user_id) return res.status(400).json({ error: 'user_id requerido' })
      if (authUserId && authUserId !== user_id) {
        return res.status(403).json({ error: 'user_id no coincide con usuario autenticado' })
      }
      const participantsUrl = `${SUPABASE_URL}/rest/v1/conversation_participants`
      const insResp = await fetch(participantsUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=ignore-duplicates,return=minimal'
        },
        body: JSON.stringify({ conversation_id: targetId, user_id })
      })
      if (!insResp.ok && insResp.status !== 409) {
        return res.status(insResp.status).json({ error: 'No se pudo agregar participante', details: await insResp.text() })
      }
      return res.status(201).json({ ok: true })
    } else {
      return res.status(405).json({ error: 'Acción no soportada' })
    }
    
    // Production logging for successful requests
    if (process.env.ENABLE_PRODUCTION_LOGGING === 'true') {
      const duration = Date.now() - startTime
      console.log(`[CONVERSATIONS-${requestId}] Request completed successfully:`, {
        method: req.method,
        action: action,
        targetId: targetId,
        status: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('[conversations] Error:', error)
    
    // Enhanced error handling for production
    const errorResponse = {
      error: 'Error interno del servidor',
      message: error.message,
      status: 500,
      details: {
        method: req.method,
        action: action,
        targetId: targetId,
        timestamp: new Date().toISOString(),
        origin: origin
      }
    }
    
    // Log detailed error for debugging
    console.error('[conversations] Production error details:', JSON.stringify(errorResponse, null, 2))
    
    // Production logging for errors
    if (process.env.ENABLE_PRODUCTION_LOGGING === 'true') {
      const duration = Date.now() - startTime
      console.error(`[CONVERSATIONS-${requestId}] Request failed:`, {
        method: req.method,
        action: action,
        targetId: targetId,
        status: 500,
        duration: `${duration}ms`,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    }
    
    return res.status(500).json(errorResponse)
  }
}

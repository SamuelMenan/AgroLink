/**
 * API endpoint para gestionar mensajes de conversaciones
 * GET /api/conversations/[id]/messages - Obtener mensajes de una conversación
 * POST /api/conversations/[id]/messages - Enviar mensaje a una conversación
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: 'Supabase no configurado' })
  }

  // Verificar que el usuario esté autenticado con un token JWT válido
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autenticado. Se requiere token de usuario.' })
  }

  const userToken = authHeader.split(' ')[1]
  if (userToken === SUPABASE_ANON_KEY) {
    return res.status(401).json({ error: 'Se requiere token de usuario autenticado, no anon key' })
  }

  const conversationId = req.query.id
  if (!conversationId) {
    return res.status(400).json({ error: 'ID de conversación requerido' })
  }

  try {
    if (req.method === 'GET') {
      // Obtener mensajes de la conversación
      console.log('[messages] GET request for conversation:', conversationId)

      // Verificar que el usuario es participante de la conversación
      const participantCheckUrl = `${SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${conversationId}&user_id=eq.${req.query.user_id || ''}&select=user_id`
      const participantResponse = await fetch(participantCheckUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!participantResponse.ok) {
        const errorText = await participantResponse.text()
        console.error('[messages] Error checking participant:', participantResponse.status, errorText)
        return res.status(participantResponse.status).json({ 
          error: 'Error al verificar participante',
          details: errorText 
        })
      }

      const participants = await participantResponse.json()
      if (participants.length === 0) {
        return res.status(403).json({ error: 'No eres participante de esta conversación' })
      }

      // Obtener mensajes
      const messagesUrl = `${SUPABASE_URL}/rest/v1/messages?conversation_id=eq.${conversationId}&order=created_at.asc&select=*`
      const messagesResponse = await fetch(messagesUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!messagesResponse.ok) {
        const errorText = await messagesResponse.text()
        console.error('[messages] Error fetching messages:', messagesResponse.status, errorText)
        return res.status(messagesResponse.status).json({ 
          error: 'Error al obtener mensajes',
          details: errorText 
        })
      }

      const messages = await messagesResponse.json()
      return res.status(200).json(messages)

    } else if (req.method === 'POST') {
      // Enviar mensaje a la conversación
      const { conversation_id, sender_id, sender_name, content, type, is_from_buyer, ...additionalData } = req.body

      console.log('[messages] POST request:', {
        conversation_id,
        sender_id,
        sender_name,
        content_length: content?.length,
        type,
        is_from_buyer,
        conversationId
      })

      if (!conversation_id || !sender_id || !content) {
        return res.status(400).json({ 
          error: 'Faltan campos requeridos: conversation_id, sender_id, content' 
        })
      }

      if (conversation_id !== conversationId) {
        return res.status(400).json({ error: 'ID de conversación no coincide' })
      }

      // Verificar que el usuario es participante de la conversación
      const participantCheckUrl = `${SUPABASE_URL}/rest/v1/conversation_participants?conversation_id=eq.${conversationId}&user_id=eq.${sender_id}&select=user_id`
      const participantResponse = await fetch(participantCheckUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (!participantResponse.ok) {
        const errorText = await participantResponse.text()
        console.error('[messages] Error checking participant:', participantResponse.status, errorText)
        return res.status(participantResponse.status).json({ 
          error: 'Error al verificar participante',
          details: errorText 
        })
      }

      const participants = await participantResponse.json()
      if (participants.length === 0) {
        return res.status(403).json({ error: 'No eres participante de esta conversación' })
      }

      // Crear mensaje
      const messageData = {
        conversation_id,
        sender_id,
        content,
        message_type: type || 'text',
        is_from_buyer: is_from_buyer !== undefined ? is_from_buyer : null,
        ...additionalData
      }

      // Limpiar campos undefined
      Object.keys(messageData).forEach(key => {
        if (messageData[key] === undefined) {
          delete messageData[key]
        }
      })

      const messageUrl = `${SUPABASE_URL}/rest/v1/messages`
      const messageResponse = await fetch(messageUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(messageData)
      })

      if (!messageResponse.ok) {
        const errorText = await messageResponse.text()
        console.error('[messages] Error creating message:', {
          status: messageResponse.status,
          statusText: messageResponse.statusText,
          error: errorText,
          url: messageUrl,
          messageData
        })
        return res.status(messageResponse.status).json({ 
          error: 'Error al enviar mensaje',
          details: errorText 
        })
      }

      const messages = await messageResponse.json()
      const message = messages[0]

      // Actualizar timestamp de la conversación
      const updateConversationUrl = `${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`
      await fetch(updateConversationUrl, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          updated_at: new Date().toISOString()
        })
      })

      return res.status(201).json(message)

    } else {
      return res.status(405).json({ error: 'Método no permitido' })
    }
  } catch (error) {
    console.error('[messages] Error:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    })
  }
}
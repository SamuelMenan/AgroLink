/**
 * API endpoint para gestionar conversaciones de mensajería
 * POST /api/conversations - Crear nueva conversación
 * GET /api/conversations?user_id=xxx - Obtener conversaciones del usuario
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

  const authHeader = req.headers.authorization || `Bearer ${SUPABASE_ANON_KEY}`

  try {
    if (req.method === 'POST') {
      // Crear nueva conversación
      const { buyer_id, seller_id, product_id, initial_message } = req.body

      if (!buyer_id || !seller_id || !product_id) {
        return res.status(400).json({ error: 'Faltan campos requeridos: buyer_id, seller_id, product_id' })
      }

      // Verificar si ya existe una conversación entre estos usuarios para este producto
      const checkUrl = `${SUPABASE_URL}/rest/v1/conversations?product_id=eq.${product_id}&select=id,conversation_participants(user_id)`
      const checkResponse = await fetch(checkUrl, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': authHeader,
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
                  'Authorization': authHeader,
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
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          product_id
        })
      })

      if (!conversationResponse.ok) {
        const errorText = await conversationResponse.text()
        console.error('[conversations] Error creating conversation:', conversationResponse.status, errorText)
        return res.status(conversationResponse.status).json({ 
          error: 'Error al crear la conversación',
          details: errorText 
        })
      }

      const conversations = await conversationResponse.json()
      const conversation = conversations[0]

      // Crear participantes
      const participantsUrl = `${SUPABASE_URL}/rest/v1/conversation_participants`
      await fetch(participantsUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify([
          { conversation_id: conversation.id, user_id: buyer_id },
          { conversation_id: conversation.id, user_id: seller_id }
        ])
      })

      // Enviar mensaje inicial si existe
      if (initial_message) {
        const messageUrl = `${SUPABASE_URL}/rest/v1/messages`
        await fetch(messageUrl, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': authHeader,
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

      return res.status(201).json(conversation)

    } else if (req.method === 'GET') {
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
          'Authorization': authHeader,
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

    } else {
      return res.status(405).json({ error: 'Método no permitido' })
    }
  } catch (error) {
    console.error('[conversations] Error:', error)
    return res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message 
    })
  }
}

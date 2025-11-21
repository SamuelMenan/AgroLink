import { 
  type Conversation, 
  type Message, 
  type CompraAcuerdo,
  type QuickRequestType,
  type QuickResponseType,
  type PurchaseStepType,
  type PaymentMethod,
  type DeliveryMethod,
  QUICK_REQUESTS,
  QUICK_RESPONSES
} from '../types/messaging'
import { getAccessToken } from './apiAuth'
import { apiClient } from './apiClient'
import { checkAuthStatus } from '../utils/authFixHelper'

// API Base URL - Use backend proxy to avoid RLS issues
const API_BASE = '/api/proxy/api/v1'

// Create a new conversation
export async function createConversation(
  buyerId: string, 
  sellerId: string, 
  productId: string,
  productName: string,
  productImage?: string
): Promise<Conversation>

export async function createConversation(
  params: {
    participantId: string;
    productId: string;
    initialMessage?: string;
  }
): Promise<Conversation>

export async function createConversation(
  buyerIdOrParams: string | {
    participantId: string;
    productId: string;
    initialMessage?: string;
  },
  sellerId?: string, 
  productId?: string,
  productName?: string,
  productImage?: string
): Promise<Conversation> {
  
  // Handle new interface
  if (typeof buyerIdOrParams === 'object') {
    const { participantId, productId, initialMessage } = buyerIdOrParams
    
    // Get current user ID from token (stored as 'agrolink_access_token')
    const token = getAccessToken()
    if (!token) {
      throw new Error('No autenticado')
    }
    
    // Check if user has anonymous token and redirect to login
    const authStatus = checkAuthStatus()
    if (!authStatus.isValid || authStatus.role === 'anon') {
      console.warn('[Messaging] Usuario anónimo detectado, redirigiendo a login')
      // Store current location to redirect back after login
      localStorage.setItem('redirect_after_login', window.location.href)
      // Redirect to login
      window.location.href = '/login?intent=messaging'
      throw new Error('Por favor, inicia sesión para enviar mensajes')
    }
    
    // Decode JWT to get user ID
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentUserId = payload.sub || payload.user_id || payload.id
    
    if (!currentUserId) {
      throw new Error('No se pudo obtener el ID del usuario')
    }
    
    console.log('[createConversation] Datos a enviar (RPC create_conversation):', {
      product_id: productId,
      participant_ids: [currentUserId, participantId],
      initial_message: initialMessage || null
    })

    // Paso 1: crear conversación y añadir participantes en una sola llamada RPC
    const rpcResponse = await fetch(`/api/rpc?fn=create_conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-client-request-id': Math.random().toString(36).slice(2)
      },
      body: JSON.stringify({
        product_id: productId || null,
        participant_ids: [currentUserId, participantId]
      })
    })

    if (!rpcResponse.ok) {
      // Fallback si la función RPC no existe (404) o no permite método (405)
      if (rpcResponse.status === 404 || rpcResponse.status === 405) {
        console.warn('[createConversation] RPC no disponible (404 o 405). Usando fallback adaptativo.')

        // Intento 1: insertar según esquema remoto (buyer_id, seller_id, product_id)
        const convAttemptBody1 = {
          buyer_id: currentUserId,
            seller_id: participantId,
            product_id: productId || null,
            ...(initialMessage ? { initial_message: initialMessage } : {})
        }
        let convResp = await fetch(`${API_BASE}/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(convAttemptBody1)
        })

        // Si falla porque faltan campos requeridos distintos, reintentar con solo product_id
        let firstTxt: string | null = null
        if (!convResp.ok) {
          firstTxt = await convResp.text()
          if (convResp.status === 400 && /Faltan campos requeridos/i.test(firstTxt) && /buyer_id/.test(firstTxt)) {
            console.warn('[createConversation] Fallback remoto exige buyer_id/seller_id; ya enviados; respuesta:', firstTxt)
          } else if (convResp.status === 400) {
            console.warn('[createConversation] Reintentando creación con cuerpo mínimo product_id. Motivo:', firstTxt)
            const convAttemptBody2 = { product_id: productId || null }
            // Use apiClient to benefit from timeouts and retries
            try {
              const convData = await apiClient.post<any>(`/api/v1/conversations`, convAttemptBody2)
              // Simulate a Response-ok path using data
              return {
                id: convData.id || convData?.[0]?.id,
                product_id: productId || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                participants: [currentUserId, participantId]
              } as unknown as Conversation
            } catch (e) {
              // If apiClient post failed, keep previous flow and let error handling continue
            }
            firstTxt = null
          }
        }

        if (!convResp.ok) {
          const txt = firstTxt ?? await convResp.text()
          throw new Error(`Error creando conversación (fallback): ${convResp.status} ${txt}`)
        }

        const convData = await convResp.json()
        const conversationId = convData.id || convData?.[0]?.id || convData // algunos backends devuelven objeto o array o UUID directo

        // Insertar participantes si no están ya presentes (según esquema local)
        const participantsInsert = async (uid: string) => {
          const resp = await fetch(`${API_BASE}/conversation_participants`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ conversation_id: conversationId, user_id: uid })
          })
          if (!resp.ok) {
            const t = await resp.text()
            console.warn('[createConversation] Fallo insert participant', { uid, status: resp.status, t })
          }
        }

        // Intentar inserts (pueden fallar si backend remoto ya maneja participantes)
        await participantsInsert(currentUserId)
        if (participantId !== currentUserId) {
          await participantsInsert(participantId)
        }

        // Mensaje inicial
        if (initialMessage) {
          const msgResp = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'x-client-request-id': Math.random().toString(36).slice(2)
            },
            body: JSON.stringify({ conversation_id: conversationId, sender_id: currentUserId, content: initialMessage, type: 'message' })
          })
          if (!msgResp.ok) {
            const txt = await msgResp.text()
            console.warn('[createConversation] Mensaje inicial falló en fallback', { status: msgResp.status, txt })
          }
        }

        return {
          id: conversationId,
          product_id: productId || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          participants: [currentUserId, participantId]
        } as unknown as Conversation
      }

      // Otros errores distintos de 404
      const errorText = await rpcResponse.text()
      let errorData: { error?: string; details?: any; debug?: any } = {}
      try { errorData = JSON.parse(errorText) } catch { errorData = { error: errorText } }
      console.error('[createConversation] Error RPC create_conversation:', {
        status: rpcResponse.status,
        statusText: rpcResponse.statusText,
        errorData,
        url: `${API_BASE}/rpc/create_conversation`,
        requestData: { product_id: productId, participant_ids: [currentUserId, participantId] },
        timestamp: new Date().toISOString()
      })
      let errorMessage = 'Error al crear la conversación'
      if (rpcResponse.status === 403) {
        errorMessage = errorData.debug?.message || 'No tienes permisos para crear esta conversación. Por favor, verifica que estás autenticado.'
      } else if (rpcResponse.status === 401) {
        errorMessage = errorData.debug?.message || 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
      } else if (rpcResponse.status === 500) {
        errorMessage = 'Error interno del servidor. Por favor, intenta nuevamente más tarde.'
      } else if (errorData.error) {
        errorMessage = errorData.error
      }
      throw new Error(errorMessage)
    }

    const conversationId = await rpcResponse.json() // función devuelve UUID

    // Paso 2: si hay mensaje inicial, enviarlo
    if (initialMessage) {
      const msgResp = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          sender_id: currentUserId,
          content: initialMessage,
          type: 'message'
        })
      })
      if (!msgResp.ok) {
        const errTxt = await msgResp.text()
        console.warn('[createConversation] Conversación creada pero fallo al enviar mensaje inicial', {
          conversation_id: conversationId,
          status: msgResp.status,
          error: errTxt
        })
      }
    }

    // Devolver objeto conversación mínimamente estructurado
    return {
      id: conversationId,
      product_id: productId || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      participants: [currentUserId, participantId]
    } as unknown as Conversation
  }
  // Handle legacy interface (sin RPC, conservar por compatibilidad original)
  const legacyToken = getAccessToken()
  if (!legacyToken) {
    throw new Error('No autenticado')
  }
  const legacyResponse = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${legacyToken}`
    },
    body: JSON.stringify({
      buyer_id: buyerIdOrParams,
      seller_id: sellerId,
      product_id: productId,
      product_name: productName,
      product_image: productImage
    })
  })
  if (!legacyResponse.ok) {
    throw new Error('Error al crear la conversación')
  }
  return legacyResponse.json()
}

// Add a participant (seller) when seller_pending is true
export async function addParticipant(conversationId: string, userId: string): Promise<{ ok: boolean }> {
  const token = getAccessToken()
  if (!token) throw new Error('No autenticado')
  const resp = await fetch(`/api/conversations?action=add-participant&id=${conversationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ user_id: userId })
  })
  if (!resp.ok) {
    const txt = await resp.text()
    throw new Error(`Error agregando participante: ${resp.status} ${txt}`)
  }
  return resp.json()
}

// Get user's conversations
export async function getConversations(userId: string): Promise<Conversation[]> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('No autenticado')
  }

  console.log('[getConversations] Obteniendo conversaciones para usuario:', userId)

  try {
    return await apiClient.get<Conversation[]>(`/api/v1/conversations?user_id=${userId}`)
  } catch (e) {
    // Fallback a fetch directo para mantener el manejo de errores detallado actual
  }
  const response = await fetch(`${API_BASE}/conversations?user_id=${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorData: { error?: string; details?: any; debug?: any } = {}
    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { error: errorText }
    }
    
    console.error('[getConversations] Error response:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      url: `${API_BASE}/conversations?user_id=${userId}`,
      timestamp: new Date().toISOString()
    })
    
    let errorMessage = 'Error al obtener conversaciones'
    if (response.status === 403) {
      errorMessage = errorData.debug?.message || 'No tienes permisos para ver estas conversaciones.'
    } else if (response.status === 401) {
      errorMessage = errorData.debug?.message || 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
    } else if (response.status === 500) {
      errorMessage = 'Error interno del servidor. Por favor, intenta nuevamente más tarde.'
    } else if (errorData.error) {
      errorMessage = errorData.error
    }
    
    throw new Error(errorMessage)
  }

  return response.json()
}

// Get messages from a conversation
export async function getMessages(conversationId: string): Promise<Message[]> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('No autenticado')
  }

  console.log('[getMessages] Obteniendo mensajes para conversación:', conversationId)

  // Use apiClient for GET with retries/timeouts
  try {
    return await apiClient.get<Message[]>(`/api/v1/conversations?action=messages&id=${conversationId}`)
  } catch (e) {
    // Fallback to direct fetch to preserve existing error mapping
  }
  const response = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorData: { error?: string } = {}
    try {
      errorData = JSON.parse(errorText)
    } catch {
      errorData = { error: errorText }
    }
    
    console.error('[getMessages] Error response:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      url: `${API_BASE}/conversations?action=messages&id=${conversationId}`
    })
    
    if (response.status === 403 && /No eres participante/i.test(errorText)) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        const currentUserId = payload.sub || payload.user_id || payload.id
        if (currentUserId) {
          await addParticipant(conversationId, currentUserId)
          const retry = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          if (retry.ok) {
            return retry.json()
          }
        }
      } catch {}
    }

    let errorMessage = 'Error al obtener mensajes'
    if (response.status === 401) {
      errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
    } else if (response.status === 404) {
      errorMessage = 'La conversación no existe o fue eliminada.'
    } else if (errorData.error) {
      errorMessage = errorData.error
    }
    
    throw new Error(errorMessage)
  }

  return response.json()
}

// Send a text message
export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  content: string,
  isFromBuyer: boolean
): Promise<Message> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('No autenticado')
  }

  console.log('[sendMessage] Enviando mensaje:', {
    conversationId,
    senderId,
    senderName,
    contentLength: content.length,
    isFromBuyer
  })

  const response = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-client-request-id': Math.random().toString(36).slice(2)
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: senderName,
      content,
      type: 'message',
      is_from_buyer: isFromBuyer
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorData: { error?: string; details?: any; debug?: any } = {}
    try { errorData = JSON.parse(errorText) } catch { errorData = { error: errorText } }

    // If forbidden due to not being a participant, try to add and retry once
    if (response.status === 403 && /No eres participante/i.test(errorText)) {
      try {
        await addParticipant(conversationId, senderId)
        const retry = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            sender_id: senderId,
            sender_name: senderName,
            content,
            type: 'message',
            is_from_buyer: isFromBuyer
          })
        })
        if (retry.ok) {
          return retry.json() as Promise<Message>
        }
      } catch (e) {
        // fall through to error handling
      }
    }

    console.error('[sendMessage] Error response:', {
      status: response.status,
      statusText: response.statusText,
      errorData,
      url: `${API_BASE}/conversations?action=messages&id=${conversationId}`,
      requestData: {
        conversation_id: conversationId,
        sender_id: senderId,
        sender_name: senderName,
        content,
        type: 'message',
        is_from_buyer: isFromBuyer
      },
      timestamp: new Date().toISOString()
    })

    let errorMessage = 'Error al enviar mensaje'
    if (response.status === 403) {
      errorMessage = errorData.debug?.message || 'No tienes permisos para enviar mensajes en esta conversación.'
    } else if (response.status === 401) {
      errorMessage = errorData.debug?.message || 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
    } else if (response.status === 404) {
      errorMessage = errorData.debug?.message || 'La conversación no existe o fue eliminada.'
    } else if (response.status === 500) {
      errorMessage = 'Error interno del servidor. Por favor, intenta nuevamente más tarde.'
    } else if (errorData.error) {
      errorMessage = errorData.error
    }

    throw new Error(errorMessage)
  }

  return response.json()
}

// Send a quick request
export async function sendQuickRequest(
  conversationId: string,
  buyerId: string,
  buyerName: string,
  requestType: QuickRequestType,
  customMessage?: string
): Promise<Message> {
  const request = QUICK_REQUESTS.find(r => r.type === requestType)
  if (!request) {
    throw new Error('Tipo de petición no válido')
  }

  const content = customMessage || request.message
  
  const response = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: buyerId,
      sender_name: buyerName,
      content,
      type: 'quick_request',
      quick_request_type: requestType,
      is_from_buyer: true
    })
  })

  if (!response.ok) {
    throw new Error('Error al enviar petición rápida')
  }

  return response.json()
}

// Send a quick response
export async function sendQuickResponse(
  conversationId: string,
  sellerId: string,
  sellerName: string,
  responseType: QuickResponseType,
  originalMessageId?: string
): Promise<Message> {
  const response = QUICK_RESPONSES.find(r => r.type === responseType)
  if (!response) {
    throw new Error('Tipo de respuesta no válido')
  }

  const responseData = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: sellerId,
      sender_name: sellerName,
      content: response.message,
      type: 'quick_response',
      quick_response_type: responseType,
      in_reply_to: originalMessageId,
      is_from_buyer: false
    })
  })

  if (!responseData.ok) {
    throw new Error('Error al enviar respuesta rápida')
  }

  return responseData.json()
}

// Update conversation status
export async function updateConversationStatus(
  conversationId: string,
  status: 'pending' | 'agreed' | 'in_payment' | 'paid' | 'finished' | 'cancelled'
): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify({ status })
  })

  if (!response.ok) {
    throw new Error('Error al actualizar estado de conversación')
  }
}

// Create purchase agreement
export async function createPurchaseAgreement(
  conversationId: string,
  buyerId: string,
  sellerId: string,
  productId: string,
  quantity: number,
  agreedPrice: number,
  deliveryMethod: DeliveryMethod,
  paymentMethod: PaymentMethod
): Promise<CompraAcuerdo> {
  const response = await fetch(`${API_BASE}/purchase-agreements`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      buyer_id: buyerId,
      seller_id: sellerId,
      product_id: productId,
      quantity,
      agreed_price: agreedPrice,
      delivery_method: deliveryMethod,
      payment_method: paymentMethod
    })
  })

  if (!response.ok) {
    throw new Error('Error al crear acuerdo de compra')
  }

  return response.json()
}

// Confirm purchase agreement
export async function confirmPurchaseAgreement(agreementId: string): Promise<CompraAcuerdo> {
  const response = await fetch(`${API_BASE}/purchase-agreements/${agreementId}/confirm`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`
    }
  })

  if (!response.ok) {
    throw new Error('Error al confirmar acuerdo de compra')
  }

  return response.json()
}

// Upload payment proof
export async function uploadPaymentProof(
  agreementId: string,
  file: File
): Promise<{ payment_proof_url: string }> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/purchase-agreements/${agreementId}/payment-proof`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: formData
  })

  if (!response.ok) {
    throw new Error('Error al subir comprobante de pago')
  }

  return response.json()
}

// Mark payment as completed
export async function completePayment(agreementId: string): Promise<CompraAcuerdo> {
  const response = await fetch(`${API_BASE}/purchase-agreements/${agreementId}/complete-payment`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getAccessToken()}`
    }
  })

  if (!response.ok) {
    throw new Error('Error al completar pago')
  }

  return response.json()
}

// Send purchase step message
export async function sendPurchaseStep(
  conversationId: string,
  senderId: string,
  senderName: string,
  stepType: PurchaseStepType,
  content: string,
  additionalData?: {
    quantity?: number
    final_price?: number
    delivery_method?: DeliveryMethod
    payment_method?: PaymentMethod
  }
): Promise<Message> {
  const response = await fetch(`${API_BASE}/conversations?action=messages&id=${conversationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: senderName,
      content,
      type: 'purchase_step',
      purchase_step: stepType,
      quantity: additionalData?.quantity,
      final_price: additionalData?.final_price,
      delivery_method: additionalData?.delivery_method,
      payment_method: additionalData?.payment_method,
      is_from_buyer: true
    })
  })

  if (!response.ok) {
    throw new Error('Error al enviar paso de compra')
  }

  return response.json()
}

// Mark messages as read
export async function markMessagesAsRead(conversationId: string, userId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/conversations?action=mark-read&id=${conversationId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAccessToken()}`
    },
    body: JSON.stringify({ user_id: userId })
  })

  if (!response.ok) {
    throw new Error('Error al marcar mensajes como leídos')
  }
}

// List pending conversations (those where current user is not yet a participant)
export async function getPendingConversations(): Promise<Conversation[]> {
  const token = getAccessToken()
  if (!token) throw new Error('No autenticado')

  try {
    return await apiClient.get<Conversation[]>(`/api/v1/conversations?action=pending`)
  } catch {
    // Fallback a fetch directo
    const resp = await fetch(`${API_BASE}/conversations?action=pending`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!resp.ok) {
      const txt = await resp.text()
      throw new Error(`Error obteniendo pendientes: ${resp.status} ${txt}`)
    }
    return resp.json()
  }
}

// Join a pending conversation by id
export async function joinConversation(conversationId: string): Promise<{ ok: boolean }> {
  const token = getAccessToken()
  if (!token) throw new Error('No autenticado')

  try {
    return await apiClient.post<{ ok: boolean }>(`/api/v1/conversations?action=join&id=${conversationId}`, {})
  } catch {
    const resp = await fetch(`${API_BASE}/conversations?action=join&id=${conversationId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({})
    })
    if (!resp.ok) {
      const txt = await resp.text()
      throw new Error(`Error al unirse: ${resp.status} ${txt}`)
    }
    return resp.json()
  }
}
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

// API Base URL
const API_BASE = '/api'

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
    const token = localStorage.getItem('agrolink_access_token')
    if (!token) {
      throw new Error('No autenticado')
    }
    
    // Decode JWT to get user ID
    const payload = JSON.parse(atob(token.split('.')[1]))
    const currentUserId = payload.sub || payload.user_id || payload.id
    
    if (!currentUserId) {
      throw new Error('No se pudo obtener el ID del usuario')
    }
    
    console.log('[createConversation] Datos a enviar:', {
      buyer_id: currentUserId,
      seller_id: participantId,
      product_id: productId,
      initial_message: initialMessage
    })
    
    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        buyer_id: currentUserId,
        seller_id: participantId,
        product_id: productId,
        initial_message: initialMessage || 'Hola. ¿Sigue estando disponible?'
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('[createConversation] Error response:', errorData)
      throw new Error(errorData.error || 'Error al crear la conversación')
    }

    return response.json()
  }
  
  // Handle legacy interface
  const response = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      buyer_id: buyerIdOrParams,
      seller_id: sellerId,
      product_id: productId,
      product_name: productName,
      product_image: productImage
    })
  })

  if (!response.ok) {
    throw new Error('Error al crear la conversación')
  }

  return response.json()
}

// Get user's conversations
export async function getConversations(userId: string): Promise<Conversation[]> {
  const response = await fetch(`${API_BASE}/conversations?user_id=${userId}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })

  if (!response.ok) {
    throw new Error('Error al obtener conversaciones')
  }

  return response.json()
}

// Get messages from a conversation
export async function getMessages(conversationId: string): Promise<Message[]> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })

  if (!response.ok) {
    throw new Error('Error al obtener mensajes')
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
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_name: senderName,
      content,
      type: 'text',
      is_from_buyer: isFromBuyer
    })
  })

  if (!response.ok) {
    throw new Error('Error al enviar mensaje')
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
  
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
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
  _originalMessageId: string
): Promise<Message> {
  const response = QUICK_RESPONSES.find(r => r.type === responseType)
  if (!response) {
    throw new Error('Tipo de respuesta no válido')
  }

  const responseData = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      sender_id: sellerId,
      sender_name: sellerName,
      content: response.message,
      type: 'quick_response',
      quick_response_type: responseType,
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
      'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      'Authorization': `Bearer ${localStorage.getItem('token')}`
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
      'Authorization': `Bearer ${localStorage.getItem('token')}`
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
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
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
  const response = await fetch(`${API_BASE}/conversations/${conversationId}/mark-read`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ user_id: userId })
  })

  if (!response.ok) {
    throw new Error('Error al marcar mensajes como leídos')
  }
}
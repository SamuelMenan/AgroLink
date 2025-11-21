import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { 
  type Conversation, 
  type Message, 
  type QuickRequestType,
  type QuickResponseType,
  QUICK_REQUESTS,
  QUICK_RESPONSES,
  DELIVERY_METHODS,
  PAYMENT_METHODS
} from '../types/messaging'
import { 
  getConversations, 
  getMessages, 
  sendMessage,
  sendQuickRequest,
  sendQuickResponse,
  sendPurchaseStep,
  markMessagesAsRead,
  getPendingConversations,
  joinConversation
} from '../services/messagingService'
import { Send, MessageCircle, ShoppingCart } from 'lucide-react'
import { logError, logWarning, logInfo } from '../services/errorLogging'

interface MessageCenterProps {
  initialConversation?: Conversation
  productData?: {
    id: string
    name: string
    seller_id: string
    seller_name: string
    image_url?: string
  }
}

export function MessageCenter({ initialConversation, productData }: MessageCenterProps) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(initialConversation || null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pendingConvs, setPendingConvs] = useState<Conversation[]>([])
  const [showQuickRequests, setShowQuickRequests] = useState(false)
  const [showPurchaseFlow, setShowPurchaseFlow] = useState(false)
  const [currentPurchaseStep, setCurrentPurchaseStep] = useState(0)
  const [purchaseData, setPurchaseData] = useState({
    quantity: 1,
    finalPrice: 0,
    deliveryMethod: 'encuentro' as const,
    paymentMethod: 'contra_entrega' as const
  })
  const [error, setError] = useState<string | null>(null)
  // const [isRetrying, setIsRetrying] = useState(false)
  
  // Enhanced logging for debugging
  const componentId = useRef(`MessageCenter-${Date.now()}`).current
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Log component lifecycle
  useEffect(() => {
    logInfo(`MessageCenter component mounted`, {
      componentId,
      hasInitialConversation: !!initialConversation,
      hasProductData: !!productData,
      userId: user?.id
    })
    
    return () => {
      logInfo(`MessageCenter component unmounted`, { componentId })
    }
  }, [])
  
  // Log state changes for debugging
  useEffect(() => {
    logInfo(`MessageCenter state updated`, {
      componentId,
      conversationsCount: conversations.length,
      messagesCount: messages.length,
      selectedConversationId: selectedConversation?.id,
      isLoading,
      error
    })
  }, [conversations.length, messages.length, selectedConversation?.id, isLoading, error])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load conversations on mount
  // Initial effect: load conversations & pending, optionally create
  useEffect(() => {
    if (!user) return
    loadConversations()
    loadPending()
    if (productData && !initialConversation) {
      createNewConversation()
    }
    // We intentionally do not include function refs to avoid re-runs due to new identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, productData, initialConversation])

  // Load messages when conversation is selected
  const markAsRead = async (conversationId: string) => {
    if (!user) return
    try {
      await markMessagesAsRead(conversationId, user.id)
    } catch (error) {
      console.error('Error marking messages as read:', error)
    }
  }

  useEffect(() => {
    if (!selectedConversation) return
    loadMessages(selectedConversation.id)
    markAsRead(selectedConversation.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation])

  const loadConversations = async () => {
    if (!user?.id) {
      logWarning('Cannot load conversations: no user ID', { componentId })
      return
    }
    
    const startTime = Date.now()
    logInfo('Starting conversation load', { componentId, userId: user.id })
    
    try {
      setIsLoading(true)
      setError(null)
      
      const data = await getConversations(user.id)
      
      const loadTime = Date.now() - startTime
      logInfo('Conversations loaded successfully', { 
        componentId, 
        conversationsCount: data.length,
        loadTimeMs: loadTime
      })
      
      setConversations(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logError('Failed to load conversations', error as Error, {
        componentId,
        userId: user.id,
        loadTimeMs: Date.now() - startTime
      })
      
      setError(`Error al cargar conversaciones: ${errorMessage}`)
      
      // Don't set empty arrays on error - keep existing data if available
      if (conversations.length === 0) {
        setConversations([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const loadPending = async () => {
    if (!user) return
    try {
      const data = await getPendingConversations()
      setPendingConvs(data)
    } catch {
      console.warn('Sin conversaciones pendientes')
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      const data = await getMessages(conversationId)
      // Ensure data is always an array, even if API returns null/undefined
      setMessages(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading messages:', error)
      // Set empty array on error to prevent .map() errors
      setMessages([])
      // Show user-friendly error notification
      if (error instanceof Error) {
        console.error('Failed to load messages:', error.message)
      }
    }
  }

  const createNewConversation = async () => {
    if (!user || !productData) return
    
    try {
      setIsLoading(true)
      // This would typically call createConversation API
      // For now, we'll simulate a new conversation
      const newConversation: Conversation = {
        id: `conv-${Date.now()}`,
        buyer_id: user.id,
        buyer_name: user.full_name || 'Comprador',
        seller_id: productData.seller_id,
        seller_name: productData.seller_name,
        product_id: productData.id,
        product_name: productData.name,
        product_image: productData.image_url,
        status: 'pending',
        unread_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      setSelectedConversation(newConversation)
      setConversations(prev => [newConversation, ...prev])
      
      // Send initial message
      await sendInitialMessage(newConversation.id)
    } catch (error) {
      console.error('Error creating conversation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendInitialMessage = async (conversationId: string) => {
    if (!user) return
    
    try {
      await sendMessage(
        conversationId,
        user.id,
        user.full_name || 'Comprador',
        'Hola, vi tu producto y estoy interesado.',
        true
      )
      await loadMessages(conversationId)
    } catch (error) {
      console.error('Error sending initial message:', error)
    }
  }

  // markAsRead moved above with useCallback

  const handleSendMessage = async () => {
    if (!user || !selectedConversation || !newMessage.trim()) return
    
    try {
      await sendMessage(
        selectedConversation.id,
        user.id,
        user.full_name || 'Comprador',
        newMessage.trim(),
        false
      )
      setNewMessage('')
      await loadMessages(selectedConversation.id)
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }

  const handleQuickRequest = async (requestType: QuickRequestType) => {
    if (!user || !selectedConversation) return
    
    try {
      await sendQuickRequest(
        selectedConversation.id,
        user.id,
        user.full_name || 'Comprador',
        requestType
      )
      setShowQuickRequests(false)
      await loadMessages(selectedConversation.id)
    } catch (error) {
      console.error('Error sending quick request:', error)
    }
  }

  const handleQuickResponse = async (responseType: QuickResponseType, messageId: string) => {
    if (!user || !selectedConversation) return
    
    try {
      await sendQuickResponse(
        selectedConversation.id,
        user.id,
        user.full_name || 'Comprador',
        responseType,
        messageId
      )
      await loadMessages(selectedConversation.id)
    } catch (error) {
      console.error('Error sending quick response:', error)
    }
  }

  const startPurchaseFlow = () => {
    setShowPurchaseFlow(true)
    setCurrentPurchaseStep(0)
  }

  type DeliveryMethodType = typeof purchaseData.deliveryMethod
  type PaymentMethodType = typeof purchaseData.paymentMethod
  interface StepData {
    quantity?: number
    finalPrice?: number
    deliveryMethod?: DeliveryMethodType
    paymentMethod?: PaymentMethodType
  }
  const handlePurchaseStep = async (stepData: StepData) => {
    if (!user || !selectedConversation) return
    
    const newPurchaseData: typeof purchaseData = {
      quantity: stepData.quantity ?? purchaseData.quantity,
      finalPrice: stepData.finalPrice ?? purchaseData.finalPrice,
      deliveryMethod: (stepData.deliveryMethod ?? purchaseData.deliveryMethod) as DeliveryMethodType,
      paymentMethod: (stepData.paymentMethod ?? purchaseData.paymentMethod) as PaymentMethodType
    }
    setPurchaseData(newPurchaseData)
    
    let message = ''
    let stepType = ''
    
    switch (currentPurchaseStep) {
      case 0: {
        message = `Perfecto, confirmamos ${stepData.quantity} unidades.`
        stepType = 'quantity_confirmation'
        break
      }
      case 1: {
        message = `Acordamos el precio final de $${stepData.finalPrice?.toLocaleString()}.`
        stepType = 'price_final'
        break
      }
      case 2: {
        const deliveryMethod = DELIVERY_METHODS.find(d => d.value === stepData.deliveryMethod)
        message = `Confirmamos entrega: ${deliveryMethod?.label}.`
        stepType = 'delivery_method'
        break
      }
      case 3: {
        const paymentMethod = PAYMENT_METHODS.find(p => p.value === stepData.paymentMethod)
        message = `Confirmamos pago: ${paymentMethod?.label}.`
        stepType = 'payment_method'
        break
      }
    }
    
    try {
      await sendPurchaseStep(
        selectedConversation.id,
        user.id,
        user.full_name || 'Comprador',
        stepType as 'quantity_confirmation' | 'price_final' | 'delivery_method' | 'payment_method',
        message,
        stepData
      )
      
      if (currentPurchaseStep < 3) {
        setCurrentPurchaseStep(currentPurchaseStep + 1)
      } else {
        // Final step - create purchase agreement
        await createPurchaseAgreement()
      }
      
      await loadMessages(selectedConversation.id)
    } catch (error) {
      console.error('Error in purchase step:', error)
    }
  }

  const createPurchaseAgreement = async () => {
    if (!user || !selectedConversation) return
    
    try {
      // This would call the API to create the agreement
      // const agreement: CompraAcuerdo = {
      //   id: `agreement-${Date.now()}`,
      //   conversation_id: selectedConversation.id,
      //   buyer_id: user.id,
      //   seller_id: selectedConversation.seller_id,
      //   product_id: selectedConversation.product_id,
      //   quantity: purchaseData.quantity,
      //   agreed_price: purchaseData.finalPrice,
      //   delivery_method: purchaseData.deliveryMethod,
      //   payment_method: purchaseData.paymentMethod,
      //   status: 'pending',
      //   created_at: new Date().toISOString()
      // }
      
      // setPurchaseAgreement(agreement)
      setShowPurchaseFlow(false)
      
      // Send confirmation message
      await sendMessage(
        selectedConversation.id,
        user.id,
        user.full_name || 'Comprador',
        '¡Listo! Acuerdo creado. Procedemos con el pago.',
        true
      )
      
      await loadMessages(selectedConversation.id)
    } catch (error) {
      console.error('Error creating purchase agreement:', error)
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && selectedConversation) {
      // Handle payment proof upload
      console.log('Uploading payment proof:', file)
    }
  }

  const renderMessage = (message: Message) => {
    const isFromCurrentUser = message.sender_id === user?.id
    const otherName = !isFromCurrentUser
      ? (message.sender_name
        || (message.sender_id === selectedConversation?.buyer_id ? selectedConversation?.buyer_name : selectedConversation?.seller_name)
        || 'Usuario')
      : 'Tú'

    console.log('[MessageCenter] renderMessage', {
      messageId: message.id,
      senderId: message.sender_id,
      senderName: message.sender_name,
      otherName,
      isFromCurrentUser,
      conversation: selectedConversation ? {
        id: selectedConversation.id,
        buyer_id: selectedConversation.buyer_id,
        seller_id: selectedConversation.seller_id,
        buyer_name: selectedConversation.buyer_name,
        seller_name: selectedConversation.seller_name
      } : null
    })

    // Format timestamp
    const formatTime = (timestamp: string) => {
      const date = new Date(timestamp)
      return date.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    }

    // Get avatar initials
    const getAvatarInitials = (name: string) => {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    }

    // Get avatar color based on sender
    const getAvatarColor = (senderId: string) => {
      const colors = ['bg-green-500', 'bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500']
      const colorIndex = senderId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length
      return colors[colorIndex]
    }
    
    return (
      <div key={message.id} className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}>
        {!isFromCurrentUser && (
          <div className="flex-shrink-0 mr-3">
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(message.sender_id)} flex items-center justify-center text-white text-sm font-medium`}>
              {getAvatarInitials(otherName)}
            </div>
          </div>
        )}
        
        <div className={`max-w-xs lg:max-w-md ${isFromCurrentUser ? 'order-1' : ''}`}>
          {/* Sender name and timestamp */}
          <div className={`flex items-center mb-1 ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}>
            <span className="text-xs text-gray-500 mr-2">
              {formatTime(message.created_at)}
            </span>
            <span className="text-xs font-medium text-gray-700">
              {otherName}
            </span>
          </div>
          
          {/* Message bubble */}
          <div className={`px-4 py-3 rounded-lg shadow-sm ${
            isFromCurrentUser 
              ? 'bg-blue-500 text-white rounded-br-none' 
              : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
          }`}>
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
          
          {/* Quick response buttons for sellers */}
          {!isFromCurrentUser && message.type === 'quick_request' && user?.id === selectedConversation?.seller_id && (
            <div className="mt-2 flex flex-wrap gap-1">
              {QUICK_RESPONSES.map(response => (
                <button
                  key={response.type}
                  onClick={() => handleQuickResponse(response.type, message.id)}
                  className="px-2 py-1 text-xs bg-white text-gray-700 rounded border hover:bg-gray-50"
                >
                  {response.icon} {response.label}
                </button>
              ))}
            </div>
          )}
          
          {/* Purchase flow buttons */}
          {message.type === 'purchase_step' && user?.id === selectedConversation?.buyer_id && (
            <div className="mt-2">
              <button
                onClick={startPurchaseFlow}
                className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
              >
                💰 Seguir a pago
              </button>
            </div>
          )}
        </div>
        
        {/* Avatar for current user (on the right) */}
        {isFromCurrentUser && (
          <div className="flex-shrink-0 ml-3">
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(message.sender_id)} flex items-center justify-center text-white text-sm font-medium`}>
              {getAvatarInitials(otherName)}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderPurchaseFlow = () => {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-semibold mb-4">Proceso de compra - Paso {currentPurchaseStep + 1} de 4</h3>
        
        {currentPurchaseStep === 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cantidad:</label>
            <input
              type="number"
              min="1"
              value={purchaseData.quantity}
              onChange={(e) => setPurchaseData({...purchaseData, quantity: parseInt(e.target.value) || 1})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={() => handlePurchaseStep({ quantity: purchaseData.quantity })}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Confirmar cantidad
            </button>
          </div>
        )}
        
        {currentPurchaseStep === 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Precio final:</label>
            <input
              type="number"
              value={purchaseData.finalPrice}
              onChange={(e) => setPurchaseData({...purchaseData, finalPrice: parseFloat(e.target.value) || 0})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
            <button
              onClick={() => handlePurchaseStep({ finalPrice: purchaseData.finalPrice })}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Confirmar precio
            </button>
          </div>
        )}
        
        {currentPurchaseStep === 2 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de entrega:</label>
            <select
              value={purchaseData.deliveryMethod}
              onChange={(e) => setPurchaseData({...purchaseData, deliveryMethod: e.target.value as typeof purchaseData.deliveryMethod})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {DELIVERY_METHODS.map(method => (
                <option key={method.value} value={method.value}>{method.label}</option>
              ))}
            </select>
            <button
              onClick={() => handlePurchaseStep({ deliveryMethod: purchaseData.deliveryMethod })}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Confirmar entrega
            </button>
          </div>
        )}
        
        {currentPurchaseStep === 3 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de pago:</label>
            <select
              value={purchaseData.paymentMethod}
              onChange={(e) => setPurchaseData({...purchaseData, paymentMethod: e.target.value as typeof purchaseData.paymentMethod})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              {PAYMENT_METHODS.map(method => (
                <option key={method.value} value={method.value}>{method.label} - {method.description}</option>
              ))}
            </select>
            <button
              onClick={() => handlePurchaseStep({ paymentMethod: purchaseData.paymentMethod })}
              className="mt-2 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Finalizar acuerdo
            </button>
          </div>
        )}
        
        <button
          onClick={() => setShowPurchaseFlow(false)}
          className="mt-2 text-sm text-gray-500 hover:text-gray-700"
        >
          Cancelar
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Por favor inicia sesión para ver tus mensajes.</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Conversations Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Mensajes</h2>
          <p className="text-sm text-gray-600">Chats con vendedores</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No tienes conversaciones aún</p>
            </div>
          ) : (
            conversations.map(conversation => (
              <div
                key={conversation.id}
                onClick={() => setSelectedConversation(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  selectedConversation?.id === conversation.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">
                      {user.id === conversation.buyer_id ? conversation.seller_name : conversation.buyer_name}
                    </p>
                    <p className="text-sm text-gray-600 truncate">{conversation.product_name}</p>
                    {conversation.last_message && (
                      <p className="text-sm text-gray-500 truncate">{conversation.last_message}</p>
                    )}
                  </div>
                  {conversation.unread_count > 0 && (
                    <span className="bg-blue-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                      {conversation.unread_count}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleDateString() : ''}
                </p>
              </div>
            ))
          )}
          {pendingConvs.length > 0 && (
            <div className="p-2 border-t">
              <p className="text-xs text-gray-500 mb-2">Conversaciones pendientes</p>
              {pendingConvs.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-gray-100">
                  <span className="text-sm truncate">Prod. {c.product_id || c.id.substring(0,8)}</span>
                  <button
                    onClick={async () => {
                      await joinConversation(c.id)
                      await loadConversations()
                      setPendingConvs(prev => prev.filter(pc => pc.id !== c.id))
                    }}
                    className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Unirme
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {user.id === selectedConversation.buyer_id 
                      ? selectedConversation.seller_name 
                      : selectedConversation.buyer_name}
                  </h3>
                  <p className="text-sm text-gray-600">{selectedConversation.product_name}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    selectedConversation.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    selectedConversation.status === 'agreed' ? 'bg-green-100 text-green-800' :
                    selectedConversation.status === 'paid' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedConversation.status}
                  </span>
                </div>
                <button
                  onClick={startPurchaseFlow}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Seguir a pago
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {Array.isArray(messages) && messages.length > 0 ? (
                messages.map(renderMessage)
              ) : (
                <div className="text-center text-gray-500 py-8">
                  {Array.isArray(messages) ? 'No hay mensajes aún' : 'Cargando mensajes...'}
                </div>
              )}
              {showPurchaseFlow && renderPurchaseFlow()}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Requests Panel */}
            {showQuickRequests && (
              <div className="bg-white border-t border-gray-200 p-4">
                <h4 className="font-medium text-gray-800 mb-3">Peticiones rápidas para campesinos:</h4>
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_REQUESTS.map(request => (
                    <button
                      key={request.type}
                      onClick={() => handleQuickRequest(request.type)}
                      className="p-3 text-left border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span className="text-lg">{request.icon}</span>
                      <span className="text-sm">{request.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowQuickRequests(false)}
                  className="mt-3 text-sm text-gray-500 hover:text-gray-700"
                >
                  Cerrar
                </button>
              </div>
            )}

            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setShowQuickRequests(!showQuickRequests)}
                  className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                >
                  Peticiones rápidas
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  📎 Adjuntar
                </button>
              </div>
              
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Escribe un mensaje..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">Selecciona una conversación</h3>
              <p className="text-gray-500">Elige un chat de la lista para comenzar a conversar</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
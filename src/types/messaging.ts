export type MessageStatus = 'pending' | 'agreed' | 'in_payment' | 'paid' | 'finished' | 'cancelled'

export type MessageType = 'text' | 'quick_request' | 'quick_response' | 'purchase_step' | 'payment_confirmation'

export type QuickRequestType = 
  | 'available'
  | 'price_negotiation' 
  | 'interested'
  | 'want_to_buy'
  | 'delivery_available'
  | 'other'

export type QuickResponseType =
  | 'available_yes'
  | 'available_no'
  | 'price_lower'
  | 'delivery_yes'
  | 'need_more_info'

export type PurchaseStepType =
  | 'quantity_confirmation'
  | 'price_final'
  | 'delivery_method'
  | 'payment_method'
  | 'purchase_summary'
  | 'payment_confirmation'

export type PaymentMethod = 'nequi' | 'daviplata' | 'contra_entrega'

export type DeliveryMethod = 'encuentro' | 'domicilio' | 'vereda'

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  sender_name: string
  content: string
  type: MessageType
  status: MessageStatus
  quick_request_type?: QuickRequestType
  quick_response_type?: QuickResponseType
  in_reply_to?: string
  purchase_step?: PurchaseStepType
  payment_method?: PaymentMethod
  delivery_method?: DeliveryMethod
  quantity?: number
  final_price?: number
  is_from_buyer: boolean
  created_at: string
  read_at?: string
}

export interface Conversation {
  id: string
  buyer_id: string
  buyer_name: string
  seller_id: string
  seller_name: string
  product_id: string
  product_name: string
  product_image?: string
  status: MessageStatus
  last_message?: string
  last_message_at?: string
  unread_count: number
  created_at: string
  updated_at: string
  // Indicates seller participant insertion pending (RLS prevented auto insert)
  seller_pending?: boolean
}

export interface Peticion {
  id: string
  conversation_id: string
  buyer_id: string
  seller_id: string
  product_id: string
  request_type: QuickRequestType
  custom_message?: string
  status: 'pending' | 'responded'
  response?: QuickResponseType
  created_at: string
  responded_at?: string
}

export interface CompraAcuerdo {
  id: string
  conversation_id: string
  buyer_id: string
  seller_id: string
  product_id: string
  quantity: number
  agreed_price: number
  delivery_method: DeliveryMethod
  payment_method: PaymentMethod
  status: 'pending' | 'confirmed' | 'paid' | 'delivered' | 'cancelled'
  payment_proof_url?: string
  delivery_location?: string
  delivery_date?: string
  created_at: string
  confirmed_at?: string
  paid_at?: string
  delivered_at?: string
}

export interface QuickRequestOption {
  type: QuickRequestType
  label: string
  message: string
  icon: string
}

export interface QuickResponseOption {
  type: QuickResponseType
  label: string
  message: string
  icon: string
}

export const QUICK_REQUESTS: QuickRequestOption[] = [
  {
    type: 'available',
    label: '¿Sigue disponible?',
    message: 'Hola, ¿sigue disponible?',
    icon: '❓'
  },
  {
    type: 'price_negotiation',
    label: '¿En cuánto lo deja?',
    message: 'Hola, ¿en cuánto me lo puede dejar?',
    icon: '💰'
  },
  {
    type: 'interested',
    label: 'Estoy interesado.',
    message: 'Hola, estoy interesado en el producto.',
    icon: '👋'
  },
  {
    type: 'want_to_buy',
    label: 'Quiero comprar.',
    message: 'Hola, quiero comprar. ¿Cómo procedemos?',
    icon: '🛒'
  },
  {
    type: 'delivery_available',
    label: '¿Puede entregar?',
    message: 'Hola, ¿puede hacer entrega?',
    icon: '🚚'
  },
  {
    type: 'other',
    label: 'Otra.',
    message: 'Hola, tengo una pregunta.',
    icon: '💬'
  }
]

export const QUICK_RESPONSES: QuickResponseOption[] = [
  {
    type: 'available_yes',
    label: 'Sí está disponible.',
    message: 'Sí, aún está disponible.',
    icon: '✅'
  },
  {
    type: 'available_no',
    label: 'No está disponible.',
    message: 'No, ya no está disponible.',
    icon: '❌'
  },
  {
    type: 'price_lower',
    label: 'Le puedo bajar el precio.',
    message: 'Le puedo bajar el precio. ¿Cuánto ofrece?',
    icon: '💵'
  },
  {
    type: 'delivery_yes',
    label: 'Puedo entregar.',
    message: 'Sí, puedo hacer la entrega.',
    icon: '🚛'
  },
  {
    type: 'need_more_info',
    label: 'Necesito más información.',
    message: 'Necesito más información. ¿Podría especificar?',
    icon: '📝'
  }
]

export const DELIVERY_METHODS: { value: DeliveryMethod; label: string }[] = [
  { value: 'encuentro', label: 'Encuentro en punto medio' },
  { value: 'domicilio', label: 'Entrega a domicilio' },
  { value: 'vereda', label: 'Entrega en la vereda' }
]

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; description: string }[] = [
  { value: 'nequi', label: 'Nequi', description: 'Pago por Nequi' },
  { value: 'daviplata', label: 'Daviplata', description: 'Pago por Daviplata' },
  { value: 'contra_entrega', label: 'Contra entrega', description: 'Pago en efectivo al recibir' }
]
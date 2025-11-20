import { decryptText, encryptText, exportKeyBase64, generateConversationKey, getStoredKey, importKeyBase64, storeKey } from '../utils/crypto'
import { apiFetch } from './apiClient'
import { offlineQueue, startOfflineRetry, stopOfflineRetry } from './offlineQueue'

// Servicio de mensajería backend-only. Realtime y recibos se implementarán más adelante vía WebSocket/SSE.

export type Conversation = { id: string; created_at: string }
export type Message = { id: string; conversation_id: string; sender_id: string; content_ciphertext: string; iv: string; mime_type?: string; created_at: string }
export type DecryptedMessage = Message & { content: string; status?: 'sent'|'delivered'|'read' }

const API_BASE = '/api/v1'

export async function ensureConversationWith(userId: string, otherUserId: string): Promise<Conversation> {
  // Buscar conversaciones existentes (incluyendo aquellas donde el usuario es el único participante)
  const existingIds = await listConversationIds(userId)
  let selected: Conversation | null = null
  let selectedParticipants: string[] = []
  for (const id of existingIds) {
    const participants = await getParticipantIds(id)
    // Conversación ya con el otro usuario
    if (participants.includes(otherUserId)) {
      const convData = await fetchConversation(id)
      if (convData) {
        selected = convData
        selectedParticipants = participants
        break
      }
    }
    // Reutilizar conversación “vacía” (solo usuario actual) si no encontramos otra
    if (!selected && participants.length === 1 && participants[0] === userId) {
      const convData = await fetchConversation(id)
      if (convData) {
        selected = convData
        selectedParticipants = participants
      }
    }
  }

  if (!selected) {
    // Crear nueva conversación
    const res = await apiFetch(`${API_BASE}/conversations`, { method: 'POST' })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      if (res.status === 401) throw new Error('No autorizado: inicia sesión para crear conversaciones')
      if (res.status === 403) throw new Error(detail || 'Permisos insuficientes para crear conversaciones')
      throw new Error(`Error ${res.status} creando conversación`)
    }
    const createdJson = await res.json()
    selected = Array.isArray(createdJson) ? createdJson[0] : createdJson
    selectedParticipants = []
  }

  if (!selected) {
    throw new Error('No se pudo crear o recuperar la conversación')
  }

  // Añadir participantes necesarios sin provocar conflicto 409
  const add = async (uid: string) => {
    if (selectedParticipants.includes(uid)) return
    let lastError: Error | null = null
    const maxRetries = 3
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const r = await apiFetch(`${API_BASE}/conversations/${selected.id}/participants`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: uid })
        })
        
        if (!r.ok) {
          const detail = await r.text().catch(()=> '')
          if (r.status === 401) throw new Error('No autorizado al registrar participante')
          if (r.status === 403) throw new Error(detail || 'No puedes añadir este participante')
          if (r.status === 409) return // Conflicto por carrera: ya existe
          
          // Handle 502/503/504 with retry logic
          if ([502, 503, 504].includes(r.status) && attempt < maxRetries) {
            console.warn(`[addParticipant] Attempt ${attempt}/${maxRetries} failed with ${r.status}, retrying...`)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Linear backoff
            continue
          }
          
          throw new Error(`Error ${r.status} añadiendo participante`)
        }
        
        selectedParticipants.push(uid)
        return // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        // If it's a circuit breaker error or persistent 502, queue the participant
        if ((lastError.message.includes('Circuit breaker') || lastError.message.includes('Service temporarily unavailable') || lastError.message.includes('502')) && attempt === maxRetries) {
          console.warn(`[addParticipant] Queuing participant ${uid} due to service unavailability`)
          offlineQueue.addParticipant(selected.id, uid)
          startOfflineRetry(processOfflineQueue)
          return // Don't throw, just queue it
        }
        
        if (attempt === maxRetries) {
          console.error(`[addParticipant] Failed after ${maxRetries} attempts:`, lastError)
          throw lastError
        }
      }
    }
  }
  await add(userId)
  if (otherUserId !== userId) await add(otherUserId)

  // Generar y guardar clave local (E2EE demo) si no existe todavía
  const existingKey = getStoredKey(selected.id)
  if (!existingKey) {
    const key = await generateConversationKey()
    const b64 = await exportKeyBase64(key)
    storeKey(selected.id, b64)
  }
  return selected
}

// Helpers internos añadidos para evitar duplicados y conflictos
async function listConversationIds(userId: string): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/conversations/by-user/${userId}`)
  if (!res.ok) return []
  const rows = await res.json()
  return (rows||[]).map((r: { conversation_id: string }) => r.conversation_id)
}

async function getParticipantIds(conversationId: string): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/conversations/${conversationId}/participants`)
  if (!res.ok) return []
  const rows: { user_id: string }[] = await res.json()
  return (rows||[]).map(r => r.user_id)
}

async function fetchConversation(id: string): Promise<Conversation | undefined> {
  const r = await apiFetch(`${API_BASE}/conversations/${id}`)
  if (!r.ok) return undefined
  const json = await r.json()
  const obj = Array.isArray(json) ? (json[0] ?? null) : json
  if (obj && obj.id) return obj as Conversation
  return undefined
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  const res = await apiFetch(`${API_BASE}/conversations/by-user/${userId}`)
  if (!res.ok) throw new Error('No se pudieron listar conversaciones')
  const rows = await res.json()
  const ids: string[] = (rows||[]).map((r: { conversation_id: string }) => r.conversation_id)
  if (ids.length === 0) return []
  // Fetch each conversation (could be optimized via backend join later)
  const out: Conversation[] = []
  for (const id of ids) {
    const r = await apiFetch(`${API_BASE}/conversations/${id}`)
    if (r.ok) {
      const json = await r.json()
      const obj = Array.isArray(json) ? (json[0] ?? null) : json
      if (obj && obj.id) out.push(obj as Conversation)
    }
  }
  // Fallback: si el backend no tiene endpoint detallado, devolvemos objetos mínimos.
  if (out.length === 0) return ids.map(id => ({ id, created_at: new Date().toISOString() }))
  // Filtrar conversaciones sin otros participantes (solo el usuario actual)
  const filtered: Conversation[] = []
  for (const conv of out) {
    try {
      const others = await getOtherParticipantIds(conv.id, userId)
      if (others.length > 0) filtered.push(conv)
    } catch {
      // Si falla, mantener conversación para no perder datos
      filtered.push(conv)
    }
  }
  return filtered
}

// Batch fetch other participant ids for many conversations (exclude current user)
export async function getConversationsParticipants(conversationIds: string[] = [], excludeUserId?: string): Promise<Record<string,string[]>> {
  if (!conversationIds.length) return {}
  const entries = await Promise.all(conversationIds.map(async (convId) => {
    try {
      const res = await apiFetch(`${API_BASE}/conversations/${convId}/participants`)
      if (!res.ok) return [convId, [] as string[]] as const
      const rows: { user_id: string }[] = await res.json()
      const ids = (rows || []).map(r => r.user_id).filter(uid => !excludeUserId || uid !== excludeUserId)
      return [convId, ids] as const
    } catch {
      return [convId, [] as string[]] as const
    }
  }))
  const map: Record<string, string[]> = {}
  for (const [k, v] of entries) map[k] = v
  return map
}

// Unread counts per conversation for a user based on message_receipts (rows without read_at)
export async function getUnreadCountByConversation(_userId?: string): Promise<Record<string, number>> {
  void _userId
  // Receipts aún no migrados; devolver 0 para todos.
  return {}
}

export async function loadMessages(userId: string, conversationId: string): Promise<DecryptedMessage[]>
export async function loadMessages(conversationId: string): Promise<DecryptedMessage[]>
export async function loadMessages(a: string, b?: string): Promise<DecryptedMessage[]> {
  const conversationId = b ?? a
  const keyB64 = getStoredKey(conversationId)
  const hasKey = !!keyB64
  const key = hasKey ? await importKeyBase64(keyB64) : undefined
  const res = await apiFetch(`${API_BASE}/messages?conversationId=${encodeURIComponent(conversationId)}`)
  if (!res.ok) throw new Error('No se pudieron cargar mensajes')
  const list: Message[] = await res.json()
  const out: DecryptedMessage[] = []
  for (const m of list) {
    if (hasKey && key) {
      try {
        const content = await decryptText(key, m.iv, m.content_ciphertext)
        out.push({ ...m, content })
      } catch {
        out.push({ ...m, content: '[mensaje cifrado]' })
      }
    } else {
      out.push({ ...m, content: '[mensaje cifrado]' })
    }
  }
  return out
}

export async function sendMessage(conversationId: string, senderId: string, text: string, mime: string = 'text/plain'): Promise<void> {
  const keyB64 = getStoredKey(conversationId)
  const maxRetries = 3
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (!keyB64) {
        // Sin clave local: delegar cifrado al backend con plaintext
        const res = await apiFetch(`${API_BASE}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: conversationId, sender_id: senderId, plaintext: text, mime_type: mime })
        })
        if (!res.ok) {
          const detail = await res.text().catch(()=> '')
          if (res.status === 401) throw new Error('No autorizado: inicia sesión para enviar mensajes')
          if (res.status === 403) throw new Error(detail || 'No tienes permiso para enviar este mensaje')
          
          // Handle 502/503/504 with retry logic
          if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
            console.warn(`[sendMessage] Attempt ${attempt}/${maxRetries} failed with ${res.status}, retrying...`)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
            continue
          }
          
          throw new Error(`Error ${res.status} enviando mensaje`)
        }
        return // Success
      } else {
        // Con clave local: cifrar en cliente
        const key = await importKeyBase64(keyB64)
        const { ivB64, ctB64 } = await encryptText(key, text)
        const res = await apiFetch(`${API_BASE}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: conversationId, sender_id: senderId, content_ciphertext: ctB64, iv: ivB64, mime_type: mime })
        })
        if (!res.ok) {
          const detail = await res.text().catch(()=> '')
          if (res.status === 401) throw new Error('No autorizado: inicia sesión para enviar mensajes')
          if (res.status === 403) throw new Error(detail || 'No tienes permiso para enviar este mensaje')
          
          // Handle 502/503/504 with retry logic
          if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
            console.warn(`[sendMessage] Attempt ${attempt}/${maxRetries} failed with ${res.status}, retrying...`)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
            continue
          }
          
          throw new Error(`Error ${res.status} enviando mensaje`)
        }
        return // Success
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      
      // If it's a circuit breaker error or server unavailable, queue the message
      if (lastError.message.includes('Circuit breaker') || lastError.message.includes('Service temporarily unavailable')) {
        console.warn('[sendMessage] Queuing message due to service unavailability')
        offlineQueue.addMessage(conversationId, senderId, text, mime)
        
        // Start offline retry mechanism if not already running
        startOfflineRetry(processOfflineQueue)
        
        // Show user-friendly message
        throw new Error('Tu mensaje se guardó localmente y se enviará cuando el servidor esté disponible')
      }
      
      // Check if it's a persistent 502 error
      if (lastError.message.includes('502') && attempt === maxRetries) {
        console.warn('[sendMessage] Persistent 502 error, queuing message')
        offlineQueue.addMessage(conversationId, senderId, text, mime)
        startOfflineRetry(processOfflineQueue)
        throw new Error('Tu mensaje se guardó localmente y se enviará cuando el servidor esté disponible')
      }
      
      if (attempt === maxRetries) {
        console.error(`[sendMessage] Failed after ${maxRetries} attempts:`, lastError)
        throw lastError
      }
      console.warn(`[sendMessage] Attempt ${attempt}/${maxRetries} failed, retrying...`, lastError)
    }
  }
  throw lastError || new Error('Failed to send message')
}

// Process offline queue
async function processOfflineQueue() {
  const pendingMessages = offlineQueue.getPendingMessages()
  const pendingParticipants = offlineQueue.getPendingParticipants()
  
  console.log(`[OfflineQueue] Processing ${pendingMessages.length} messages and ${pendingParticipants.length} participants`)
  
  // Try to process participants first
  for (const participant of pendingParticipants) {
    try {
      const res = await apiFetch(`${API_BASE}/conversations/${participant.conversationId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: participant.userId })
      })
      
      if (res.ok || res.status === 409) {
        offlineQueue.removeParticipant(participant.id)
        console.log(`[OfflineQueue] Successfully processed participant ${participant.userId}`)
      } else {
        offlineQueue.markParticipantAttempted(participant.id)
      }
    } catch (e) {
      console.error(`[OfflineQueue] Failed to process participant ${participant.userId}:`, e)
      offlineQueue.markParticipantAttempted(participant.id)
    }
  }
  
  // Then process messages
  for (const message of pendingMessages) {
    try {
      const keyB64 = getStoredKey(message.conversationId)
      let body: any
      
      if (!keyB64) {
        body = { conversation_id: message.conversationId, sender_id: message.senderId, plaintext: message.text, mime_type: message.mime }
      } else {
        const key = await importKeyBase64(keyB64)
        const { ivB64, ctB64 } = await encryptText(key, message.text)
        body = { conversation_id: message.conversationId, sender_id: message.senderId, content_ciphertext: ctB64, iv: ivB64, mime_type: message.mime }
      }
      
      const res = await apiFetch(`${API_BASE}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      
      if (res.ok) {
        offlineQueue.removeMessage(message.id)
        console.log(`[OfflineQueue] Successfully processed message ${message.id}`)
      } else {
        offlineQueue.markMessageAttempted(message.id)
      }
    } catch (e) {
      console.error(`[OfflineQueue] Failed to process message ${message.id}:`, e)
      offlineQueue.markMessageAttempted(message.id)
    }
  }
  
  // If queue is empty, stop the retry mechanism
  const stats = offlineQueue.getStats()
  if (stats.pendingMessages === 0 && stats.pendingParticipants === 0) {
    stopOfflineRetry()
    console.log('[OfflineQueue] Queue empty, stopping retry mechanism')
  }
}

// Helper para iniciar contacto desde productos u otros contextos
export async function contactUser(currentUserId: string, otherUserId: string, initialText: string = 'Hola. ¿Sigue estando disponible?'): Promise<Conversation> {
  let conv: Conversation
  try {
    conv = await ensureConversationWith(currentUserId, otherUserId)
  } catch {
    conv = await ensureConversationQuick(currentUserId, otherUserId)
  }
  await sendMessage(conv.id, currentUserId, initialText)
  return conv
}

export function subscribeMessages(_conversationId?: string, _onNew?: () => void) { void _conversationId; void _onNew; return () => {} }

export function subscribeReceipts(_conversationId?: string, _onReceipt?: () => void) { void _conversationId; void _onReceipt; return () => {} }

export async function markDelivered(_userId?: string, _messageIds?: string[]) { void _userId; void _messageIds; }
export async function markRead(_userId?: string, _messageIds?: string[]) { void _userId; void _messageIds; }

export async function softDeleteMessage(_messageId?: string) { void _messageId; }

export async function getOtherParticipantIds(conversationId: string, excludeUserId: string): Promise<string[]> {
  const res = await apiFetch(`${API_BASE}/conversations/${conversationId}/participants`)
  if (!res.ok) return []
  const rows: { user_id: string }[] = await res.json()
  return (rows || []).map(r => r.user_id).filter(uid => uid !== excludeUserId)
}

// Typing indicator via realtime broadcast
export function subscribeTyping(_conversationId?: string, _onTyping?: (evt: { userId: string }) => void) { void _conversationId; void _onTyping; return () => {} }
export async function sendTyping(_conversationId?: string, _userId?: string) { void _conversationId; void _userId; }

// Attachments
export async function uploadAttachment(): Promise<{ url: string; mime: string }> {
  throw new Error('Adjuntos no migrados aún')
}
export async function sendAttachment(_conversationId?: string, _userId?: string, _file?: File): Promise<void> {
  void _conversationId; void _userId; void _file;
  throw new Error('Adjuntos no migrados aún')
}
async function ensureConversationQuick(userId: string, otherUserId: string): Promise<Conversation> {
  let lastError: Error | null = null
  const maxRetries = 3
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await apiFetch(`${API_BASE}/conversations`, { method: 'POST' })
      if (!res.ok) {
        const detail = await res.text().catch(()=> '')
        if (res.status === 401) throw new Error('No autorizado: inicia sesión para crear conversaciones')
        if (res.status === 403) throw new Error(detail || 'Permisos insuficientes para crear conversaciones')
        
        // Handle 502/503/504 with retry logic
        if ([502, 503, 504].includes(res.status) && attempt < maxRetries) {
          console.warn(`[ensureConversationQuick] Attempt ${attempt}/${maxRetries} failed with ${res.status}, retrying...`)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Linear backoff
          continue
        }
        
        throw new Error(`Error ${res.status} creando conversación`)
      }
      const createdJson = await res.json()
      const conv: Conversation = Array.isArray(createdJson) ? createdJson[0] : createdJson
      
      // Add participants with enhanced error handling
      const add = async (uid: string) => {
        const maxParticipantRetries = 3
        for (let pAttempt = 1; pAttempt <= maxParticipantRetries; pAttempt++) {
          try {
            const r = await apiFetch(`${API_BASE}/conversations/${conv.id}/participants`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: uid })
            })
            if (!r.ok) {
              const detail = await r.text().catch(()=> '')
              if (r.status === 401) throw new Error('No autorizado al registrar participante')
              if (r.status === 403) throw new Error(detail || 'No puedes añadir este participante')
              if (r.status === 409) return // Participant already exists
              
              // Handle 502/503/504 with retry logic
              if ([502, 503, 504].includes(r.status) && pAttempt < maxParticipantRetries) {
                console.warn(`[addParticipant] Attempt ${pAttempt}/${maxParticipantRetries} failed with ${r.status}, retrying...`)
                await new Promise(resolve => setTimeout(resolve, 1000 * pAttempt))
                continue
              }
              
              throw new Error(`Error ${r.status} añadiendo participante`)
            }
            return // Success
          } catch (error) {
            if (pAttempt === maxParticipantRetries) throw error
            console.warn(`[addParticipant] Attempt ${pAttempt}/${maxParticipantRetries} failed, retrying...`, error)
          }
        }
      }
      
      await add(userId)
      if (otherUserId !== userId) await add(otherUserId)
      return conv
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error')
      if (attempt === maxRetries) {
        console.error(`[ensureConversationQuick] Failed after ${maxRetries} attempts:`, lastError)
        throw lastError
      }
      console.warn(`[ensureConversationQuick] Attempt ${attempt}/${maxRetries} failed, retrying...`, lastError)
    }
  }
  throw lastError || new Error('Failed to create conversation')
}

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
        throw new Error(`Error ${r.status} añadiendo participante`)
      }

      selectedParticipants.push(uid)
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      // Si el circuito está abierto o el servicio está caído, encolar y no bloquear al usuario
      if (
        err.message.includes('Circuit breaker') ||
        err.message.includes('Service temporarily unavailable') ||
        err.message.includes('502')
      ) {
        console.warn(`[addParticipant] Queuing participant ${uid} due to service unavailability`, err)
        offlineQueue.addParticipant(selected.id, uid)
        startOfflineRetry(processOfflineQueue)
        return
      }
      console.error('[addParticipant] Failed to add participant', err)
      throw err
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
        throw new Error(`Error ${res.status} enviando mensaje`)
      }
      return
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
        throw new Error(`Error ${res.status} enviando mensaje`)
      }
      return
    }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error')

    // Cuando apiFetch ya agotó sus reintentos y/o abrió el circuito, encolar el mensaje
    if (
      err.message.includes('Circuit breaker') ||
      err.message.includes('Service temporarily unavailable') ||
      err.message.includes('502')
    ) {
      console.warn('[sendMessage] Queuing message due to service unavailability', err)
      offlineQueue.addMessage(conversationId, senderId, text, mime)
      startOfflineRetry(processOfflineQueue)
      // Mensaje amigable para el usuario
      throw new Error('Tu mensaje se guardó localmente y se enviará cuando el servidor esté disponible')
    }

    console.error('[sendMessage] Failed to send message', err)
    throw err
  }
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
      let body: string | object

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
  } catch (e) {
    const err = e instanceof Error ? e : new Error('Unknown error')
    // Si es claramente CORS/502/backend caído, no intentes ensureConversationQuick, solo crea conv "virtual"
    if (
      err.message.includes('Circuit breaker') ||
      err.message.includes('Service temporarily unavailable') ||
      err.message.includes('Failed to fetch') ||
      err.message.includes('502')
    ) {
      console.warn('[contactUser] Backend unavailable, creating virtual conversation only on client', err)
      conv = {
        id: `local-${currentUserId}-${otherUserId}`,
        created_at: new Date().toISOString()
      }
    } else {
      // Para otros errores mantén el fallback actual
      conv = await ensureConversationQuick(currentUserId, otherUserId)
    }
  }
  await sendMessage(conv.id, currentUserId, initialText)
  return conv
}

// Subscribe to messages and receipts (no-op for now)
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
  // Simplificado: deja que apiFetch maneje reintentos/circuit breaker
  const res = await apiFetch(`${API_BASE}/conversations`, { method: 'POST' })
  if (!res.ok) {
    const detail = await res.text().catch(()=> '')
    if (res.status === 401) throw new Error('No autorizado: inicia sesión para crear conversaciones')
    if (res.status === 403) throw new Error(detail || 'Permisos insuficientes para crear conversaciones')
    throw new Error(`Error ${res.status} creando conversación`)
  }
  const createdJson = await res.json()
  const conv: Conversation = Array.isArray(createdJson) ? createdJson[0] : createdJson

  const add = async (uid: string) => {
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
        if (r.status === 409) return
        throw new Error(`Error ${r.status} añadiendo participante`)
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown error')
      console.error('[ensureConversationQuick.add] Failed to add participant', err)
      // en entorno de error de red, contactUser ya se encargará de fallback
      throw err
    }
  }

  await add(userId)
  if (otherUserId !== userId) await add(otherUserId)
  return conv
}

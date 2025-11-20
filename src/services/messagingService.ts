import { decryptText, encryptText, exportKeyBase64, generateConversationKey, getStoredKey, importKeyBase64, storeKey } from '../utils/crypto'
import { apiFetch } from './apiClient'

// Servicio de mensajería backend-only. Realtime y recibos se implementarán más adelante vía WebSocket/SSE.

export type Conversation = { id: string; created_at: string }
export type Message = { id: string; conversation_id: string; sender_id: string; content_ciphertext: string; iv: string; mime_type?: string; created_at: string }
export type DecryptedMessage = Message & { content: string; status?: 'sent'|'delivered'|'read' }

const API_BASE = '/api/v1'

export async function ensureConversationWith(userId: string, otherUserId: string): Promise<Conversation> {
  // List existing conversations for user and check if other user participates
  const existing = await listConversations(userId)
  for (const conv of existing) {
    const parts = await getOtherParticipantIds(conv.id, userId)
    if (parts.includes(otherUserId)) return conv
  }
  // Create new conversation
  const res = await apiFetch(`${API_BASE}/conversations`, { method: 'POST' })
  if (!res.ok) {
    const detail = await res.text().catch(()=> '')
    if (res.status === 401) throw new Error('No autorizado: inicia sesión para crear conversaciones')
    if (res.status === 403) throw new Error(detail || 'Permisos insuficientes para crear conversaciones')
    throw new Error(`Error ${res.status} creando conversación`)
  }
  const createdJson = await res.json()
  // El backend puede devolver arreglo de filas insertadas; tomamos la primera si aplica.
  const conv: Conversation = Array.isArray(createdJson) ? createdJson[0] : createdJson
  // Add participants
  const add = async (uid: string) => {
    const r = await apiFetch(`${API_BASE}/conversations/${conv.id}/participants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: uid })
    })
    if (!r.ok) {
      const detail = await r.text().catch(()=> '')
      if (r.status === 401) throw new Error('No autorizado al registrar participante')
      if (r.status === 403) throw new Error(detail || 'No puedes añadir este participante')
      throw new Error(`Error ${r.status} añadiendo participante`)
    }
  }
  await add(userId)
  await add(otherUserId)
  // Generate and store local key (E2EE demo)
  const existingKey = getStoredKey(conv.id)
  if (!existingKey) {
    const key = await generateConversationKey()
    const b64 = await exportKeyBase64(key)
    storeKey(conv.id, b64)
  }
  return conv
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
  }
}

// Helper para iniciar contacto desde productos u otros contextos
export async function contactUser(currentUserId: string, otherUserId: string, initialText: string = 'Hola. ¿Sigue estando disponible?'): Promise<Conversation> {
  const conv = await ensureConversationWith(currentUserId, otherUserId)
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

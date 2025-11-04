import { isSupabaseEnabled, supabase } from './supabaseClient'
import { v4 as uuidv4 } from './uuid'
import { decryptText, encryptText, exportKeyBase64, generateConversationKey, getStoredKey, importKeyBase64, storeKey } from '../utils/crypto'
import { isSupabaseEnabled as isSB } from './supabaseClient'
import type { RealtimeChannel } from '@supabase/supabase-js'

export type Conversation = { id: string; created_at: string }
export type Message = { id: string; conversation_id: string; sender_id: string; content_ciphertext: string; iv: string; mime_type?: string; created_at: string }
export type DecryptedMessage = Message & { content: string; status?: 'sent'|'delivered'|'read' }

const TABLE_CONV = 'conversations'
const TABLE_MSG = 'messages'
const TABLE_REC = 'message_receipts'
const TABLE_DEL = 'messages_deleted_by'
const TABLE_PARTICIPANTS = 'conversation_participants'
const BUCKET = 'message-attachments'

export async function ensureConversationWith(userId: string, otherUserId: string): Promise<Conversation> {
  if (!isSupabaseEnabled()) {
    // local mock: single conversation id for pair key
    const id = uuidv4()
    return { id, created_at: new Date().toISOString() }
  }
  // Try find existing conversation with both participants
  // Find intersection of conversations between both users
  // Simpler: list user conversations and check participants
  const { data: myParts } = await supabase.from(TABLE_PARTICIPANTS).select('conversation_id').eq('user_id', userId)
  const { data: theirParts } = await supabase.from(TABLE_PARTICIPANTS).select('conversation_id').eq('user_id', otherUserId)
  const mySet = new Set((myParts||[]).map(r=>r.conversation_id))
  const common = (theirParts||[]).map(r=>r.conversation_id).find(id=> mySet.has(id))
  if (common) {
    return (await supabase.from(TABLE_CONV).select('*').eq('id', common).single()).data as Conversation
  }
  // Create new conversation and add both participants
  // Important: avoid returning representation here to bypass SELECT RLS before the user is a participant
  const newId = uuidv4()
  const { error: e1 } = await supabase.from(TABLE_CONV).insert({ id: newId })
  if (e1) throw new Error(e1.message)
  const cid = newId
  // Insert participants sequentially to satisfy RLS policies
  const { error: e2a } = await supabase.from(TABLE_PARTICIPANTS).insert({ conversation_id: cid, user_id: userId })
  if (e2a) throw new Error(e2a.message)
  const { error: e2b } = await supabase.from(TABLE_PARTICIPANTS).insert({ conversation_id: cid, user_id: otherUserId })
  if (e2b) throw new Error(e2b.message)
  // Generate and store a conversation key locally (demo E2EE)
  const existing = getStoredKey(cid)
  if (!existing) {
    const key = await generateConversationKey()
    const b64 = await exportKeyBase64(key)
    storeKey(cid, b64)
  }
  return { id: cid, created_at: new Date().toISOString() }
}

export async function listConversations(userId: string): Promise<Conversation[]> {
  if (!isSupabaseEnabled()) return []
  const part = await supabase.from(TABLE_PARTICIPANTS).select('conversation_id').eq('user_id', userId)
  if (part.error) throw new Error(part.error.message)
  const ids = (part.data||[]).map(r=>r.conversation_id)
  if (ids.length === 0) return []
  const { data, error } = await supabase.from(TABLE_CONV).select('*').in('id', ids).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data as Conversation[])
}

// Batch fetch other participant ids for many conversations (exclude current user)
export async function getConversationsParticipants(conversationIds: string[], currentUserId: string): Promise<Record<string, string[]>> {
  if (!isSupabaseEnabled() || conversationIds.length === 0) return {}
  type ParticipantRow = { conversation_id: string; user_id: string }
  const { data, error } = await supabase
    .from(TABLE_PARTICIPANTS)
    .select('conversation_id, user_id')
    .in('conversation_id', conversationIds)
  if (error) throw new Error(error.message)
  const map: Record<string, string[]> = {}
  ;(data as ParticipantRow[] | null || []).forEach((row) => { // row has conversation_id, user_id
    const cid = row.conversation_id
    const uid = row.user_id
    if (uid === currentUserId) return
    if (!map[cid]) map[cid] = []
    map[cid].push(uid)
  })
  return map
}

// Unread counts per conversation for a user based on message_receipts (rows without read_at)
export async function getUnreadCountByConversation(userId: string): Promise<Record<string, number>> {
  if (!isSupabaseEnabled()) return {}
  // Get receipts with no read_at for this user
  type ReceiptRow = { message_id: string; user_id: string; delivered_at?: string | null; read_at?: string | null }
  const { data: rec, error: e1 } = await supabase
    .from(TABLE_REC)
    .select('message_id')
    .eq('user_id', userId)
    .is('read_at', null)
  if (e1) throw new Error(e1.message)
  const msgIds = ((rec as ReceiptRow[] | null) || []).map((r) => r.message_id)
  if (msgIds.length === 0) return {}
  // Map message ids to conversation ids
  type MessageIdToConv = { id: string; conversation_id: string }
  const { data: msgs, error: e2 } = await supabase
    .from(TABLE_MSG)
    .select('id, conversation_id')
    .in('id', msgIds)
  if (e2) throw new Error(e2.message)
  const counts: Record<string, number> = {}
  ;((msgs as MessageIdToConv[] | null) || []).forEach((m) => {
    const cid = m.conversation_id
    counts[cid] = (counts[cid] || 0) + 1
  })
  return counts
}

export async function loadMessages(userId: string, conversationId: string): Promise<DecryptedMessage[]> {
  if (!isSupabaseEnabled()) return []
  const keyB64 = getStoredKey(conversationId)
  if (!keyB64) return []
  const key = await importKeyBase64(keyB64)
  const { data, error } = await supabase
    .from(TABLE_MSG)
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  const list = (data as Message[])
  const out: DecryptedMessage[] = []
  for (const m of list) {
    try {
      const content = await decryptText(key, m.iv, m.content_ciphertext)
      out.push({ ...m, content })
    } catch {
      out.push({ ...m, content: '[mensaje cifrado]' })
    }
  }
  // Compute statuses for messages sent by current user
  const otherIds = await getOtherParticipantIds(conversationId, userId)
  if (otherIds.length > 0) {
    const msgIds = out.filter(m => m.sender_id === userId).map(m => m.id)
    if (msgIds.length > 0) {
      const { data: rec } = await supabase
        .from(TABLE_REC)
        .select('*')
        .in('message_id', msgIds)
        .in('user_id', otherIds)
      const recMap = new Map<string, { delivered: boolean; read: boolean }>()
      ;(rec||[]).forEach(r => {
        const key = r.message_id as string
        const prev = recMap.get(key) || { delivered: false, read: false }
        recMap.set(key, { delivered: prev.delivered || Boolean(r.delivered_at), read: prev.read || Boolean(r.read_at) })
      })
      out.forEach(m => {
        if (m.sender_id === userId) {
          const rr = recMap.get(m.id)
          if (rr?.read) m.status = 'read'
          else if (rr?.delivered) m.status = 'delivered'
          else m.status = 'sent'
        }
      })
    } else {
      // no own messages
    }
  }
  return out
}

export async function sendMessage(conversationId: string, senderId: string, text: string, mime: string = 'text/plain'): Promise<void> {
  const keyB64 = getStoredKey(conversationId)
  if (!keyB64) throw new Error('No hay clave de conversación')
  const key = await importKeyBase64(keyB64)
  const { ivB64, ctB64 } = await encryptText(key, text)
  if (!isSupabaseEnabled()) return
  const { error } = await supabase.from(TABLE_MSG).insert({ conversation_id: conversationId, sender_id: senderId, content_ciphertext: ctB64, iv: ivB64, mime_type: mime })
  if (error) throw new Error(error.message)
}

export function subscribeMessages(conversationId: string, cb: (m: Message)=>void){
  if (!isSupabaseEnabled()) return () => {}
  const ch = supabase.channel('msg:'+conversationId).on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE_MSG, filter: `conversation_id=eq.${conversationId}` }, (p)=>{
    cb(p.new as Message)
  }).subscribe()
  return ()=> supabase.removeChannel(ch)
}

export function subscribeReceipts(conversationId: string, cb: ()=>void){
  if (!isSB()) return () => {}
  const ch = supabase.channel('rec:'+conversationId).on('postgres_changes', { event: '*', schema: 'public', table: TABLE_REC }, ()=> cb()).subscribe()
  return ()=> supabase.removeChannel(ch)
}

export async function markDelivered(userId: string, messageIds: string[]) {
  if (!isSupabaseEnabled() || messageIds.length===0) return
  const rows = messageIds.map(id => ({ message_id: id, user_id: userId, delivered_at: new Date().toISOString() }))
  await supabase.from(TABLE_REC).upsert(rows, { onConflict: 'message_id,user_id' })
}
export async function markRead(userId: string, messageIds: string[]) {
  if (!isSupabaseEnabled() || messageIds.length===0) return
  const rows = messageIds.map(id => ({ message_id: id, user_id: userId, read_at: new Date().toISOString() }))
  await supabase.from(TABLE_REC).upsert(rows, { onConflict: 'message_id,user_id' })
}

export async function softDeleteMessage(userId: string, messageId: string){
  if (!isSupabaseEnabled()) return
  await supabase.from(TABLE_DEL).insert({ message_id: messageId, user_id: userId })
}

export async function getOtherParticipantIds(conversationId: string, currentUserId: string): Promise<string[]> {
  if (!isSupabaseEnabled()) return []
  const { data, error } = await supabase.from(TABLE_PARTICIPANTS).select('user_id').eq('conversation_id', conversationId)
  if (error) throw new Error(error.message)
  return (data||[]).map(r => r.user_id).filter((id:string)=> id !== currentUserId)
}

// Typing indicator via realtime broadcast
export function subscribeTyping(conversationId: string, onTyping: (payload: { userId: string })=>void){
  if (!isSB()) return () => {}
  const channel = supabase.channel('typing:'+conversationId, { config: { broadcast: { self: false } } }) as RealtimeChannel
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(channel as any).on('broadcast', { event: 'typing' }, (payload: { payload?: { userId: string } }) => {
    if (payload?.payload) onTyping(payload.payload)
  }).subscribe()
  return ()=> supabase.removeChannel(channel)
}
export async function sendTyping(conversationId: string, userId: string){
  if (!isSB()) return
  const channel = supabase.channel('typing:'+conversationId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (channel as any).send({ type: 'broadcast', event: 'typing', payload: { userId } })
  supabase.removeChannel(channel)
}

// Attachments
export async function uploadAttachment(userId: string, file: File): Promise<{ url: string; mime: string }>{
  if (!isSB()) {
    return { url: URL.createObjectURL(file), mime: file.type || 'application/octet-stream' }
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('Archivo supera 10MB')
  const ext = file.name.split('.').pop() || 'bin'
  const path = `${userId}/${uuidv4()}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  if (!data?.publicUrl) throw new Error('No se pudo obtener URL del archivo')
  return { url: data.publicUrl, mime: file.type || 'application/octet-stream' }
}
export async function sendAttachment(conversationId: string, senderId: string, file: File): Promise<void> {
  const { url, mime } = await uploadAttachment(senderId, file)
  await sendMessage(conversationId, senderId, url, mime)
}

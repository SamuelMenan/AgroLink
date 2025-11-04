import { isSupabaseEnabled, supabase } from './supabaseClient'

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'
export type NotificationType = 'request_new' | 'request_update' | 'message' | 'system'

export type NotificationItem = {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body?: string | null
  url?: string | null
  severity?: NotificationSeverity | null
  read_at?: string | null
  created_at: string
}

const TABLE = 'notifications'
const LS_KEY = 'agrolink_notifications'

export async function listRecentNotifications(userId: string, limit = 12): Promise<NotificationItem[]> {
  if (!isSupabaseEnabled()) {
    return getLocal().filter(n => n.user_id === userId).sort((a,b)=>new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit)
  }
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return data as NotificationItem[]
}

export async function getUnreadCount(userId: string): Promise<number> {
  if (!isSupabaseEnabled()) return getLocal().filter(n => n.user_id === userId && !n.read_at).length
  const { count, error } = await supabase.from(TABLE).select('id', { count: 'exact', head: true }).eq('user_id', userId).is('read_at', null)
  if (error) throw new Error(error.message)
  return count || 0
}

export async function markAsRead(id: string): Promise<void> {
  if (!isSupabaseEnabled()) {
    const all = getLocal()
    const idx = all.findIndex(n => n.id === id)
    if (idx !== -1) { all[idx] = { ...all[idx], read_at: new Date().toISOString() }; setLocal(all) }
    return
  }
  const { error } = await supabase.from(TABLE).update({ read_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function markAllAsRead(userId: string): Promise<void> {
  if (!isSupabaseEnabled()) {
    const all = getLocal().map(n => n.user_id === userId ? { ...n, read_at: new Date().toISOString() } : n)
    setLocal(all)
    return
  }
  const { error } = await supabase.from(TABLE).update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
  if (error) throw new Error(error.message)
}

export async function deleteNotification(id: string): Promise<void> {
  if (!isSupabaseEnabled()) {
    setLocal(getLocal().filter(n => n.id !== id))
    return
  }
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export function subscribeNotifications(userId: string, onInsert: (n: NotificationItem) => void) {
  if (!isSupabaseEnabled()) return () => {}
  const channel = supabase.channel('notifications-'+userId, {
    config: { broadcast: { ack: true } },
  })
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE, filter: `user_id=eq.${userId}` }, (payload) => {
    onInsert(payload.new as NotificationItem)
  })
  .subscribe()

  return () => { supabase.removeChannel(channel) }
}

// Helpers for mock/local mode
function getLocal(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as NotificationItem[]) : []
  } catch { return [] }
}
function setLocal(list: NotificationItem[]) { localStorage.setItem(LS_KEY, JSON.stringify(list)) }

// Migrated notification service: uses backend REST endpoints exclusively.

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

const API_BASE = '/api/notifications'

export async function listRecentNotifications(userId: string, limit = 12): Promise<NotificationItem[]> {
  const res = await fetch(`${API_BASE}/by-user/${userId}?limit=${limit}`)
  if (!res.ok) throw new Error('No se pudieron listar notificaciones')
  return await res.json()
}

export async function getUnreadCount(userId: string): Promise<number> {
  const res = await fetch(`${API_BASE}/unread-count/${userId}`)
  if (!res.ok) throw new Error('No se pudo obtener conteo no leídas')
  const rows = await res.json()
  return Array.isArray(rows) ? rows.length : 0
}

export async function markAsRead(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}/read`, { method: 'PATCH' })
  if (!res.ok) throw new Error('No se pudo marcar como leída')
}

export async function markAllAsRead(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/read-all/${userId}`, { method: 'PATCH' })
  if (!res.ok) throw new Error('No se pudo marcar todas')
}

export async function deleteNotification(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('No se pudo eliminar notificación')
}

export function subscribeNotifications(_userId: string, _onNotification: (n: NotificationItem) => void) { void _userId; void _onNotification; return () => {} }

// Helpers for mock/local mode
// Local storage helpers removed post-migration.
// getLocal/setLocal eliminados post-migración (no usados)

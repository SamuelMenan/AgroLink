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

// Versioned API base path (was '/api/notifications' before versioning)
const API_BASE = '/api/v1/notifications'
import { apiFetch } from './apiClient'

export async function listRecentNotifications(userId: string, limit = 12): Promise<NotificationItem[]> {
  const res = await apiFetch(`${API_BASE}?user_id=${userId}&limit=${limit}`)
  if (!res.ok) throw new Error('No se pudieron listar notificaciones')
  return await res.json()
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    // Try the endpoint-style URL first
    const res = await apiFetch(`${API_BASE}/unread-count/${userId}`)
    if (res.ok) {
      const data = await res.json()
      // Handle both old format (array) and new format (object with count)
      if (Array.isArray(data)) {
        return data.length
      } else if (data && typeof data === 'object' && 'count' in data) {
        return data.count || 0
      }
      return 0
    }
    
    // If 405 Method Not Allowed, try query parameter approach
    if (res.status === 405) {
      console.warn('Unread count endpoint returned 405, trying query parameter approach')
      const altRes = await apiFetch(`${API_BASE}?action=unread-count&user_id=${userId}`)
      if (altRes.ok) {
        const data = await altRes.json()
        return data.count || 0
      }
    }
    
    console.warn('Failed to get unread count, returning 0:', res.status)
    return 0
  } catch (error) {
    console.error('Error getting unread count:', error)
    return 0
  }
}

export async function markAsRead(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/${id}/read`, { method: 'PATCH' })
  if (!res.ok) throw new Error('No se pudo marcar como leída')
}

export async function markAllAsRead(userId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/read-all/${userId}`, { method: 'PATCH' })
  if (!res.ok) throw new Error('No se pudo marcar todas')
}

export async function deleteNotification(id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('No se pudo eliminar notificación')
}

export function subscribeNotifications(_userId: string, _onNotification: (n: NotificationItem) => void) { void _userId; void _onNotification; return () => {} }

// Helpers for mock/local mode
// Local storage helpers removed post-migration.
// getLocal/setLocal eliminados post-migración (no usados)

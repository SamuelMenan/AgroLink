/**
 * Offline Queue Service
 * Handles queuing of operations when offline
 */

interface QueuedOperation {
  id: string
  type: 'message' | 'product' | 'order'
  data: unknown
  timestamp: number
  retries: number
}

class OfflineQueue {
  private queue: QueuedOperation[] = []
  private readonly maxRetries = 3
  private readonly storageKey = 'agrolink_offline_queue'

  constructor() {
    this.loadFromStorage()
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        this.queue = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue))
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }

  add(type: QueuedOperation['type'], data: unknown): string {
    const id = `${type}-${Date.now()}-${Math.random()}`
    const operation: QueuedOperation = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retries: 0
    }
    this.queue.push(operation)
    this.saveToStorage()
    return id
  }

  remove(id: string) {
    this.queue = this.queue.filter(op => op.id !== id)
    this.saveToStorage()
  }

  getAll(): QueuedOperation[] {
    return [...this.queue]
  }

  get size(): number {
    return this.queue.length
  }

  clear() {
    this.queue = []
    this.saveToStorage()
  }

  incrementRetry(id: string): boolean {
    const op = this.queue.find(o => o.id === id)
    if (!op) return false
    
    op.retries++
    if (op.retries >= this.maxRetries) {
      this.remove(id)
      return false
    }
    
    this.saveToStorage()
    return true
  }
}

export const offlineQueue = new OfflineQueue()

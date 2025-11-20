// Offline message queue for handling failed API requests

export interface QueuedMessage {
  id: string
  conversationId: string
  senderId: string
  text: string
  mime: string
  timestamp: number
  attempts: number
}

export interface QueuedParticipant {
  id: string
  conversationId: string
  userId: string
  timestamp: number
  attempts: number
}

const OFFLINE_QUEUE_KEY = 'agrolink_offline_queue'
const MAX_ATTEMPTS = 5
const RETRY_INTERVAL = 30000 // 30 seconds

class OfflineQueue {
  private messages: QueuedMessage[] = []
  private participants: QueuedParticipant[] = []
  
  constructor() {
    this.loadFromStorage()
  }
  
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.messages = data.messages || []
        this.participants = data.participants || []
      }
    } catch (e) {
      console.error('[OfflineQueue] Failed to load from storage:', e)
    }
  }
  
  private saveToStorage() {
    try {
      const data = {
        messages: this.messages,
        participants: this.participants
      }
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[OfflineQueue] Failed to save to storage:', e)
    }
  }
  
  addMessage(conversationId: string, senderId: string, text: string, mime: string = 'text/plain'): QueuedMessage {
    const message: QueuedMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      senderId,
      text,
      mime,
      timestamp: Date.now(),
      attempts: 0
    }
    
    this.messages.push(message)
    this.saveToStorage()
    console.log('[OfflineQueue] Added message to queue:', message.id)
    return message
  }
  
  addParticipant(conversationId: string, userId: string): QueuedParticipant {
    const participant: QueuedParticipant = {
      id: `part_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      conversationId,
      userId,
      timestamp: Date.now(),
      attempts: 0
    }
    
    this.participants.push(participant)
    this.saveToStorage()
    console.log('[OfflineQueue] Added participant to queue:', participant.id)
    return participant
  }
  
  getPendingMessages(): QueuedMessage[] {
    return this.messages.filter(msg => msg.attempts < MAX_ATTEMPTS)
  }
  
  getPendingParticipants(): QueuedParticipant[] {
    return this.participants.filter(part => part.attempts < MAX_ATTEMPTS)
  }
  
  markMessageAttempted(messageId: string) {
    const message = this.messages.find(msg => msg.id === messageId)
    if (message) {
      message.attempts++
      this.saveToStorage()
    }
  }
  
  markParticipantAttempted(participantId: string) {
    const participant = this.participants.find(part => part.id === participantId)
    if (participant) {
      participant.attempts++
      this.saveToStorage()
    }
  }
  
  removeMessage(messageId: string) {
    this.messages = this.messages.filter(msg => msg.id !== messageId)
    this.saveToStorage()
    console.log('[OfflineQueue] Removed message:', messageId)
  }
  
  removeParticipant(participantId: string) {
    this.participants = this.participants.filter(part => part.id !== participantId)
    this.saveToStorage()
    console.log('[OfflineQueue] Removed participant:', participantId)
  }
  
  clear() {
    this.messages = []
    this.participants = []
    this.saveToStorage()
    console.log('[OfflineQueue] Cleared all queued items')
  }
  
  getStats() {
    return {
      messages: this.messages.length,
      participants: this.participants.length,
      pendingMessages: this.getPendingMessages().length,
      pendingParticipants: this.getPendingParticipants().length
    }
  }
}

export const offlineQueue = new OfflineQueue()

// Auto-retry mechanism
let retryInterval: number | null = null

export function startOfflineRetry(callback: () => Promise<void>) {
  if (retryInterval) {
    stopOfflineRetry()
  }
  
  retryInterval = window.setInterval(async () => {
    const stats = offlineQueue.getStats()
    if (stats.pendingMessages > 0 || stats.pendingParticipants > 0) {
      console.log('[OfflineQueue] Attempting to retry offline items...')
      try {
        await callback()
      } catch (e) {
        console.error('[OfflineQueue] Retry failed:', e)
      }
    }
  }, RETRY_INTERVAL)
  
  console.log('[OfflineQueue] Started offline retry mechanism')
}

export function stopOfflineRetry() {
  if (retryInterval) {
    window.clearInterval(retryInterval)
    retryInterval = null
    console.log('[OfflineQueue] Stopped offline retry mechanism')
  }
}
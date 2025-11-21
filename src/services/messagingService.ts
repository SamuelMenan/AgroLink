import type { 
  Message, 
  Conversation, 
  SendMessageRequest, 
  CreateConversationRequest, 
  MessageSearchFilters,
  MessagingUser,
  MessagingEvent 
} from '../types/messaging';
import { apiClient } from './apiClient';
import { validateEnvironment, getMessagingConfig } from '../utils/envValidation';

/**
 * Messaging Service - Handles all messaging-related operations
 * Features:
 * - Real-time message delivery
 * - Conversation management
 * - Message search and filtering
 * - User presence tracking
 * - Error handling and retry logic
 * - Offline message queuing
 */

export class MessagingService {
  private static instance: MessagingService;
  private eventSource?: EventSource;
  private messageQueue: Message[] = [];
  private retryAttempts = 0;
  private maxRetries = 3;
  private reconnectTimeout?: number;
  private envConfig = validateEnvironment();
  private messagingConfig = getMessagingConfig(this.envConfig);

  constructor() {
    // Reset state for testing
    this.messageQueue = [];
    this.retryAttempts = 0;
    
    console.log('[MessagingService] Initialized with config:', {
      baseUrl: this.messagingConfig.baseUrl,
      timeout: this.messagingConfig.timeout,
      retryAttempts: this.messagingConfig.retryAttempts,
      environment: this.envConfig.isProduction ? 'production' : 'development'
    });
  }

  static getInstance(): MessagingService {
    if (!MessagingService.instance) {
      MessagingService.instance = new MessagingService();
    }
    return MessagingService.instance;
  }

  /**
   * Send a message with retry logic and offline queuing
   */
  async sendMessage(request: SendMessageRequest): Promise<Message> {
    try {
      const message = await apiClient.post<Message>('/messages', request);
      this.retryAttempts = 0;
      return message;
    } catch (error) {
      // Queue message for later delivery if offline
      this.queueMessage(request);
      throw new Error(`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get conversations for current user with pagination
   * Falls back to empty conversations if endpoint doesn't exist
   */
  async getConversations(page = 1, limit = 20): Promise<{
    conversations: Conversation[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const response = await apiClient.get<{
        conversations: Conversation[];
        total: number;
        hasMore: boolean;
      }>(`/conversations?page=${page}&limit=${limit}`);
      return response;
    } catch (error) {
      // Check if it's a 404 error (endpoint doesn't exist)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const is404Error = 
        errorMessage.includes('404') || 
        errorMessage.includes('Not Found') || 
        errorMessage.includes('not found') ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('no existe');
      
      if (is404Error) {
        console.warn('[MessagingService] Conversations endpoint not found, returning empty conversations');
        return {
          conversations: [],
          total: 0,
          hasMore: false
        };
      }
      
      // For other errors, log once and return empty to prevent spam
      console.error('[MessagingService] Failed to fetch conversations:', errorMessage);
      return {
        conversations: [],
        total: 0,
        hasMore: false
      };
    }
  }

  /**
   * Get messages for a conversation with pagination
   */
  async getMessages(
    conversationId: string, 
    page = 1, 
    limit = 50,
    before?: string
  ): Promise<{
    messages: Message[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(before && { before })
      });
      
      const response = await apiClient.get<{
        messages: Message[];
        total: number;
        hasMore: boolean;
      }>(`/conversations/${conversationId}/messages?${params}`);
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a 404 error (endpoint doesn't exist)
      const is404Error = 
        errorMessage.includes('404') || 
        errorMessage.includes('Not Found') || 
        errorMessage.includes('not found') ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('no existe');
      
      if (is404Error) {
        console.warn('[MessagingService] Messages endpoint not found, returning empty messages');
        return {
          messages: [],
          total: 0,
          hasMore: false
        };
      }
      
      // For other errors, log once and return empty to prevent spam
      console.error('[MessagingService] Failed to fetch messages:', errorMessage);
      return {
        messages: [],
        total: 0,
        hasMore: false
      };
    }
  }

  /**
   * Create a new conversation
   */
  async createConversation(request: CreateConversationRequest): Promise<Conversation> {
    try {
      const conversation = await apiClient.post<Conversation>('/conversations', request);
      return conversation;
    } catch (error) {
      throw new Error(`Failed to create conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark messages as read
   */
  async markAsRead(conversationId: string, messageIds: string[]): Promise<void> {
    try {
      await apiClient.post(`/conversations/${conversationId}/read`, { messageIds });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
      // Non-critical error, don't throw
    }
  }

  /**
   * Search messages with filters
   */
  async searchMessages(filters: MessageSearchFilters): Promise<Message[]> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.set(key, String(value));
        }
      });
      
      const queryString = params.toString();
      const url = `/messages/search${queryString ? '?' + queryString : ''}`;
      const response = await apiClient.get<Message[]>(url);
      return response;
    } catch (error) {
      throw new Error(`Failed to search messages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get messaging user profile
   */
  async getUserProfile(userId: string): Promise<MessagingUser> {
    try {
      const user = await apiClient.get<MessagingUser>(`/users/${userId}/messaging-profile`);
      return user;
    } catch (error) {
      throw new Error(`Failed to fetch user profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update user privacy settings
   */
  async updatePrivacySettings(settings: MessagingUser['privacySettings']): Promise<void> {
    try {
      await apiClient.put('/users/me/privacy-settings', settings);
    } catch (error) {
      throw new Error(`Failed to update privacy settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Block or unblock a user
   */
  async setUserBlocked(userId: string, blocked: boolean): Promise<void> {
    try {
      if (blocked) {
        await apiClient.post('/users/block', { userId });
      } else {
        await apiClient.delete(`/users/block/${userId}`);
      }
    } catch (error) {
      throw new Error(`Failed to ${blocked ? 'block' : 'unblock'} user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Archive or unarchive a conversation
   */
  async setConversationArchived(conversationId: string, archived: boolean): Promise<void> {
    try {
      if (archived) {
        await apiClient.post(`/conversations/${conversationId}/archive`);
      } else {
        await apiClient.delete(`/conversations/${conversationId}/archive`);
      }
    } catch (error) {
      throw new Error(`Failed to ${archived ? 'archive' : 'unarchive'} conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(conversationId: string, messageId: string): Promise<void> {
    try {
      await apiClient.delete(`/conversations/${conversationId}/messages/${messageId}`);
    } catch (error) {
      throw new Error(`Failed to delete message: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Connect to real-time events
   */
  connectToRealtimeEvents(onEvent: (event: MessagingEvent) => void): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Reset retry attempts on new connection
    this.retryAttempts = 0;

    try {
      this.eventSource = new EventSource('/api/messaging/events');
      
      this.eventSource.onmessage = (event) => {
        try {
          const messagingEvent: MessagingEvent = JSON.parse(event.data);
          onEvent(messagingEvent);
          // Reset retry attempts on successful message
          this.retryAttempts = 0;
        } catch (error) {
          console.error('Failed to parse messaging event:', error);
        }
      };

      let errorLogged = false;
      this.eventSource.onerror = (error) => {
        // Only log the first error to prevent spam
        if (!errorLogged) {
          console.warn('Messaging event source error (logging once):', error);
          errorLogged = true;
        }
        this.handleReconnect();
      };

      this.eventSource.onopen = () => {
        console.log('[MessagingService] EventSource connection opened');
        // Reset error flag and retry attempts on successful connection
        errorLogged = false;
        this.retryAttempts = 0;
      };
    } catch (error) {
      console.warn('[MessagingService] Failed to create EventSource connection:', error);
      // Don't throw error, just log warning and continue
    }
  }

  /**
   * Disconnect from real-time events
   */
  disconnectFromRealtimeEvents(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
  }

  /**
   * Queue message for offline delivery
   */
  private queueMessage(request: SendMessageRequest): void {
    const queuedMessage: Message = {
      id: `queued-${Date.now()}-${Math.random()}`,
      senderId: 'current-user', // This should be set from auth context
      createdAt: new Date().toISOString(),
      status: 'failed',
      ...request
    };
    
    console.log('Queueing message:', queuedMessage);
    this.messageQueue.push(queuedMessage);
    console.log('Message queue after push:', this.messageQueue);
    // Process queue asynchronously to avoid immediate processing in tests
    setTimeout(() => {
      this.processMessageQueue();
    }, 0);
  }

  /**
   * Process queued messages
   */
  private async processMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0 || this.retryAttempts >= this.maxRetries) {
      return;
    }

    const message = this.messageQueue[0];
    
    try {
      // Try to send directly via API to avoid recursive queueing
      await apiClient.post<Message>('/messages', {
        conversationId: message.conversationId,
        content: message.content,
        mimeType: message.mimeType,
        attachments: message.attachments
      });
      
      // Success - remove from queue and reset retries
      this.messageQueue.shift();
      this.retryAttempts = 0;
      
      // Process next message in queue
      if (this.messageQueue.length > 0) {
        setTimeout(() => this.processMessageQueue(), 100);
      }
    } catch {
      this.retryAttempts++;
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
      setTimeout(() => this.processMessageQueue(), delay);
    }
  }

  /**
   * Handle reconnection to real-time events
   */
  private handleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Limit reconnection attempts to prevent excessive retries
    if (this.retryAttempts >= this.maxRetries) {
      console.warn('[MessagingService] Max reconnection attempts reached, stopping retries');
      return;
    }
    
    this.retryAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
    
    console.log(`[MessagingService] Scheduling reconnection attempt ${this.retryAttempts}/${this.maxRetries} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('[MessagingService] Attempting to reconnect to messaging events...');
      // Reset EventSource connection
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = undefined;
      }
    }, delay);
  }

  /**
   * Get queued messages
   */
  getQueuedMessages(): Message[] {
    console.log('Getting queued messages:', this.messageQueue);
    return [...this.messageQueue];
  }

  /**
   * Clear message queue
   */
  clearMessageQueue(): void {
    this.messageQueue = [];
    this.retryAttempts = 0;
  }
}

// Export singleton instance
export const messagingService = MessagingService.getInstance();

/**
 * Contact a user - helper function
 */
export async function contactUser(userId: string, productId?: string): Promise<Conversation> {
  const service = MessagingService.getInstance()
  return service.createConversation({
    participantIds: [userId],
    type: 'direct',
    metadata: productId ? { productId } : undefined
  })
}
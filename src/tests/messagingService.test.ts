import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessagingService } from '../../src/services/messagingService';
import { apiClient } from '../../src/services/apiClient';
import { Message, Conversation, SendMessageRequest } from '../../src/types/messaging';

// Create a fresh instance for testing
let messagingService: MessagingService;

// Mock apiClient
vi.mock('../../src/services/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('MessagingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Create fresh instance for each test
    messagingService = new MessagingService();
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up any event listeners
    messagingService.disconnectFromRealtimeEvents();
  });

  describe('sendMessage', () => {
    it('should successfully send a message', async () => {
      const mockMessage: Message = {
        id: 'msg-123',
        conversationId: 'conv-123',
        senderId: 'user-123',
        content: 'Hello world',
        createdAt: new Date().toISOString(),
        status: 'sent'
      };

      const request: SendMessageRequest = {
        conversationId: 'conv-123',
        content: 'Hello world'
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockMessage);

      const result = await messagingService.sendMessage(request);

      expect(apiClient.post).toHaveBeenCalledWith('/messages', request);
      expect(result).toEqual(mockMessage);
    });

    it('should handle message send failure and queue message', async () => {
      const request: SendMessageRequest = {
        conversationId: 'conv-123',
        content: 'Hello world'
      };

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      try {
        await messagingService.sendMessage(request);
      } catch (error) {
        // Expected to throw
      }
      
      // Check queue immediately after the error
      const queuedMessages = messagingService.getQueuedMessages();
      expect(queuedMessages).toHaveLength(1);
      expect(queuedMessages[0].content).toBe('Hello world');
    });
  });

  describe('getConversations', () => {
    it('should fetch conversations with pagination', async () => {
      const mockResponse = {
        conversations: [
          {
            id: 'conv-123',
            participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
            unreadCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            type: 'direct'
          }
        ],
        total: 1,
        hasMore: false
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

      const result = await messagingService.getConversations(1, 20);

      expect(apiClient.get).toHaveBeenCalledWith('/conversations?page=1&limit=20');
      expect(result).toEqual(mockResponse);
    });

    it('should handle conversation fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Server error'));

      await expect(messagingService.getConversations()).rejects.toThrow('Failed to fetch conversations: Server error');
    });
  });

  describe('getMessages', () => {
    it('should fetch messages for a conversation', async () => {
      const mockResponse = {
        messages: [
          {
            id: 'msg-123',
            conversationId: 'conv-123',
            senderId: 'user-123',
            content: 'Test message',
            createdAt: new Date().toISOString(),
            status: 'sent'
          }
        ],
        total: 1,
        hasMore: false
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

      const result = await messagingService.getMessages('conv-123', 1, 50);

      expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-123/messages?page=1&limit=50');
      expect(result).toEqual(mockResponse);
    });

    it('should include before parameter when provided', async () => {
      const mockResponse = { messages: [], total: 0, hasMore: false };
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse);

      await messagingService.getMessages('conv-123', 1, 50, 'msg-456');

      expect(apiClient.get).toHaveBeenCalledWith('/conversations/conv-123/messages?page=1&limit=50&before=msg-456');
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const mockConversation: Conversation = {
        id: 'conv-123',
        participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
        unreadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'direct'
      };

      const request = {
        participantIds: ['user-1', 'user-2'],
        type: 'direct' as const
      };

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockConversation);

      const result = await messagingService.createConversation(request);

      expect(apiClient.post).toHaveBeenCalledWith('/conversations', request);
      expect(result).toEqual(mockConversation);
    });
  });

  describe('searchMessages', () => {
    it('should search messages with filters', async () => {
      const mockMessages: Message[] = [
        {
          id: 'msg-123',
          conversationId: 'conv-123',
          senderId: 'user-123',
          content: 'Search result',
          createdAt: new Date().toISOString(),
          status: 'sent'
        }
      ];

      const filters = {
        query: 'search',
        conversationId: 'conv-123'
      };

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockMessages);

      const result = await messagingService.searchMessages(filters);

      expect(apiClient.get).toHaveBeenCalledWith('/messages/search?query=search&conversationId=conv-123');
      expect(result).toEqual(mockMessages);
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);

      await messagingService.markAsRead('conv-123', ['msg-1', 'msg-2']);

      expect(apiClient.post).toHaveBeenCalledWith('/conversations/conv-123/read', {
        messageIds: ['msg-1', 'msg-2']
      });
    });

    it('should handle mark as read failure gracefully', async () => {
      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Server error'));

      // Should not throw
      await expect(messagingService.markAsRead('conv-123', ['msg-1'])).resolves.toBeUndefined();
    });
  });

  describe('message queue management', () => {
    it('should queue messages when offline', async () => {
      const request: SendMessageRequest = {
        conversationId: 'conv-123',
        content: 'Queued message'
      };

      vi.mocked(apiClient.post).mockRejectedValueOnce(new Error('Network error'));

      try {
        await messagingService.sendMessage(request);
      } catch (error) {
        // Expected to throw
      }

      // Check queue immediately after the error
      const queuedMessages = messagingService.getQueuedMessages();
      expect(queuedMessages).toHaveLength(1);
      expect(queuedMessages[0].content).toBe('Queued message');
    });

    it('should clear message queue', () => {
      messagingService.clearMessageQueue();
      const queuedMessages = messagingService.getQueuedMessages();
      expect(queuedMessages).toHaveLength(0);
    });
  });

  describe('real-time events', () => {
    let mockEventSource: any;
    let originalEventSource: any;
    let mockEventSourceConstructor: any;

    beforeEach(() => {
      mockEventSource = {
        close: vi.fn(),
        onmessage: null,
        onerror: null
      };
      
      // Store original EventSource
      originalEventSource = global.EventSource;
      
      // Create a spyable constructor
      mockEventSourceConstructor = vi.fn(function(this: any, url: string) {
        this.url = url;
        this.close = mockEventSource.close;
        this.onmessage = null;
        this.onerror = null;
      });
      
      global.EventSource = mockEventSourceConstructor as any;
    });

    afterEach(() => {
      // Restore original EventSource
      global.EventSource = originalEventSource;
    });

    it('should connect to real-time events', () => {
      const onEvent = vi.fn();
      messagingService.connectToRealtimeEvents(onEvent);

      expect(mockEventSourceConstructor).toHaveBeenCalledWith('/api/messaging/events');
    });

    it('should disconnect from real-time events', () => {
      messagingService.connectToRealtimeEvents(vi.fn());
      messagingService.disconnectFromRealtimeEvents();

      expect(mockEventSource.close).toHaveBeenCalled();
    });
  });

  describe('user management', () => {
    it('should get user messaging profile', async () => {
      const mockUser = {
        id: 'user-123',
        fullName: 'John Doe',
        isOnline: true,
        blockedUsers: [],
        privacySettings: {
          allowMessagesFrom: 'all' as const,
          readReceipts: true,
          typingIndicators: true
        }
      };

      // Clear any previous mocks and set up new one
      vi.mocked(apiClient.get).mockClear();
      vi.mocked(apiClient.get).mockResolvedValueOnce(mockUser);

      const result = await messagingService.getUserProfile('user-123');

      expect(apiClient.get).toHaveBeenCalledWith('/users/user-123/messaging-profile');
      expect(result).toEqual(mockUser);
    });

    it('should update privacy settings', async () => {
      const settings = {
        allowMessagesFrom: 'contacts' as const,
        readReceipts: false,
        typingIndicators: false
      };

      vi.mocked(apiClient.put).mockResolvedValueOnce(undefined);

      await messagingService.updatePrivacySettings(settings);

      expect(apiClient.put).toHaveBeenCalledWith('/users/me/privacy-settings', settings);
    });

    it('should block a user', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);

      await messagingService.setUserBlocked('user-456', true);

      expect(apiClient.post).toHaveBeenCalledWith('/users/block', { userId: 'user-456' });
    });

    it('should unblock a user', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await messagingService.setUserBlocked('user-456', false);

      expect(apiClient.delete).toHaveBeenCalledWith('/users/block/user-456');
    });
  });

  describe('conversation management', () => {
    it('should archive a conversation', async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce(undefined);

      await messagingService.setConversationArchived('conv-123', true);

      expect(apiClient.post).toHaveBeenCalledWith('/conversations/conv-123/archive');
    });

    it('should unarchive a conversation', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await messagingService.setConversationArchived('conv-123', false);

      expect(apiClient.delete).toHaveBeenCalledWith('/conversations/conv-123/archive');
    });

    it('should delete a message', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce(undefined);

      await messagingService.deleteMessage('conv-123', 'msg-456');

      expect(apiClient.delete).toHaveBeenCalledWith('/conversations/conv-123/messages/msg-456');
    });
  });
});
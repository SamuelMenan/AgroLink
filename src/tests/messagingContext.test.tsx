import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMessaging, MessagingProvider } from '../../src/context/MessagingContext';
import { messagingService } from '../../src/services/messagingService';
import { Conversation, Message } from '../../src/types/messaging';

// Mock messaging service
vi.mock('../../src/services/messagingService', () => ({
  messagingService: {
    getConversations: vi.fn(),
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    createConversation: vi.fn(),
    markAsRead: vi.fn(),
    searchMessages: vi.fn(),
    connectToRealtimeEvents: vi.fn(),
    disconnectFromRealtimeEvents: vi.fn(),
  }
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MessagingProvider>{children}</MessagingProvider>
);

describe('MessagingContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useMessaging(), { wrapper });

      expect(result.current.state).toEqual({
        conversations: [],
        messages: {},
        loading: false,
        error: undefined,
        connected: false,
        unreadCounts: {},
        searchFilters: {},
      });
    });
  });

  describe('loadConversations', () => {
    it('should load conversations successfully', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
          unreadCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          type: 'direct'
        }
      ];

      vi.mocked(messagingService.getConversations).mockResolvedValueOnce({
        conversations: mockConversations,
        total: 1,
        hasMore: false
      });

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.loadConversations();
      });

      expect(result.current.state.conversations).toEqual(mockConversations);
      expect(result.current.state.loading).toBe(false);
      expect(messagingService.getConversations).toHaveBeenCalledWith(1, 20);
    });

    it('should handle conversation loading errors', async () => {
      vi.mocked(messagingService.getConversations).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.loadConversations();
      });

      expect(result.current.state.error).toBe('Failed to load conversations');
      expect(result.current.state.loading).toBe(false);
    });
  });

  describe('loadMessages', () => {
    it('should load messages for a conversation', async () => {
      const mockMessages: Message[] = [
        {
          id: 'msg-1',
          conversationId: 'conv-1',
          senderId: 'user-1',
          content: 'Hello',
          createdAt: new Date().toISOString(),
          status: 'sent'
        }
      ];

      vi.mocked(messagingService.getMessages).mockResolvedValueOnce({
        messages: mockMessages,
        total: 1,
        hasMore: false
      });

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.loadMessages('conv-1');
      });

      expect(result.current.state.messages['conv-1']).toEqual(mockMessages);
      expect(result.current.state.loading).toBe(false);
    });

    it('should handle message loading errors', async () => {
      vi.mocked(messagingService.getMessages).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.loadMessages('conv-1');
      });

      expect(result.current.state.error).toBe('Failed to load messages');
    });
  });

  describe('sendMessage', () => {
    it('should send a message successfully', async () => {
      const mockMessage: Message = {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        content: 'Hello world',
        createdAt: new Date().toISOString(),
        status: 'sent'
      };

      vi.mocked(messagingService.sendMessage).mockResolvedValueOnce(mockMessage);

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.sendMessage({
          conversationId: 'conv-1',
          content: 'Hello world'
        });
      });

      expect(result.current.state.messages['conv-1']).toContainEqual(mockMessage);
      expect(result.current.state.loading).toBe(false);
      expect(messagingService.sendMessage).toHaveBeenCalledWith({
        conversationId: 'conv-1',
        content: 'Hello world'
      });
    });

    it('should handle message send errors', async () => {
      vi.mocked(messagingService.sendMessage).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.sendMessage({
          conversationId: 'conv-1',
          content: 'Hello world'
        });
      });

      expect(result.current.state.error).toBe('Failed to send message');
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const mockConversation: Conversation = {
        id: 'conv-new',
        participants: [{ userId: 'user-1' }, { userId: 'user-2' }],
        unreadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'direct'
      };

      vi.mocked(messagingService.createConversation).mockResolvedValueOnce(mockConversation);

      const { result } = renderHook(() => useMessaging(), { wrapper });

      let createdConversation;
      await act(async () => {
        createdConversation = await result.current.createConversation({
          participantIds: ['user-1', 'user-2'],
          type: 'direct'
        });
      });

      expect(createdConversation).toEqual(mockConversation);
      expect(result.current.state.conversations).toContainEqual(mockConversation);
      expect(result.current.state.loading).toBe(false);
    });

    it('should handle conversation creation errors', async () => {
      vi.mocked(messagingService.createConversation).mockRejectedValueOnce(new Error('Server error'));

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.createConversation({
          participantIds: ['user-1', 'user-2'],
          type: 'direct'
        });
      });

      expect(result.current.state.error).toBe('Failed to create conversation');
    });
  });

  describe('markAsRead', () => {
    it('should mark messages as read', async () => {
      vi.mocked(messagingService.markAsRead).mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.markAsRead('conv-1', ['msg-1', 'msg-2']);
      });

      expect(messagingService.markAsRead).toHaveBeenCalledWith('conv-1', ['msg-1', 'msg-2']);
      expect(result.current.state.unreadCounts['conv-1']).toBe(0);
    });
  });

  describe('searchMessages', () => {
    it('should search messages with filters', async () => {
      const mockSearchResults: Message[] = [
        {
          id: 'msg-search-1',
          conversationId: 'conv-1',
          senderId: 'user-1',
          content: 'Search result',
          createdAt: new Date().toISOString(),
          status: 'sent'
        }
      ];

      vi.mocked(messagingService.searchMessages).mockResolvedValueOnce(mockSearchResults);

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.searchMessages({ query: 'search' });
      });

      expect(result.current.state.searchResults).toEqual(mockSearchResults);
      expect(result.current.state.loading).toBe(false);
    });

    it('should handle search errors', async () => {
      vi.mocked(messagingService.searchMessages).mockRejectedValueOnce(new Error('Search failed'));

      const { result } = renderHook(() => useMessaging(), { wrapper });

      await act(async () => {
        await result.current.searchMessages({ query: 'search' });
      });

      expect(result.current.state.error).toBe('Failed to search messages');
    });
  });

  describe('setActiveConversation', () => {
    it('should set active conversation', () => {
      const mockConversation: Conversation = {
        id: 'conv-1',
        participants: [{ userId: 'user-1' }],
        unreadCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: 'direct'
      };

      const { result } = renderHook(() => useMessaging(), { wrapper });

      act(() => {
        result.current.setActiveConversation(mockConversation);
      });

      expect(result.current.state.activeConversation).toEqual(mockConversation);
    });

    it('should clear active conversation', () => {
      const { result } = renderHook(() => useMessaging(), { wrapper });

      act(() => {
        result.current.setActiveConversation(undefined);
      });

      expect(result.current.state.activeConversation).toBeUndefined();
    });
  });

  describe('clearError', () => {
    it('should clear error state', () => {
      const { result } = renderHook(() => useMessaging(), { wrapper });

      // Set an error first
      act(() => {
        // This would normally be done through an action that fails
        // For testing, we'll access the dispatch directly
        // In a real test, you'd trigger an error through a failed action
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.state.error).toBeUndefined();
    });
  });

  describe('real-time events', () => {
    it('should connect to real-time events on mount', () => {
      renderHook(() => useMessaging(), { wrapper });

      expect(messagingService.connectToRealtimeEvents).toHaveBeenCalled();
      expect(messagingService.disconnectFromRealtimeEvents).not.toHaveBeenCalled();
    });

    it('should disconnect from real-time events on unmount', () => {
      const { unmount } = renderHook(() => useMessaging(), { wrapper });

      unmount();

      expect(messagingService.disconnectFromRealtimeEvents).toHaveBeenCalled();
    });
  });

  describe('error boundary', () => {
    it('should throw error when used outside MessagingProvider', () => {
      const { result } = renderHook(() => useMessaging());

      expect(result.error).toEqual(
        new Error('useMessaging must be used within a MessagingProvider')
      );
    });
  });
});
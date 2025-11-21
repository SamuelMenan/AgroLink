import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { messagingService } from '../services/messagingService';
import type { 
  Conversation, 
  Message, 
  MessagingEvent, 
  MessagingState,
  SendMessageRequest,
  CreateConversationRequest,
  MessageSearchFilters
} from '../types/messaging';

interface MessagingContextType {
  state: MessagingState;
  sendMessage: (request: SendMessageRequest) => Promise<void>;
  createConversation: (request: CreateConversationRequest) => Promise<Conversation>;
  loadConversations: (page?: number) => Promise<void>;
  loadMessages: (conversationId: string, page?: number) => Promise<void>;
  markAsRead: (conversationId: string, messageIds: string[]) => Promise<void>;
  searchMessages: (filters: MessageSearchFilters) => Promise<void>;
  setActiveConversation: (conversation: Conversation | undefined) => void;
  archiveConversation: (conversationId: string, archived: boolean) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;
  clearError: () => void;
}

const MessagingContext = createContext<MessagingContextType | undefined>(undefined);

type MessagingAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_CONVERSATIONS'; payload: Conversation[] }
  | { type: 'ADD_CONVERSATION'; payload: Conversation }
  | { type: 'UPDATE_CONVERSATION'; payload: Conversation }
  | { type: 'SET_ACTIVE_CONVERSATION'; payload: Conversation | undefined }
  | { type: 'SET_MESSAGES'; payload: { conversationId: string; messages: Message[] } }
  | { type: 'ADD_MESSAGE'; payload: { conversationId: string; message: Message } }
  | { type: 'UPDATE_MESSAGE'; payload: { conversationId: string; message: Message } }
  | { type: 'DELETE_MESSAGE'; payload: { conversationId: string; messageId: string } }
  | { type: 'SET_SEARCH_RESULTS'; payload: Message[] }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_UNREAD_COUNT'; payload: { conversationId: string; count: number } }
  | { type: 'RESET_STATE' };

const initialState: MessagingState = {
  conversations: [],
  messages: {},
  loading: false,
  error: undefined,
  connected: false,
  unreadCounts: {},
  searchFilters: {},
  currentUserId: 'current-user', // This should be set from auth context in real app
};

export function messagingReducer(state: MessagingState, action: MessagingAction): MessagingState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'CLEAR_ERROR':
      return { ...state, error: undefined };
    
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload, loading: false };
    
    case 'ADD_CONVERSATION':
      return { 
        ...state, 
        conversations: [action.payload, ...state.conversations],
        loading: false 
      };
    
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === action.payload.id ? action.payload : conv
        ),
        activeConversation: state.activeConversation?.id === action.payload.id 
          ? action.payload 
          : state.activeConversation
      };
    
    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversation: action.payload };
    
    case 'SET_MESSAGES':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.conversationId]: action.payload.messages
        }
      };
    
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.conversationId]: [
            ...(state.messages[action.payload.conversationId] || []),
            action.payload.message
          ]
        },
        loading: false
      };
    
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.conversationId]: 
            state.messages[action.payload.conversationId]?.map(msg =>
              msg.id === action.payload.message.id ? action.payload.message : msg
            ) || []
        }
      };
    
    case 'DELETE_MESSAGE':
      return {
        ...state,
        messages: {
          ...state.messages,
          [action.payload.conversationId]: 
            state.messages[action.payload.conversationId]?.filter(msg =>
              msg.id !== action.payload.messageId
            ) || []
        }
      };
    
    case 'SET_SEARCH_RESULTS':
      return { ...state, searchResults: action.payload };
    
    case 'SET_CONNECTED':
      return { ...state, connected: action.payload };
    
    case 'SET_UNREAD_COUNT':
      return {
        ...state,
        unreadCounts: {
          ...state.unreadCounts,
          [action.payload.conversationId]: action.payload.count
        }
      };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
}

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(messagingReducer, initialState);

  // Handle real-time events
  const handleMessagingEvent = useCallback((event: MessagingEvent) => {
    switch (event.type) {
      case 'message_sent':
        dispatch({ 
          type: 'ADD_MESSAGE', 
          payload: { 
            conversationId: event.data.conversationId, 
            message: event.data.message 
          } 
        });
        break;
      
      case 'message_delivered':
      case 'message_read':
        dispatch({ 
          type: 'UPDATE_MESSAGE', 
          payload: { 
            conversationId: event.data.conversationId, 
            message: event.data.message 
          } 
        });
        break;
      
      case 'conversation_created':
        dispatch({ type: 'ADD_CONVERSATION', payload: event.data.conversation });
        break;
      
      case 'user_typing':
        // Handle typing indicators
        break;
      
      case 'user_online':
        dispatch({ type: 'SET_CONNECTED', payload: true });
        break;
    }
  }, []);

  // Connect to real-time events on mount
  useEffect(() => {
    messagingService.connectToRealtimeEvents(handleMessagingEvent);
    dispatch({ type: 'SET_CONNECTED', payload: true });
    
    return () => {
      messagingService.disconnectFromRealtimeEvents();
    };
  }, [handleMessagingEvent]);

  const sendMessage = async (request: SendMessageRequest) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const message = await messagingService.sendMessage(request);
      dispatch({ 
        type: 'ADD_MESSAGE', 
        payload: { conversationId: request.conversationId, message } 
      });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to send message' 
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createConversation = async (request: CreateConversationRequest) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const conversation = await messagingService.createConversation(request);
      dispatch({ type: 'ADD_CONVERSATION', payload: conversation });
      return conversation;
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to create conversation' 
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const loadConversations = async (page = 1) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await messagingService.getConversations(page);
      dispatch({ type: 'SET_CONVERSATIONS', payload: response.conversations });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to load conversations' 
      });
    }
  };

  const loadMessages = async (conversationId: string, page = 1) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await messagingService.getMessages(conversationId, page);
      dispatch({ 
        type: 'SET_MESSAGES', 
        payload: { conversationId, messages: response.messages } 
      });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to load messages' 
      });
    }
  };

  const markAsRead = async (conversationId: string, messageIds: string[]) => {
    try {
      await messagingService.markAsRead(conversationId, messageIds);
      dispatch({ type: 'SET_UNREAD_COUNT', payload: { conversationId, count: 0 } });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const searchMessages = async (filters: MessageSearchFilters) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const results = await messagingService.searchMessages(filters);
      dispatch({ type: 'SET_SEARCH_RESULTS', payload: results });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to search messages' 
      });
    }
  };

  const setActiveConversation = (conversation: Conversation | undefined) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conversation });
  };

  const archiveConversation = async (conversationId: string, archived: boolean) => {
    try {
      await messagingService.setConversationArchived(conversationId, archived);
      // Update conversation in state
      const conversation = state.conversations.find(c => c.id === conversationId);
      if (conversation) {
        dispatch({ 
          type: 'UPDATE_CONVERSATION', 
          payload: { ...conversation, archivedBy: archived ? ['current-user'] : undefined } 
        });
      }
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to archive conversation' 
      });
    }
  };

  const deleteMessage = async (conversationId: string, messageId: string) => {
    try {
      await messagingService.deleteMessage(conversationId, messageId);
      dispatch({ type: 'DELETE_MESSAGE', payload: { conversationId, messageId } });
    } catch (error) {
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to delete message' 
      });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: MessagingContextType = {
    state,
    sendMessage,
    createConversation,
    loadConversations,
    loadMessages,
    markAsRead,
    searchMessages,
    setActiveConversation,
    archiveConversation,
    deleteMessage,
    clearError,
  };

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessaging() {
  const context = useContext(MessagingContext);
  if (context === undefined) {
    throw new Error('useMessaging must be used within a MessagingProvider');
  }
  return context;
}

export type { MessagingState, MessagingAction };
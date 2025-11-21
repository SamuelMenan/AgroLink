import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMessaging } from '../../context/MessagingContext';
import type { Conversation } from '../../types/messaging';
import { Send, Search, Archive, UserPlus, ChevronLeft, MoreVertical } from 'lucide-react';

export default function Messaging() {
  const [searchParams] = useSearchParams();
  
  console.log('[Messaging] Component rendering, searchParams:', searchParams.toString());
  
  const { 
    state, 
    sendMessage, 
    loadConversations, 
    loadMessages, 
    setActiveConversation,
    markAsRead 
  } = useMessaging();

  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations on mount and handle URL parameter
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await loadConversations();
        
        // Check if we need to open a specific conversation from URL
        const userId = searchParams.get('with');
        if (userId && state.conversations.length > 0) {
          const conversation = state.conversations.find(conv => 
            conv.participants.some(p => p.userId === userId)
          );
          if (conversation) {
            setActiveConversation(conversation);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
        console.error('Error loading conversations:', err);
      }
    };
    
    loadInitialData();
  }, [loadConversations, searchParams, state.conversations, setActiveConversation]);

  // Load messages when conversation is selected
  useEffect(() => {
    if (state.activeConversation) {
      loadMessages(state.activeConversation.id);
      // Mark messages as read
      const unreadMessages = state.messages[state.activeConversation.id]?.filter(
        msg => !msg.readAt && msg.senderId !== state.currentUserId
      ) || [];
      
      if (unreadMessages.length > 0) {
        markAsRead(
          state.activeConversation.id, 
          unreadMessages.map(msg => msg.id)
        );
      }
    }
  }, [state.activeConversation, loadMessages, markAsRead, state.currentUserId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (state.activeConversation && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.messages, state.activeConversation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !state.activeConversation) return;

    try {
      await sendMessage({
        conversationId: state.activeConversation.id,
        content: newMessage.trim()
      });
      setNewMessage('');
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      // Clear error after 5 seconds
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    setActiveConversation(conversation);
  };

  const handleBackToConversations = () => {
    setActiveConversation(undefined);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else if (diffInHours < 48) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-CO', { 
        day: 'numeric', 
        month: 'short' 
      });
    }
  };

  const filteredConversations = state.conversations.filter(conversation =>
    searchQuery === '' || 
    conversation.participants.some(p => 
      p.userId.toLowerCase().includes(searchQuery.toLowerCase())
    ) ||
    conversation.lastMessage?.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 mb-2">Error al cargar mensajes</div>
          <div className="text-sm text-gray-600 mb-4">{error}</div>
          <button 
            onClick={() => {
              setError(null);
              loadConversations();
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (state.loading && state.conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50">
      {/* Conversations List */}
      <div className={`w-full md:w-80 bg-white border-r border-gray-200 flex flex-col ${
        state.activeConversation ? 'hidden md:flex' : 'flex'
      }`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-semibold text-gray-900">Mensajes</h1>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-600">{error}</div>
            </div>
          )}
          
          {showSearch && (
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar conversaciones..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          )}
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {searchQuery ? 'No se encontraron conversaciones' : 'No hay conversaciones'}
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => handleConversationSelect(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                  state.activeConversation?.id === conversation.id ? 'bg-green-50 border-green-200' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-medium">
                        {conversation.participants.length > 2 ? 'G' : 
                         conversation.participants[0]?.userId.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {conversation.participants.length > 2 
                          ? 'Grupo' 
                          : conversation.participants[0]?.userId || 'Usuario'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {conversation.lastMessage && formatTime(conversation.lastMessage.createdAt)}
                      </p>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {conversation.lastMessage?.content || 'Sin mensajes'}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                        {conversation.unreadCount} nuevo{conversation.unreadCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* New Conversation Button */}
        <div className="p-4 border-t border-gray-200">
          <button className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            <UserPlus className="h-4 w-4 mr-2" />
            Nueva conversación
          </button>
        </div>
      </div>

      {/* Message Thread */}
      <div className={`flex-1 flex flex-col ${
        state.activeConversation ? 'flex' : 'hidden md:flex'
      }`}>
        {state.activeConversation ? (
          <>
            {/* Thread Header */}
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBackToConversations}
                  className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-medium text-sm">
                    {state.activeConversation.participants.length > 2 ? 'G' : 
                     state.activeConversation.participants[0]?.userId.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {state.activeConversation.participants.length > 2 
                      ? 'Grupo' 
                      : state.activeConversation.participants[0]?.userId || 'Usuario'}
                  </h2>
                  <p className="text-sm text-gray-500">En línea</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <Archive className="h-5 w-5" />
                </button>
                <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                  <MoreVertical className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {state.messages[state.activeConversation.id]?.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.senderId === state.currentUserId ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.senderId === state.currentUserId
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.senderId === state.currentUserId ? 'text-green-100' : 'text-gray-500'
                    }`}>
                      {formatTime(message.createdAt)}
                      {message.senderId === state.currentUserId && (
                        <span className="ml-1">
                          {message.status === 'sending' && '⏳'}
                          {message.status === 'sent' && '✓'}
                          {message.status === 'delivered' && '✓✓'}
                          {message.status === 'read' && '✓✓'}
                          {message.status === 'failed' && '❌'}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    ref={messageInputRef}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={1}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newMessage.trim() || state.loading}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserPlus className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Selecciona una conversación</h3>
              <p className="text-gray-500">Elige una conversación de la lista o comienza una nueva.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
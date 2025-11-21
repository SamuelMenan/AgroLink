import React, { useState, useRef, useEffect } from 'react';
import type { Message } from '../../types/messaging';
import { Send, Paperclip, Smile, Reply, Trash2, Edit3 } from 'lucide-react';

interface MessageThreadProps {
  conversationId: string;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onEditMessage: (messageId: string, newContent: string) => Promise<void>;
  onReplyMessage: (messageId: string) => void;
  loading?: boolean;
  error?: string;
}

export default function MessageThread({
  conversationId,
  messages,
  currentUserId,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onReplyMessage,
  loading,
  error
}: MessageThreadProps) {
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when conversation changes
  useEffect(() => {
    messageInputRef.current?.focus();
    setNewMessage('');
    setEditingMessage(null);
    setReplyingTo(null);
  }, [conversationId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await onSendMessage(newMessage.trim());
      setNewMessage('');
      setReplyingTo(null);
      messageInputRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return;

    try {
      await onEditMessage(messageId, editContent.trim());
      setEditingMessage(null);
      setEditContent('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
      try {
        await onDeleteMessage(messageId);
      } catch (error) {
        console.error('Failed to delete message:', error);
      }
    }
  };

  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return 'Ahora';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)} min`;
    } else {
      return date.toLocaleTimeString('es-CO', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const getMessageStatus = (message: Message): string => {
    if (message.status === 'failed') return 'Error';
    if (message.status === 'read') return 'Leído';
    if (message.status === 'delivered') return 'Entregado';
    return 'Enviado';
  };

  const insertEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  const commonEmojis = ['😀', '😂', '😍', '🤔', '👍', '👎', '❤️', '🎉', '😢', '😡'];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Comienza la conversación</h3>
              <p>Envía un mensaje para iniciar el chat.</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.senderId === currentUserId ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`max-w-xs lg:max-w-md group ${
                message.senderId === currentUserId ? 'ml-auto' : 'mr-auto'
              }`}>
                <div
                  className={`px-4 py-2 rounded-lg relative ${
                    message.senderId === currentUserId
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  } ${
                    message.status === 'failed' ? 'border-2 border-red-300' : ''
                  }`}
                >
                  {/* Reply indicator */}
                  {message.attachments?.some(att => att.type === 'reply') && (
                    <div className={`text-xs mb-2 p-2 rounded border-l-2 ${
                      message.senderId === currentUserId
                        ? 'bg-green-500 border-green-300 text-green-100'
                        : 'bg-gray-50 border-gray-300 text-gray-600'
                    }`}>
                      <p className="font-medium">En respuesta a:</p>
                      <p className="truncate">
                        {message.attachments?.find(att => att.type === 'reply')?.metadata?.originalContent}
                      </p>
                    </div>
                  )}

                  {/* Message content */}
                  {editingMessage === message.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-2 text-sm rounded border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                        rows={2}
                        autoFocus
                      />
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => {
                            setEditingMessage(null);
                            setEditContent('');
                          }}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleEditMessage(message.id)}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}

                  {/* Message actions (only for current user's messages) */}
                  {message.senderId === currentUserId && editingMessage !== message.id && (
                    <div className={`absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      message.senderId === currentUserId ? 'right-1' : 'left-1'
                    }`}>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => {
                            setEditingMessage(message.id);
                            setEditContent(message.content);
                          }}
                          className="p-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30"
                          title="Editar"
                        >
                          <Edit3 className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => setReplyingTo(message.id)}
                          className="p-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30"
                          title="Responder"
                        >
                          <Reply className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(message.id)}
                          className="p-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Message time and status */}
                  <div className={`flex items-center justify-between mt-1 text-xs ${
                    message.senderId === currentUserId ? 'text-green-100' : 'text-gray-500'
                  }`}>
                    <span>{formatMessageTime(message.createdAt)}</span>
                    {message.senderId === currentUserId && (
                      <span className="ml-2">{getMessageStatus(message)}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="p-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}

      {/* Reply indicator */}
      {replyingTo && (
        <div className="p-3 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Reply className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Respondiendo a mensaje
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="flex items-end space-x-3">
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Emojis"
            >
              <Smile className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Adjuntar archivo"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 relative">
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
            
            {/* Emoji picker */}
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                <div className="grid grid-cols-5 gap-1">
                  {commonEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="p-2 text-lg hover:bg-gray-100 rounded"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!newMessage.trim() || loading}
            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
import React, { useState, useMemo } from 'react';
import { Conversation, ConversationParticipant } from '../../types/messaging';
import { Search, UserPlus, Archive, MoreVertical, Circle } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  activeConversation?: Conversation;
  onConversationSelect: (conversation: Conversation) => void;
  onNewConversation: () => void;
  onArchiveConversation: (conversationId: string) => void;
  currentUserId: string;
}

export default function ConversationList({
  conversations,
  activeConversation,
  onConversationSelect,
  onNewConversation,
  onArchiveConversation,
  currentUserId
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    // Filter by archived status
    if (!showArchived) {
      filtered = filtered.filter(conv => !conv.archivedBy?.includes(currentUserId));
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => {
        // Search in participant names
        const participantMatch = conv.participants.some(p => 
          p.userId.toLowerCase().includes(query)
        );
        
        // Search in last message content
        const messageMatch = conv.lastMessage?.content.toLowerCase().includes(query);
        
        return participantMatch || messageMatch;
      });
    }

    // Sort by most recent activity
    return filtered.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.updatedAt;
      const bTime = b.lastMessage?.createdAt || b.updatedAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }, [conversations, searchQuery, showArchived, currentUserId]);

  const getConversationTitle = (conversation: Conversation): string => {
    if (conversation.participants.length === 2) {
      const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId);
      return otherParticipant?.userId || 'Usuario';
    } else if (conversation.participants.length > 2) {
      return `Grupo (${conversation.participants.length} participantes)`;
    }
    return 'Sin título';
  };

  const getConversationSubtitle = (conversation: Conversation): string => {
    if (conversation.lastMessage) {
      const isCurrentUser = conversation.lastMessage.senderId === currentUserId;
      const prefix = isCurrentUser ? 'Tú: ' : '';
      const content = conversation.lastMessage.content;
      return `${prefix}${content.length > 30 ? content.substring(0, 30) + '...' : content}`;
    }
    return 'Sin mensajes';
  };

  const formatLastActivity = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
    const diffInHours = diffInMinutes / 60;
    const diffInDays = diffInHours / 24;

    if (diffInMinutes < 1) {
      return 'Ahora';
    } else if (diffInHours < 1) {
      return `${Math.floor(diffInMinutes)} min`;
    } else if (diffInDays < 1) {
      return `${Math.floor(diffInHours)} h`;
    } else if (diffInDays < 7) {
      return date.toLocaleDateString('es-CO', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    }
  };

  const handleArchiveClick = (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation();
    onArchiveConversation(conversationId);
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Mensajes</h1>
          <div className="flex items-center space-x-2">
            <button
              onClick={onNewConversation}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Nueva conversación"
            >
              <UserPlus className="h-5 w-5" />
            </button>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`p-2 rounded-lg ${
                showArchived 
                  ? 'text-green-600 bg-green-50' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
              title={showArchived ? 'Ocultar archivados' : 'Mostrar archivados'}
            >
              <Archive className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        {/* Search */}
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
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery ? 'No se encontraron conversaciones' : 
             showArchived ? 'No hay conversaciones archivadas' : 
             'No hay conversaciones'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onConversationSelect(conversation)}
                className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                  activeConversation?.id === conversation.id 
                    ? 'bg-green-50 border-r-2 border-green-500' 
                    : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <span className="text-green-600 font-medium text-sm">
                        {conversation.participants.length > 2 ? 'G' : 
                         getConversationTitle(conversation).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 truncate">
                          {getConversationTitle(conversation)}
                        </h3>
                        {conversation.unreadCount > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500">
                          {formatLastActivity(conversation.updatedAt)}
                        </span>
                        <button
                          onClick={(e) => handleArchiveClick(e, conversation.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 truncate mt-1">
                      {getConversationSubtitle(conversation)}
                    </p>

                    {/* Status indicators */}
                    <div className="flex items-center space-x-2 mt-2">
                      {conversation.participants.some(p => p.userId !== 'current-user' && p.lastReadAt) && (
                        <Circle className="h-2 w-2 text-green-500 fill-current" />
                      )}
                      {conversation.archivedBy?.includes('current-user') && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-gray-500 bg-gray-100">
                          Archivado
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{filteredConversations.length} conversación{filteredConversations.length !== 1 ? 'es' : ''}</span>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-green-600 hover:text-green-700"
            >
              Limpiar búsqueda
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
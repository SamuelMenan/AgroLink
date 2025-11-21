import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import type { CreateConversationRequest } from '../../types/messaging';

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateConversation: (request: CreateConversationRequest) => Promise<void>;
  existingContacts?: string[];
}

// Mock contacts - in a real app, this would come from an API
const mockContacts = [
  { id: 'user1', name: 'Juan Pérez', avatar: '', isOnline: true },
  { id: 'user2', name: 'María García', avatar: '', isOnline: false },
  { id: 'user3', name: 'Carlos Rodríguez', avatar: '', isOnline: true },
  { id: 'user4', name: 'Ana Martínez', avatar: '', isOnline: false },
  { id: 'user5', name: 'Pedro Sánchez', avatar: '', isOnline: true },
];

export default function NewConversationModal({
  isOpen,
  onClose,
  onCreateConversation,
  existingContacts = []
}: NewConversationModalProps) {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationType, setConversationType] = useState<'direct' | 'group'>('direct');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedUsers([]);
      setSearchQuery('');
      setConversationType('direct');
      setGroupName('');
      setError('');
    }
  }, [isOpen]);

  const filteredContacts = mockContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !existingContacts.includes(contact.id)
  );

  const handleUserToggle = (userId: string) => {
    if (conversationType === 'direct') {
      setSelectedUsers([userId]);
    } else {
      setSelectedUsers(prev =>
        prev.includes(userId)
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) {
      setError('Por favor selecciona al menos un usuario');
      return;
    }

    if (conversationType === 'group' && !groupName.trim()) {
      setError('Por favor ingresa un nombre para el grupo');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const request: CreateConversationRequest = {
        participantIds: selectedUsers,
        type: conversationType,
        metadata: conversationType === 'group' ? { name: groupName.trim() } : undefined
      };

      await onCreateConversation(request);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error al crear conversación');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Nueva conversación
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Conversation Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de conversación
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="direct"
                  checked={conversationType === 'direct'}
                  onChange={(e) => {
                    setConversationType(e.target.value as 'direct');
                    setSelectedUsers([]);
                  }}
                  className="mr-2"
                />
                <span className="text-sm">Conversación directa</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="group"
                  checked={conversationType === 'group'}
                  onChange={(e) => {
                    setConversationType(e.target.value as 'group');
                    setSelectedUsers([]);
                  }}
                  className="mr-2"
                />
                <span className="text-sm">Grupo</span>
              </label>
            </div>
          </div>

          {/* Group Name (only for group conversations) */}
          {conversationType === 'group' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre del grupo
              </label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Ingresa un nombre para el grupo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {conversationType === 'direct' ? 'Selecciona un usuario' : 'Selecciona usuarios'}
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar usuarios..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Usuarios seleccionados ({selectedUsers.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(userId => {
                  const user = mockContacts.find(c => c.id === userId);
                  return (
                    <span
                      key={userId}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                    >
                      {user?.name || userId}
                      <button
                        onClick={() => handleUserToggle(userId)}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="space-y-2">
            {filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleUserToggle(contact.id)}
                className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedUsers.includes(contact.id)
                    ? 'bg-green-50 border border-green-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center relative">
                    <span className="text-gray-600 font-medium text-sm">
                      {contact.name.charAt(0).toUpperCase()}
                    </span>
                    {contact.isOnline && (
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {contact.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {contact.isOnline ? 'En línea' : 'Desconectado'}
                  </p>
                </div>
                {conversationType === 'group' && (
                  <div className="flex-shrink-0">
                    <div className={`w-4 h-4 rounded border-2 ${
                      selectedUsers.includes(contact.id)
                        ? 'bg-green-600 border-green-600'
                        : 'border-gray-300'
                    }`}>
                      {selectedUsers.includes(contact.id) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredContacts.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              No se encontraron usuarios
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
              {error}
            </div>
          )}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              onClick={handleCreateConversation}
              disabled={selectedUsers.length === 0 || loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Creando...' : 'Crear conversación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
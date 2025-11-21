import React, { useState, useRef } from 'react';
import { Search, Filter, Calendar, User, X } from 'lucide-react';
import type { MessageSearchFilters } from '../../types/messaging';

interface MessageSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (filters: MessageSearchFilters) => void;
  conversationId?: string;
  loading?: boolean;
}

export default function MessageSearch({
  isOpen,
  onClose,
  onSearch,
  conversationId,
  loading
}: MessageSearchProps) {
  const [filters, setFilters] = useState<MessageSearchFilters>({
    query: '',
    conversationId,
    senderId: '',
    dateFrom: '',
    dateTo: '',
    hasAttachments: undefined
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters({
      query: '',
      conversationId,
      senderId: '',
      dateFrom: '',
      dateTo: '',
      hasAttachments: undefined
    });
  };

  const handleFilterChange = (key: keyof MessageSearchFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Buscar mensajes
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          {/* Basic Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar texto
            </label>
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar en mensajes..."
                value={filters.query}
                onChange={(e) => handleFilterChange('query', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-800 mb-4"
          >
            <Filter className="h-4 w-4" />
            <span>{showAdvanced ? 'Ocultar' : 'Mostrar'} filtros avanzados</span>
          </button>

          {/* Advanced Filters */}
          {showAdvanced && (
            <div className="space-y-4 mb-4 p-4 bg-gray-50 rounded-lg">
              {/* Sender */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <User className="inline h-4 w-4 mr-1" />
                  Enviado por
                </label>
                <input
                  type="text"
                  placeholder="ID del usuario"
                  value={filters.senderId}
                  onChange={(e) => handleFilterChange('senderId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Desde
                  </label>
                  <input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hasta
                  </label>
                  <input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Has Attachments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Con archivos adjuntos
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="hasAttachments"
                      checked={filters.hasAttachments === undefined}
                      onChange={() => handleFilterChange('hasAttachments', undefined)}
                      className="mr-2"
                    />
                    <span className="text-sm">No importa</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="hasAttachments"
                      checked={filters.hasAttachments === true}
                      onChange={() => handleFilterChange('hasAttachments', true)}
                      className="mr-2"
                    />
                    <span className="text-sm">Sí</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="hasAttachments"
                      checked={filters.hasAttachments === false}
                      onChange={() => handleFilterChange('hasAttachments', false)}
                      className="mr-2"
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Limpiar
            </button>
            <button
              type="submit"
              form="message-search-form"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
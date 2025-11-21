import { useState, useEffect, useCallback, useMemo } from 'react'
import { ValidatedInput } from '../hooks/useValidation.tsx'
import { VALIDATION_RULES } from '../utils/inputValidation'
import { getSearchSuggestions, type SearchSuggestion, SearchHistoryManager } from '../utils/searchHistory'
import { PRODUCT_CATEGORIES } from '../types/product'
import { Search, Filter, X, Clock, TrendingUp } from 'lucide-react'

export interface EnhancedSearchFilters {
  q: string
  category: string
  locationText: string
  distanceKm: string
  minPrice: string
  maxPrice: string
  certifications: string[]
  season: string
  sort: 'relevance' | 'price-asc' | 'price-desc' | 'distance'
}

interface EnhancedSearchProps {
  filters: EnhancedSearchFilters
  onFiltersChange: (filters: EnhancedSearchFilters) => void
  onSearch: (filters: EnhancedSearchFilters) => void
  showAdvancedFilters?: boolean
}

const CERTIFICATION_OPTIONS = [
  { value: 'organico', label: 'Orgánico', icon: 'eco' },
  { value: 'fair-trade', label: 'Comercio Justo', icon: 'handshake' },
  { value: 'sin-pesticidas', label: 'Sin Pesticidas', icon: 'block' },
  { value: 'certificado', label: 'Certificado', icon: 'verified' }
]

const SEASON_OPTIONS = [
  { value: '', label: 'Todas las temporadas' },
  { value: 'invierno', label: 'Invierno' },
  { value: 'verano', label: 'Verano' },
  { value: 'lluvias', label: 'Temporada de lluvias' },
  { value: 'seca', label: 'Temporada seca' }
]

export function EnhancedSearch({ filters, onFiltersChange, onSearch, showAdvancedFilters = true }: EnhancedSearchProps) {
  const [showFilters, setShowFilters] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  // Load search history on mount
  useEffect(() => {
    const history = SearchHistoryManager.getHistory()
    setSearchHistory(history.slice(0, 5).map(h => h.query))
  }, [])

  // Update suggestions when query changes
  const updateSuggestions = useCallback((query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    const newSuggestions = getSearchSuggestions(query, filters.category)
    setSuggestions(newSuggestions)
  }, [filters.category])

  // Debounced suggestion update
  useEffect(() => {
    const timer = setTimeout(() => {
      updateSuggestions(filters.q)
    }, 300)

    return () => clearTimeout(timer)
  }, [filters.q, updateSuggestions])

  const handleInputChange = (field: keyof EnhancedSearchFilters, value: string | string[]) => {
    // Remove leading spaces only from search query
    const processedValue = field === 'q' && typeof value === 'string' ? value.trimStart() : value
    const newFilters = { ...filters, [field]: processedValue }
    onFiltersChange(newFilters)
  }

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const newFilters = { ...filters, q: suggestion.text }
    onFiltersChange(newFilters)
    setShowSuggestions(false)
    onSearch(newFilters)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Save to search history
    if (filters.q.trim()) {
      SearchHistoryManager.addToHistory({
        query: filters.q.trim(),
        category: filters.category || undefined,
        filters: {
          category: filters.category,
          location: filters.locationText,
          season: filters.season
        }
      })
    }
    
    setShowSuggestions(false)
    onSearch(filters)
  }

  const clearFilters = () => {
    const clearedFilters: EnhancedSearchFilters = {
      q: '',
      category: '',
      locationText: '',
      distanceKm: '',
      minPrice: '',
      maxPrice: '',
      certifications: [],
      season: '',
      sort: 'relevance'
    }
    onFiltersChange(clearedFilters)
  }

  const hasActiveFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'sort') return value !== 'relevance'
      if (key === 'certifications') return Array.isArray(value) && value.length > 0
      return value !== ''
    })
  }, [filters])

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="space-y-4">
        {/* Main search bar */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <ValidatedInput
              value={filters.q}
              onChange={(value) => handleInputChange('q', value)}
              rule={VALIDATION_RULES.searchQuery}
              placeholder="Buscar productos agrícolas..."
              className="w-full rounded-lg border border-gray-300/90 bg-white/80 pl-10 pr-12 py-3 text-base outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
              showIcon={false}
              delay={200}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              Buscar
            </button>
          </div>

          {/* Search suggestions */}
          {showSuggestions && (suggestions.length > 0 || searchHistory.length > 0) && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {suggestions.length > 0 && (
                <div className="border-b border-gray-100">
                  <div className="px-3 py-2 text-xs font-medium text-gray-500">
                    Sugerencias
                  </div>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="flex w-full items-center px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      {suggestion.type === 'history' && <Clock className="mr-2 h-4 w-4 text-gray-400" />}
                      {suggestion.type === 'popular' && <TrendingUp className="mr-2 h-4 w-4 text-green-500" />}
                      {suggestion.type === 'agricultural' && <Search className="mr-2 h-4 w-4 text-blue-500" />}
                      <span className="flex-1">{suggestion.text}</span>
                      {suggestion.category && (
                        <span className="ml-2 text-xs text-gray-500">({suggestion.category})</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {searchHistory.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500">
                    Historial
                  </div>
                  {searchHistory.map((query, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleSuggestionClick({ text: query, type: 'history', relevance: 1 })}
                      className="flex w-full items-center px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                    >
                      <Clock className="mr-2 h-4 w-4 text-gray-400" />
                      <span className="flex-1">{query}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Basic filters row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={filters.category}
            onChange={(e) => handleInputChange('category', e.target.value)}
            className="rounded-lg border border-gray-300/90 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
          >
            <option value="">Todas las categorías</option>
            {PRODUCT_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <ValidatedInput
            value={filters.locationText}
            onChange={(value) => handleInputChange('locationText', value)}
            rule={VALIDATION_RULES.location}
            placeholder="Ubicación (ciudad/municipio)"
            className="rounded-lg border border-gray-300/90 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            showIcon={true}
            delay={300}
          />

          <ValidatedInput
            value={filters.distanceKm}
            onChange={(value) => handleInputChange('distanceKm', value)}
            rule={VALIDATION_RULES.quantity}
            placeholder="Distancia (km)"
            className="rounded-lg border border-gray-300/90 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            type="number"
            showIcon={true}
          />

          <div className="flex gap-2">
            <select
              value={filters.sort}
              onChange={(e) => handleInputChange('sort', e.target.value)}
              className="w-full rounded-lg border border-gray-300/90 px-3 py-2 outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
            >
              <option value="relevance">Relevancia</option>
              <option value="price-asc">Precio: menor a mayor</option>
              <option value="price-desc">Precio: mayor a menor</option>
              <option value="distance">Distancia</option>
            </select>
            
            {showAdvancedFilters && (
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  hasActiveFilters 
                    ? 'border-green-500 bg-green-50 text-green-700' 
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Filter className="h-4 w-4" />
                Filtros
                {hasActiveFilters && (
                  <span className="rounded-full bg-green-600 px-2 py-0.5 text-xs text-white">
                    Activo
                  </span>
                )}
              </button>
            )}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                title="Limpiar todos los filtros"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Advanced filters */}
        {showAdvancedFilters && showFilters && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Price range */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Rango de precio</label>
                <div className="flex gap-2">
                  <ValidatedInput
                    value={filters.minPrice}
                    onChange={(value) => handleInputChange('minPrice', value)}
                    rule={VALIDATION_RULES.price}
                    placeholder="Mínimo"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    type="number"
                    showIcon={false}
                  />
                  <ValidatedInput
                    value={filters.maxPrice}
                    onChange={(value) => handleInputChange('maxPrice', value)}
                    rule={VALIDATION_RULES.price}
                    placeholder="Máximo"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    type="number"
                    showIcon={false}
                  />
                </div>
              </div>

              {/* Season */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Temporada</label>
                <select
                  value={filters.season}
                  onChange={(e) => handleInputChange('season', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20"
                >
                  {SEASON_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Certifications */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Certificaciones</label>
                <div className="space-y-2">
                  {CERTIFICATION_OPTIONS.map(cert => (
                    <label key={cert.value} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filters.certifications.includes(cert.value)}
                        onChange={(e) => {
                          const newCerts = e.target.checked
                            ? [...filters.certifications, cert.value]
                            : filters.certifications.filter(c => c !== cert.value)
                          handleInputChange('certifications', newCerts)
                        }}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <span className="flex items-center gap-1 text-sm">
                        <span className="material-icons-outlined text-[18px]">{cert.icon}</span>
                        {cert.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Filter summary */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          {filters.category && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
              Categoría: {filters.category}
              <button
                onClick={() => handleInputChange('category', '')}
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.locationText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
              Ubicación: {filters.locationText}
              <button
                onClick={() => handleInputChange('locationText', '')}
                className="ml-1 text-green-600 hover:text-green-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {filters.certifications.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">
              Certificaciones: {filters.certifications.length}
              <button
                onClick={() => handleInputChange('certifications', [])}
                className="ml-1 text-purple-600 hover:text-purple-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {(filters.minPrice || filters.maxPrice) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-sm text-yellow-800">
              Precio: {filters.minPrice || '0'} - {filters.maxPrice || '∞'}
              <button
                onClick={() => {
                  handleInputChange('minPrice', '')
                  handleInputChange('maxPrice', '')
                }}
                className="ml-1 text-yellow-600 hover:text-yellow-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}
// Search history and autocomplete system for agricultural products

export interface SearchHistoryItem {
  query: string
  timestamp: number
  category?: string
  filters?: Record<string, string>
  resultCount?: number
}

export interface SearchSuggestion {
  text: string
  type: 'history' | 'popular' | 'agricultural'
  category?: string
  relevance: number
}

// Agricultural search terms and synonyms
export const AGRICULTURAL_SEARCH_TERMS = {
  // Fruits
  fruits: ['banano', 'plátano', 'banana', 'uva', 'manzana', 'naranja', 'mandarina', 'papaya', 'mango', 'guayaba'],
  
  // Vegetables  
  vegetables: ['tomate', 'cebolla', 'papa', 'patata', 'arracacha', 'yuca', 'ahuyama', 'zapallo', 'zanahoria', 'espinaca'],
  
  // Grains
  grains: ['arroz', 'maíz', 'trigo', 'cebada', 'avena', 'quinoa', 'amaranto', 'frijol', 'lenteja', 'garbanzo'],
  
  // Dairy
  dairy: ['leche', 'queso', 'yogurt', 'cuajada', 'kumis', 'mantequilla', 'crema'],
  
  // Tubers
  tubers: ['papa', 'yuca', 'arracacha', 'ocumo', 'name', 'batata', 'camote'],
  
  // Herbs
  herbs: ['cilantro', 'perejil', 'albahaca', 'romero', 'tomillo', 'oregano', 'menta', 'hierbabuena'],
  
  // General terms
  general: ['fresco', 'organico', 'natural', 'campesino', 'artesanal', 'tradicional', 'de temporada'],
  
  // Units
  units: ['arroba', 'quintal', 'tonelada', 'fanega', 'caballeria', 'hectarea', 'docena', 'ciento'],
  
  // Certifications
  certifications: ['organico', 'comercio justo', 'fair trade', 'certificado', 'sin pesticidas'],
  
  // Seasons
  seasons: ['temporada', 'estacion', 'invierno', 'verano', 'lluvias', 'seca'],
  
  // Quality
  quality: ['calidad', 'premium', 'selecto', 'extra', 'grado', 'categoria']
} as const

// Popular agricultural searches in Colombia
export const POPULAR_AGRICULTURAL_SEARCHES = [
  'café orgánico',
  'café de temporada',
  'plátano verde',
  'papa criolla',
  'yuca fresca',
  'arroz premium',
  'maíz amarillo',
  'frijol cargamanto',
  'lenteja parda',
  'garbanzo seco',
  'cebolla cabezona',
  'tomate chonto',
  'ahuyama tipo pie',
  'guayaba pera',
  'banano bocadillo',
  'uva isabella',
  'manzana reineta',
  'naranja valencia',
  'mandarina clemenules',
  'papaya hawaiana'
]

// Search history manager
export class SearchHistoryManager {
  private static readonly STORAGE_KEY = 'agrolink_search_history'
  private static readonly MAX_HISTORY_ITEMS = 50
  private static readonly MAX_HISTORY_DAYS = 30

  static getHistory(): SearchHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []
      
      const history = JSON.parse(stored) as SearchHistoryItem[]
      const cutoffDate = Date.now() - (this.MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000)
      
      return history
        .filter(item => item.timestamp > cutoffDate)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.MAX_HISTORY_ITEMS)
    } catch {
      return []
    }
  }

  static addToHistory(item: Omit<SearchHistoryItem, 'timestamp'>): void {
    try {
      const history = this.getHistory()
      const newItem: SearchHistoryItem = {
        ...item,
        timestamp: Date.now()
      }
      
      // Remove duplicates (same query)
      const filtered = history.filter(h => h.query.toLowerCase() !== item.query.toLowerCase())
      
      // Add new item at the beginning
      const updated = [newItem, ...filtered].slice(0, this.MAX_HISTORY_ITEMS)
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated))
    } catch {
      // Silently fail if localStorage is not available
    }
  }

  static clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch {
      // Silently fail
    }
  }

  static removeFromHistory(query: string): void {
    try {
      const history = this.getHistory()
      const filtered = history.filter(h => h.query.toLowerCase() !== query.toLowerCase())
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered))
    } catch {
      // Silently fail
    }
  }
}

// Get search suggestions based on query
export function getSearchSuggestions(query: string, category?: string): SearchSuggestion[] {
  if (!query || query.length < 2) return []
  
  const normalizedQuery = query.toLowerCase().trim()
  const suggestions: SearchSuggestion[] = []
  
  // Add history suggestions
  const history = SearchHistoryManager.getHistory()
  history.forEach(item => {
    if (item.query.toLowerCase().includes(normalizedQuery)) {
      suggestions.push({
        text: item.query,
        type: 'history',
        category: item.category,
        relevance: 1.0 // High relevance for history
      })
    }
  })
  
  // Add popular searches
  POPULAR_AGRICULTURAL_SEARCHES.forEach(search => {
    if (search.toLowerCase().includes(normalizedQuery)) {
      suggestions.push({
        text: search,
        type: 'popular',
        relevance: 0.8
      })
    }
  })
  
  // Add agricultural terms
  Object.values(AGRICULTURAL_SEARCH_TERMS).flat().forEach(term => {
    if (term.toLowerCase().includes(normalizedQuery)) {
      suggestions.push({
        text: term,
        type: 'agricultural',
        relevance: 0.6
      })
    }
  })
  
  // Filter by category if specified
  const filtered = category 
    ? suggestions.filter(s => !s.category || s.category === category)
    : suggestions
  
  // Remove duplicates and sort by relevance
  const unique = filtered.filter((s, index, arr) => 
    arr.findIndex(other => other.text.toLowerCase() === s.text.toLowerCase()) === index
  )
  
  return unique.sort((a, b) => b.relevance - a.relevance).slice(0, 8)
}

// Enhanced search with fuzzy matching
export function fuzzySearch(query: string, text: string): boolean {
  const normalizedQuery = query.toLowerCase().trim()
  const normalizedText = text.toLowerCase().trim()
  
  // Exact match
  if (normalizedText.includes(normalizedQuery)) return true
  
  // Word-by-word match
  const queryWords = normalizedQuery.split(/\s+/)
  const textWords = normalizedText.split(/\s+/)
  
  const matches = queryWords.filter(qw => 
    textWords.some(tw => tw.includes(qw) || qw.includes(tw))
  )
  
  return matches.length >= Math.ceil(queryWords.length * 0.7) // 70% threshold
}

// Get search analytics
export function getSearchAnalytics(): {
  totalSearches: number
  topQueries: string[]
  categories: Record<string, number>
  averageResults: number
} {
  const history = SearchHistoryManager.getHistory()
  
  if (history.length === 0) {
    return {
      totalSearches: 0,
      topQueries: [],
      categories: {},
      averageResults: 0
    }
  }
  
  // Count queries
  const queryCounts = new Map<string, number>()
  const categoryCounts = new Map<string, number>()
  let totalResults = 0
  
  history.forEach(item => {
    queryCounts.set(item.query, (queryCounts.get(item.query) || 0) + 1)
    if (item.category) {
      categoryCounts.set(item.category, (categoryCounts.get(item.category) || 0) + 1)
    }
    if (item.resultCount) {
      totalResults += item.resultCount
    }
  })
  
  const topQueries = Array.from(queryCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([query]) => query)
  
  const categories = Object.fromEntries(categoryCounts)
  const averageResults = totalResults / history.length
  
  return {
    totalSearches: history.length,
    topQueries,
    categories,
    averageResults
  }
}
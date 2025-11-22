import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Loader2, Sprout, Info, Leaf } from 'lucide-react'
import { aiService } from '../services/aiService'

interface ProductAIRecommendationsProps {
  productName: string
  category: string
  description?: string
  className?: string
}

export function ProductAIRecommendations({ 
  productName, 
  category, 
  description, 
  className = '' 
}: ProductAIRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<string>('')
  const [cultivationTips, setCultivationTips] = useState<string>('')
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [isLoadingCultivation, setIsLoadingCultivation] = useState(false)
  const [errorRecommendations, setErrorRecommendations] = useState<string | null>(null)
  const [errorCultivation, setErrorCultivation] = useState<string | null>(null)
  const [showRecommendations, setShowRecommendations] = useState(true)
  const [showCultivation, setShowCultivation] = useState(false)

  useEffect(() => {
    loadRecommendations()
  }, [productName, category, description])

  const loadRecommendations = async () => {
    setIsLoadingRecommendations(true)
    setErrorRecommendations(null)
    
    try {
      const recs = await aiService.getProductRecommendations(productName, category, description)
      setRecommendations(recs)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar recomendaciones'
      setErrorRecommendations(errorMessage)
    } finally {
      setIsLoadingRecommendations(false)
    }
  }

  const loadCultivationTips = async () => {
    if (cultivationTips) {
      setShowCultivation(!showCultivation)
      return
    }

    setIsLoadingCultivation(true)
    setErrorCultivation(null)
    
    try {
      const tips = await aiService.getCultivationTips(productName, category)
      setCultivationTips(tips)
      setShowCultivation(true)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar consejos de cultivo'
      setErrorCultivation(errorMessage)
    } finally {
      setIsLoadingCultivation(false)
    }
  }

  const formatRecommendations = (text: string) => {
    return text.split('\n').map((line, index) => {
      if (line.match(/^\d+\./)) {
        return (
          <div key={index} className="flex gap-2 mb-2">
            <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full text-xs flex items-center justify-center font-bold">
              {line.match(/^\d+\./)?.[0].replace('.', '')}
            </span>
            <span className="text-sm text-gray-700">{line.replace(/^\d+\.\s*/, '')}</span>
          </div>
        )
      }
      if (line.trim()) {
        return (
          <p key={index} className="text-sm text-gray-700 mb-2">
            {line}
          </p>
        )
      }
      return null
    })
  }

  return (
    <div className={`bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-green-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-600 rounded-lg">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Recomendaciones Inteligentes</h3>
            <p className="text-sm text-gray-600">Consejos de IA para {productName}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Recommendations Section */}
        <div className="bg-white rounded-lg border border-green-100">
          <button
            onClick={() => setShowRecommendations(!showRecommendations)}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-green-600" />
              <span className="font-medium text-gray-900">Consejos de uso y almacenamiento</span>
            </div>
            {showRecommendations ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          
          {showRecommendations && (
            <div className="px-4 pb-4 border-t border-green-100">
              {isLoadingRecommendations ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                  <span className="ml-2 text-sm text-gray-600">Cargando recomendaciones...</span>
                </div>
              ) : errorRecommendations ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{errorRecommendations}</p>
                  <button
                    onClick={loadRecommendations}
                    className="mt-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              ) : recommendations ? (
                <div className="space-y-3">
                  {formatRecommendations(recommendations)}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Cultivation Tips Section */}
        <div className="bg-white rounded-lg border border-green-100">
          <button
            onClick={loadCultivationTips}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-lg"
          >
            <div className="flex items-center gap-2">
              <Sprout className="h-4 w-4 text-green-600" />
              <span className="font-medium text-gray-900">Consejos de cultivo</span>
            </div>
            <div className="flex items-center gap-2">
              {isLoadingCultivation && (
                <Loader2 className="h-4 w-4 animate-spin text-green-600" />
              )}
              {showCultivation ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </button>
          
          {showCultivation && (
            <div className="px-4 pb-4 border-t border-green-100">
              {isLoadingCultivation ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                  <span className="ml-2 text-sm text-gray-600">Cargando consejos de cultivo...</span>
                </div>
              ) : errorCultivation ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{errorCultivation}</p>
                  <button
                    onClick={loadCultivationTips}
                    className="mt-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                  >
                    Reintentar
                  </button>
                </div>
              ) : cultivationTips ? (
                <div className="space-y-3">
                  {formatRecommendations(cultivationTips)}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <Leaf className="h-4 w-4 text-green-600" />
            <span className="text-xs text-gray-600">Powered by AgroLink AI</span>
          </div>
          <button
            onClick={() => {
              loadRecommendations()
              if (showCultivation) loadCultivationTips()
            }}
            className="text-xs text-green-600 hover:text-green-700 font-medium"
          >
            Actualizar recomendaciones
          </button>
        </div>
      </div>
    </div>
  )
}
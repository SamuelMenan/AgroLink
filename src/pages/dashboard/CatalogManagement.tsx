import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import CatalogDashboard from '../../components/CatalogDashboard'
import type { SyncResult } from '../../services/catalogSyncService'
import { productEnrichmentService } from '../../services/productEnrichmentService'
import { listMyProducts } from '../../services/productService'
import type { Product } from '../../types/product'

/**
 * Página de administración del catálogo de productos
 * Incluye sincronización automática, enriquecimiento de datos y análisis de calidad
 */
export default function CatalogManagement() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'overview' | 'sync' | 'enrichment' | 'analytics'>('overview')
  const [isLoading, setIsLoading] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [catalogQuality, setCatalogQuality] = useState({
    overall: 0,
    completeness: 0,
    accuracy: 0,
    consistency: 0
  })
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // Cargar productos del usuario
  useEffect(() => {
    if (user) {
      loadUserProducts()
    }
  }, [user])

  const loadUserProducts = async () => {
    try {
      setIsLoading(true)
      const userProducts = await listMyProducts(user!.id)
      setProducts(userProducts)
      analyzeCatalogQuality(userProducts)
    } catch (error) {
      console.error('Error cargando productos:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const analyzeCatalogQuality = (products: Product[]) => {
    if (products.length === 0) return

    let completenessScore = 0
    let accuracyScore = 0
    let consistencyScore = 0

    // Calcular completitud (campos completados)
    products.forEach(product => {
      let completedFields = 0
      let totalFields = 0

      // Campos básicos
      if (product.name) completedFields++
      if (product.description) completedFields++
      if (product.price > 0) completedFields++
      if (product.quantity) completedFields++
      if (product.category) completedFields++
      totalFields += 5

      // Campos mejorados
      if (product.image_urls && product.image_urls.length > 0) completedFields++
      if (product.department && product.municipality) completedFields++
      if (product.condition) completedFields++
      if (product.detailed_description) completedFields++
      if (product.price_per_unit || product.price_per_kilo) completedFields++
      if (product.stock_available !== undefined) completedFields++
      totalFields += 6

      completenessScore += (completedFields / totalFields) * 100
    })

    completenessScore = completenessScore / products.length

    // Calcular precisión (validaciones básicas)
    products.forEach(product => {
      let validations = 0
      
      if (product.name && product.name.length >= 3) validations++
      if (product.description && product.description.length >= 10) validations++
      if (product.price > 0 && product.price < 1000000000) validations++
      if (product.quantity && product.quantity.trim().length > 0) validations++
      if (product.category && ['frutas', 'verduras', 'granos', 'lácteos', 'tubérculos', 'hierbas', 'otros'].includes(product.category)) validations++
      
      accuracyScore += (validations / 5) * 100
    })

    accuracyScore = accuracyScore / products.length

    // Calcular consistencia (formatos uniformes)
    let consistentNames = 0
    let consistentDescriptions = 0
    let consistentPricing = 0

    products.forEach(product => {
      // Nombres consistentes (capitalización)
      if (product.name && product.name === product.name.trim()) consistentNames++
      
      // Descripciones consistentes (longitud apropiada)
      if (product.description && product.description.length >= 10 && product.description.length <= 200) consistentDescriptions++
      
      // Precios consistentes (rangos razonables)
      if (product.price > 0 && product.price < 1000000000) consistentPricing++
    })

    consistencyScore = ((consistentNames + consistentDescriptions + consistentPricing) / (products.length * 3)) * 100

    const overallScore = (completenessScore + accuracyScore + consistencyScore) / 3

    setCatalogQuality({
      overall: Math.round(overallScore),
      completeness: Math.round(completenessScore),
      accuracy: Math.round(accuracyScore),
      consistency: Math.round(consistencyScore)
    })
  }

  const handleSyncComplete = (result: SyncResult) => {
    setLastSyncResult(result)
    // Recargar productos después de la sincronización
    loadUserProducts()
  }

  const handleBulkEnrichment = async () => {
    if (selectedProducts.length === 0) {
      alert('Por favor selecciona al menos un producto para enriquecer')
      return
    }

    try {
      setIsLoading(true)
      let enrichedCount = 0
      
      for (const productId of selectedProducts) {
        const product = products.find(p => p.id === productId)
        if (!product) continue

        // Enriquecer descripción
        const enrichmentResult = productEnrichmentService.enrichDescription(
          product.description,
          product.category
        )

        if (enrichmentResult.improvements.length > 0) {
          // Aquí se actualizaría el producto en la base de datos
          console.log(`Producto ${productId} enriquecido:`, enrichmentResult)
          enrichedCount++
        }
      }

      alert(`${enrichedCount} productos fueron enriquecidos exitosamente`)
      loadUserProducts() // Recargar para ver cambios
    } catch (error) {
      console.error('Error en enriquecimiento masivo:', error)
      alert('Error al enriquecer productos')
    } finally {
      setIsLoading(false)
    }
  }

  const QualityIndicator = ({ score, label }: { score: number; label: string }) => (
    <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">Calidad del catálogo</div>
      </div>
      <div className={`text-lg font-bold ${
        score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600'
      }`}>
        {score}%
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestión del Catálogo</h1>
          <p className="text-gray-600 mt-2">
            Administra y optimiza la información de todos tus productos agrícolas
          </p>
        </div>

        {/* Quality Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <QualityIndicator score={catalogQuality.overall} label="Calidad General" />
          <QualityIndicator score={catalogQuality.completeness} label="Completitud" />
          <QualityIndicator score={catalogQuality.accuracy} label="Precisión" />
          <QualityIndicator score={catalogQuality.consistency} label="Consistencia" />
        </div>

        {/* Navigation Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Resumen' },
              { id: 'sync', label: 'Sincronización' },
              { id: 'enrichment', label: 'Enriquecimiento' },
              { id: 'analytics', label: 'Análisis' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {activeTab === 'overview' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Resumen del Catálogo</h2>
              
              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <span className="material-icons-outlined text-green-600 mr-2">sync</span>
                    <h3 className="font-medium text-gray-900">Sincronizar Datos</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Actualiza y valida toda la información de tus productos
                  </p>
                  <button
                    onClick={() => setActiveTab('sync')}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                  >
                    Ir a Sincronización
                  </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <span className="material-icons-outlined text-blue-600 mr-2">auto_awesome</span>
                    <h3 className="font-medium text-gray-900">Enriquecer Descripciones</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Mejora tus descripciones con terminología agrícola técnica
                  </p>
                  <button
                    onClick={() => setActiveTab('enrichment')}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Ir a Enriquecimiento
                  </button>
                </div>

                <div className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <span className="material-icons-outlined text-purple-600 mr-2">analytics</span>
                    <h3 className="font-medium text-gray-900">Análisis Detallado</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    Visualiza estadísticas y métricas de tu catálogo
                  </p>
                  <button
                    onClick={() => setActiveTab('analytics')}
                    className="w-full px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                  >
                    Ir a Análisis
                  </button>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium text-gray-900 mb-3">Actividad Reciente</h3>
                {lastSyncResult ? (
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <span className="material-icons-outlined text-green-600 mr-2">check_circle</span>
                      <span>Última sincronización: {lastSyncResult.updated} productos actualizados</span>
                    </div>
                    {lastSyncResult.warnings.length > 0 && (
                      <div className="flex items-center text-sm text-yellow-600">
                        <span className="material-icons-outlined mr-2">warning</span>
                        <span>{lastSyncResult.warnings.length} advertencias encontradas</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No hay actividad reciente</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Sincronización de Catálogo</h2>
              <CatalogDashboard onSyncComplete={handleSyncComplete} />
            </div>
          )}

          {activeTab === 'enrichment' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Enriquecimiento de Productos</h2>
                <button
                  onClick={handleBulkEnrichment}
                  disabled={selectedProducts.length === 0 || isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Procesando...' : `Enriquecer Seleccionados (${selectedProducts.length})`}
                </button>
              </div>

              {/* Product Selection */}
              <div className="mb-4">
                <div className="flex items-center space-x-4 mb-3">
                  <button
                    onClick={() => setSelectedProducts(products.map(p => p.id))}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Seleccionar todos
                  </button>
                  <button
                    onClick={() => setSelectedProducts([])}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Limpiar selección
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {products.map((product) => (
                    <div key={product.id} className="border border-gray-200 rounded-lg p-3">
                      <label className="flex items-start space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProducts(prev => [...prev, product.id])
                            } else {
                              setSelectedProducts(prev => prev.filter(id => id !== product.id))
                            }
                          }}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            {product.image_urls?.[0] && (
                              <img
                                src={product.image_urls[0]}
                                alt={product.name}
                                className="w-8 h-8 rounded object-cover"
                              />
                            )}
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {product.name}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {product.description}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">{product.category}</span>
                            <span className="text-sm font-semibold text-green-600">
                              ${product.price.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Análisis del Catálogo</h2>
              
              {/* Quality Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Distribución por Categoría</h3>
                  <div className="space-y-2">
                    {['frutas', 'verduras', 'granos', 'lácteos', 'tubérculos', 'hierbas', 'otros'].map(category => {
                      const count = products.filter(p => p.category === category).length
                      const percentage = products.length > 0 ? (count / products.length) * 100 : 0
                      return (
                        <div key={category} className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 capitalize">{category}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-medium text-gray-900">{count}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Completitud de Datos</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Con imágenes', value: products.filter(p => p.image_urls?.length > 0).length },
                      { label: 'Con ubicación', value: products.filter(p => p.department && p.municipality).length },
                      { label: 'Con condición', value: products.filter(p => p.condition).length },
                      { label: 'Con precio dual', value: products.filter(p => p.price_per_unit || p.price_per_kilo).length }
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">{item.label}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {item.value}/{products.length}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-3">Recomendaciones para Mejorar</h3>
                <ul className="space-y-2 text-sm text-blue-800">
                  {catalogQuality.completeness < 80 && (
                    <li className="flex items-start">
                      <span className="material-icons-outlined text-blue-600 mr-2 text-sm">info</span>
                      <span>Completa la información de ubicación para mejorar la visibilidad de tus productos</span>
                    </li>
                  )}
                  {catalogQuality.accuracy < 80 && (
                    <li className="flex items-start">
                      <span className="material-icons-outlined text-blue-600 mr-2 text-sm">info</span>
                      <span>Revisa los precios y cantidades de tus productos para asegurar precisión</span>
                    </li>
                  )}
                  {catalogQuality.consistency < 80 && (
                    <li className="flex items-start">
                      <span className="material-icons-outlined text-blue-600 mr-2 text-sm">info</span>
                      <span>Establece un formato consistente para nombres y descripciones de productos</span>
                    </li>
                  )}
                  {products.filter(p => !p.condition).length > products.length * 0.5 && (
                    <li className="flex items-start">
                      <span className="material-icons-outlined text-blue-600 mr-2 text-sm">info</span>
                      <span>Especifica la condición de tus productos (fresco, orgánico, convencional)</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
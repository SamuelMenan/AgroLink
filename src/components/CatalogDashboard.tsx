import { useState, useEffect } from 'react'
import { catalogSyncService, type SyncResult, type CatalogSyncOptions } from '../services/catalogSyncService'

interface CatalogDashboardProps {
  onSyncComplete?: (result: SyncResult) => void
}

interface SyncProgress {
  isRunning: boolean
  currentBatch: number
  totalBatches: number
  processed: number
  total: number
  message: string
}

/**
 * Panel de control para gestión y sincronización del catálogo de productos
 * Incluye validación automática, mejoras de datos y análisis de calidad
 */
export default function CatalogDashboard({ onSyncComplete }: CatalogDashboardProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    isRunning: false,
    currentBatch: 0,
    totalBatches: 0,
    processed: 0,
    total: 0,
    message: ''
  })
  const [syncOptions, setSyncOptions] = useState<CatalogSyncOptions>({
    batchSize: 50,
    delayBetweenBatches: 1000,
    validateData: true,
    updateTimestamps: false,
    syncImages: false
  })
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [catalogStats, setCatalogStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    productsWithImages: 0,
    productsWithLocation: 0,
    productsWithCondition: 0,
    productsWithDualPricing: 0
  })

  // Cargar estadísticas del catálogo al montar
  useEffect(() => {
    loadCatalogStats()
    
    // Cargar última sincronización desde localStorage
    const savedSyncTime = localStorage.getItem('catalogLastSyncTime')
    if (savedSyncTime) {
      setLastSyncTime(new Date(savedSyncTime))
    }
  }, [])

  const loadCatalogStats = async () => {
    try {
      // Aquí irían las llamadas a la API para obtener estadísticas reales
      // Por ahora usamos datos de ejemplo
      setCatalogStats({
        totalProducts: 156,
        activeProducts: 142,
        productsWithImages: 138,
        productsWithLocation: 134,
        productsWithCondition: 89,
        productsWithDualPricing: 67
      })
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncResult(null)
    setSyncProgress({
      isRunning: true,
      currentBatch: 0,
      totalBatches: 0,
      processed: 0,
      total: 0,
      message: 'Iniciando sincronización...'
    })

    try {
      // Simular progreso para mejor UX
      const progressInterval = setInterval(() => {
        setSyncProgress(prev => ({
          ...prev,
          message: `Procesando productos... ${prev.processed}/${prev.total}`
        }))
      }, 500)

      const result = await catalogSyncService.syncCatalog(syncOptions)
      
      clearInterval(progressInterval)
      
      setSyncResult(result)
      setLastSyncTime(new Date())
      localStorage.setItem('catalogLastSyncTime', new Date().toISOString())
      
      // Recargar estadísticas después de la sincronización
      await loadCatalogStats()
      
      if (onSyncComplete) {
        onSyncComplete(result)
      }
      
    } catch (error) {
      console.error('Error en sincronización:', error)
      setSyncResult({
        totalProcessed: 0,
        updated: 0,
        errors: 1,
        warnings: [`Error general: ${error instanceof Error ? error.message : 'Error desconocido'}`],
        details: []
      })
    } finally {
      setIsSyncing(false)
      setSyncProgress({
        isRunning: false,
        currentBatch: 0,
        totalBatches: 0,
        processed: 0,
        total: 0,
        message: ''
      })
    }
  }

  // Removed unused functions

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Gestión del Catálogo</h2>
        <p className="text-sm text-gray-600 mt-1">
          Sincroniza y mejora automáticamente la información de todos los productos
        </p>
      </div>

      {/* Estadísticas del Catálogo */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{catalogStats.totalProducts}</div>
          <div className="text-sm text-gray-600">Total Productos</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{catalogStats.activeProducts}</div>
          <div className="text-sm text-gray-600">Activos</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">
            {Math.round((catalogStats.productsWithImages / catalogStats.totalProducts) * 100)}%
          </div>
          <div className="text-sm text-gray-600">Con Imágenes</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-purple-600">
            {Math.round((catalogStats.productsWithLocation / catalogStats.totalProducts) * 100)}%
          </div>
          <div className="text-sm text-gray-600">Con Ubicación</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-emerald-600">
            {Math.round((catalogStats.productsWithCondition / catalogStats.totalProducts) * 100)}%
          </div>
          <div className="text-sm text-gray-600">Con Condición</div>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-orange-600">
            {Math.round((catalogStats.productsWithDualPricing / catalogStats.totalProducts) * 100)}%
          </div>
          <div className="text-sm text-gray-600">Con Precio Dual</div>
        </div>
      </div>

      {/* Opciones de Sincronización */}
      <div className="mb-6 rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Opciones de Sincronización</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={syncOptions.validateData}
                onChange={(e) => setSyncOptions((prev: CatalogSyncOptions) => ({ ...prev, validateData: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Validar datos de productos</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Verifica y corrige errores en la información</p>
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={syncOptions.updateTimestamps}
                onChange={(e) => setSyncOptions((prev: CatalogSyncOptions) => ({ ...prev, updateTimestamps: e.target.checked }))}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">Actualizar timestamps</span>
            </label>
            <p className="text-xs text-gray-500 mt-1">Actualiza la fecha de última modificación</p>
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">Tamaño de lote:</span>
              <select
                value={syncOptions.batchSize}
                onChange={(e) => setSyncOptions((prev: CatalogSyncOptions) => ({ ...prev, batchSize: parseInt(e.target.value) }))}
                className="rounded border-gray-300 text-sm focus:border-green-500 focus:ring-green-500"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>
          <div>
            <label className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">Delay entre lotes (ms):</span>
              <select
                value={syncOptions.delayBetweenBatches}
                onChange={(e) => setSyncOptions((prev: CatalogSyncOptions) => ({ ...prev, delayBetweenBatches: parseInt(e.target.value) }))}
                className="rounded border-gray-300 text-sm focus:border-green-500 focus:ring-green-500"
              >
                <option value={500}>500</option>
                <option value={1000}>1000</option>
                <option value={2000}>2000</option>
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Botón de Sincronización */}
      <div className="mb-6">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className={`w-full md:w-auto px-6 py-3 rounded-lg font-semibold transition-colors ${
            isSyncing
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isSyncing ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Sincronizando...</span>
            </div>
          ) : (
            'Sincronizar Catálogo'
          )}
        </button>
        {lastSyncTime && (
          <p className="text-xs text-gray-500 mt-2">
            Última sincronización: {lastSyncTime.toLocaleString()}
          </p>
        )}
      </div>

      {/* Progreso de Sincronización */}
      {syncProgress.isRunning && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-blue-900">Progreso de Sincronización</span>
            <span className="text-sm text-blue-700">
              {syncProgress.processed}/{syncProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${syncProgress.total > 0 ? (syncProgress.processed / syncProgress.total) * 100 : 0}%`
              }}
            ></div>
          </div>
          <p className="text-xs text-blue-700 mt-2">{syncProgress.message}</p>
        </div>
      )}

      {/* Resultados de Sincronización */}
      {syncResult && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Resultados de la Sincronización</h3>
          </div>
          <div className="p-4 space-y-4">
            {/* Resumen */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{syncResult.totalProcessed}</div>
                <div className="text-xs text-gray-600">Procesados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{syncResult.updated}</div>
                <div className="text-xs text-gray-600">Actualizados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{syncResult.errors}</div>
                <div className="text-xs text-gray-600">Errores</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{syncResult.warnings.length}</div>
                <div className="text-xs text-gray-600">Advertencias</div>
              </div>
            </div>

            {/* Advertencias */}
            {syncResult.warnings.length > 0 && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3">
                <h4 className="text-sm font-medium text-yellow-800 mb-2">Advertencias</h4>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {syncResult.warnings.slice(0, 5).map((warning: string, index: number) => (
                    <li key={index}>• {warning}</li>
                  ))}
                  {syncResult.warnings.length > 5 && (
                    <li className="text-yellow-600">... y {syncResult.warnings.length - 5} más</li>
                  )}
                </ul>
              </div>
            )}

            {/* Detalles */}
            {syncResult.details.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Detalles de Cambios</h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {syncResult.details
                    .filter((detail: any) => detail.action === 'updated')
                    .slice(0, 10)
                    .map((detail: any, index: number) => (
                      <div key={index} className="text-xs text-gray-600 p-2 bg-gray-50 rounded">
                        <span className="font-medium">Producto {detail.productId}:</span> Actualizado con{' '}
                        {detail.changes && Object.keys(detail.changes).length > 0
                          ? Object.keys(detail.changes).join(', ')
                          : 'cambios menores'}
                      </div>
                    ))}
                </div>
                {syncResult.details.filter((d: any) => d.action === 'updated').length > 10 && (
                  <p className="text-xs text-gray-500 mt-2">
                    ... y {syncResult.details.filter(d => d.action === 'updated').length - 10} más productos actualizados
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
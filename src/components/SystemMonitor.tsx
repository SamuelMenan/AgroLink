import React, { useState, useEffect } from 'react'
import { AlertCircle, Info, AlertTriangle, RefreshCw, Activity } from 'lucide-react'
import { errorLogger } from '../services/errorLogging'
import { memoryMonitor } from '../services/memoryMonitor'

interface SystemStats {
  errorCount: number
  warningCount: number
  infoCount: number
  queueSize: number
  memoryUsage: {
    used: number
    total: number
    limit: number
  }
  lastError: string | null
  lastWarning: string | null
  lastInfo: string | null
}

export const SystemMonitor: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [stats, setStats] = useState<SystemStats>({
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    queueSize: 0,
    memoryUsage: {
      used: 0,
      total: 0,
      limit: 0
    },
    lastError: null,
    lastWarning: null,
    lastInfo: null
  })
  const [isAutoRefresh, setIsAutoRefresh] = useState(true)
  // const [refreshInterval, setRefreshInterval] = useState<ReturnType<typeof setInterval> | null>(null)

  // Collect system statistics
  const collectStats = () => {
    const memoryInfo = memoryMonitor.getCurrentMemoryInfo()
    const recentLogs = errorLogger.getRecentLogs?.() || []
    
    const errorLogs = recentLogs.filter(log => log.severity === 'error')
    const warningLogs = recentLogs.filter(log => log.severity === 'warning')
    const infoLogs = recentLogs.filter(log => log.severity === 'info')

    setStats({
      errorCount: errorLogs.length,
      warningCount: warningLogs.length,
      infoCount: infoLogs.length,
      queueSize: errorLogger.getQueueSize(),
      memoryUsage: {
        used: memoryInfo?.usedJSHeapSize || 0,
        total: memoryInfo?.totalJSHeapSize || 0,
        limit: memoryInfo?.jsHeapSizeLimit || 0
      },
      lastError: errorLogs[0]?.message || null,
      lastWarning: warningLogs[0]?.message || null,
      lastInfo: infoLogs[0]?.message || null
    })
  }

  useEffect(() => {
    collectStats()
    
    if (isAutoRefresh) {
      const interval = setInterval(collectStats, 5000)
      // setRefreshInterval(interval)
      return () => clearInterval(interval)
    }
  }, [isAutoRefresh])

  const handleManualRefresh = () => {
    collectStats()
  }

  const handleClearLogs = () => {
    if (confirm('¿Estás seguro de que quieres limpiar todos los logs?')) {
      // Clear logs logic would go here
      console.log('Logs cleared')
      collectStats()
    }
  }

  const handleExportLogs = () => {
    const logs = errorLogger.getRecentLogs?.() || []
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `system-logs-${new Date().toISOString()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getMemoryPercentage = () => {
    if (stats.memoryUsage.total === 0) return 0
    return (stats.memoryUsage.used / stats.memoryUsage.total) * 100
  }

  const getMemoryColor = (percentage: number) => {
    if (percentage > 90) return 'text-red-500'
    if (percentage > 70) return 'text-yellow-500'
    return 'text-green-500'
  }

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg z-50"
        title="Abrir Monitor de Sistema"
      >
        <Activity className="w-6 h-6" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-xl z-50 w-80 max-h-96 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Monitor de Sistema</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className={`p-1 rounded ${isAutoRefresh ? 'text-blue-600' : 'text-gray-400'}`}
            title="Auto-refrescar"
          >
            <RefreshCw className={`w-4 h-4 ${isAutoRefresh ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleManualRefresh}
            className="p-1 rounded text-gray-600 hover:text-gray-800"
            title="Refrescar manualmente"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 rounded text-gray-600 hover:text-gray-800"
            title="Cerrar"
          >
            ×
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto max-h-80">
        {/* Error Summary */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-red-50 p-2 rounded text-center">
            <div className="flex items-center justify-center mb-1">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-lg font-semibold text-red-600">{stats.errorCount}</div>
            <div className="text-xs text-red-600">Errores</div>
          </div>
          <div className="bg-yellow-50 p-2 rounded text-center">
            <div className="flex items-center justify-center mb-1">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            </div>
            <div className="text-lg font-semibold text-yellow-600">{stats.warningCount}</div>
            <div className="text-xs text-yellow-600">Advertencias</div>
          </div>
          <div className="bg-blue-50 p-2 rounded text-center">
            <div className="flex items-center justify-center mb-1">
              <Info className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-lg font-semibold text-blue-600">{stats.infoCount}</div>
            <div className="text-xs text-blue-600">Info</div>
          </div>
        </div>

        {/* Memory Usage */}
        <div className="bg-gray-50 p-3 rounded">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Uso de Memoria</span>
            <span className={`text-sm font-semibold ${getMemoryColor(getMemoryPercentage())}`}>
              {getMemoryPercentage().toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${
                getMemoryPercentage() > 90 ? 'bg-red-500' :
                getMemoryPercentage() > 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(getMemoryPercentage(), 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {formatMemory(stats.memoryUsage.used)} / {formatMemory(stats.memoryUsage.total)}
          </div>
        </div>

        {/* Queue Status */}
        <div className="bg-gray-50 p-3 rounded">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Logs en cola</span>
            <span className="text-sm font-semibold text-gray-900">{stats.queueSize}</span>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Actividad Reciente</h4>
          
          {stats.lastError && (
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-700 break-words">{stats.lastError}</div>
            </div>
          )}
          
          {stats.lastWarning && (
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-700 break-words">{stats.lastWarning}</div>
            </div>
          )}
          
          {stats.lastInfo && (
            <div className="flex items-start space-x-2">
              <Info className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 break-words">{stats.lastInfo}</div>
            </div>
          )}
          
          {!stats.lastError && !stats.lastWarning && !stats.lastInfo && (
            <div className="text-xs text-gray-500 text-center py-2">
              No hay actividad reciente
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex space-x-2 pt-2 border-t border-gray-200">
          <button
            onClick={handleExportLogs}
            className="flex-1 px-3 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Exportar Logs
          </button>
          <button
            onClick={handleClearLogs}
            className="flex-1 px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  )
}

export default SystemMonitor
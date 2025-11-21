import React from 'react'

// Memory leak detection and monitoring utility

interface MemoryInfo {
  timestamp: number
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  documentReadyState: string
  url: string
}

interface ComponentMemoryInfo {
  componentName: string
  mountCount: number
  unmountCount: number
  activeInstances: number
  lastMountTime?: number
  lastUnmountTime?: number
}

class MemoryMonitor {
  private measurements: MemoryInfo[] = []
  private componentStats: Map<string, ComponentMemoryInfo> = new Map()
  private monitoringInterval: number | null = null
  private readonly MAX_MEASUREMENTS = 100
  private readonly GROWTH_THRESHOLD = 1.5 // 50% growth threshold
  private readonly CHECK_INTERVAL = 30000 // 30 seconds

  constructor() {
    if (typeof window !== 'undefined' && (window as any).performance && (window as any).performance.memory) {
      this.startMonitoring()
    }
  }

  private startMonitoring() {
    this.monitoringInterval = window.setInterval(() => {
      this.takeMeasurement()
      this.checkForMemoryLeaks()
    }, this.CHECK_INTERVAL)
  }

  private takeMeasurement() {
    const memory = (window as any).performance.memory
    if (!memory) return

    const measurement: MemoryInfo = {
      timestamp: Date.now(),
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      documentReadyState: document.readyState,
      url: window.location.href
    }

    this.measurements.push(measurement)

    // Keep only recent measurements
    if (this.measurements.length > this.MAX_MEASUREMENTS) {
      this.measurements = this.measurements.slice(-this.MAX_MEASUREMENTS)
    }

    // Log significant memory changes
    if (this.measurements.length > 1) {
      const previous = this.measurements[this.measurements.length - 2]
      const growth = measurement.usedJSHeapSize / previous.usedJSHeapSize
      
      if (growth > this.GROWTH_THRESHOLD) {
        console.warn('🚨 Significant memory growth detected:', {
          growth: `${((growth - 1) * 100).toFixed(1)}%`,
          previous: this.formatBytes(previous.usedJSHeapSize),
          current: this.formatBytes(measurement.usedJSHeapSize),
          url: measurement.url
        })
      }
    }
  }

  private checkForMemoryLeaks() {
    if (this.measurements.length < 10) return

    const recentMeasurements = this.measurements.slice(-10)
    const oldest = recentMeasurements[0]
    const newest = recentMeasurements[recentMeasurements.length - 1]
    
    const totalGrowth = newest.usedJSHeapSize / oldest.usedJSHeapSize
    const timeSpan = newest.timestamp - oldest.timestamp

    if (totalGrowth > this.GROWTH_THRESHOLD) {
      console.error('🔥 Potential memory leak detected:', {
        growth: `${((totalGrowth - 1) * 100).toFixed(1)}%`,
        timeSpan: `${(timeSpan / 1000 / 60).toFixed(1)} minutes`,
        oldest: this.formatBytes(oldest.usedJSHeapSize),
        newest: this.formatBytes(newest.usedJSHeapSize),
        componentStats: this.getComponentStats()
      })

      // Send alert to error logging service
      if (typeof window !== 'undefined' && (window as any).errorLogger) {
        (window as any).errorLogger.logWarning('Potential memory leak detected', {
          growth: totalGrowth,
          timeSpan,
          oldestMemory: oldest.usedJSHeapSize,
          newestMemory: newest.usedJSHeapSize,
          componentStats: this.getComponentStats()
        })
      }
    }
  }

  // Track component lifecycle for leak detection
  trackComponentMount(componentName: string) {
    const stats = this.componentStats.get(componentName) || {
      componentName,
      mountCount: 0,
      unmountCount: 0,
      activeInstances: 0
    }

    stats.mountCount++
    stats.activeInstances++
    stats.lastMountTime = Date.now()
    this.componentStats.set(componentName, stats)
  }

  trackComponentUnmount(componentName: string) {
    const stats = this.componentStats.get(componentName)
    if (!stats) {
      console.warn(`Component ${componentName} unmounted without being tracked`)
      return
    }

    stats.unmountCount++
    stats.activeInstances--
    stats.lastUnmountTime = Date.now()
    this.componentStats.set(componentName, stats)

    // Check for potential component leaks
    if (stats.activeInstances < 0) {
      console.warn(`⚠️ More unmounts than mounts for ${componentName}`)
    }
  }

  getComponentStats() {
    const stats: Record<string, any> = {}
    this.componentStats.forEach((value, key) => {
      stats[key] = {
        ...value,
        potentialLeak: value.activeInstances > 5 // More than 5 active instances
      }
    })
    return stats
  }

  getMemoryStats() {
    if (!this.measurements.length) return null

    const latest = this.measurements[this.measurements.length - 1]
    const average = this.measurements.reduce((sum, m) => sum + m.usedJSHeapSize, 0) / this.measurements.length

    return {
      current: {
        used: this.formatBytes(latest.usedJSHeapSize),
        total: this.formatBytes(latest.totalJSHeapSize),
        limit: this.formatBytes(latest.jsHeapSizeLimit),
        percentage: ((latest.usedJSHeapSize / latest.jsHeapSizeLimit) * 100).toFixed(1)
      },
      average: this.formatBytes(average),
      measurements: this.measurements.length,
      componentStats: this.getComponentStats()
    }
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = null
    }
  }

  // Emergency cleanup function
  emergencyCleanup() {
    console.warn('🧹 Performing emergency memory cleanup')
    
    // Clear various caches and storage
    if (typeof window !== 'undefined') {
      // Clear session storage (but preserve critical data)
      const criticalKeys = ['user', 'auth_token', 'refresh_token']
      const preservedData: Record<string, string> = {}
      
      criticalKeys.forEach(key => {
        const value = sessionStorage.getItem(key)
        if (value) preservedData[key] = value
      })
      
      sessionStorage.clear()
      
      // Restore critical data
      Object.entries(preservedData).forEach(([key, value]) => {
        sessionStorage.setItem(key, value)
      })
      
      // Clear image caches
      const images = document.querySelectorAll('img')
      images.forEach(img => {
        if (img.src && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src)
        }
      })
      
      // Force garbage collection (if available)
      if ((window as any).gc) {
        try {
          (window as any).gc()
          console.log('🗑️ Forced garbage collection')
        } catch (e) {
          console.warn('Could not force garbage collection:', e)
        }
      }
    }
    
    this.takeMeasurement()
    console.log('Emergency cleanup completed')
  }

  // Get current memory info for monitoring
  getCurrentMemoryInfo(): MemoryInfo | null {
    if (this.measurements.length === 0) return null
    return this.measurements[this.measurements.length - 1]
  }
}

// Create singleton instance
export const memoryMonitor = new MemoryMonitor()

// React hook for component lifecycle tracking
export function useMemoryTracking(componentName: string) {
  React.useEffect(() => {
    memoryMonitor.trackComponentMount(componentName)
    return () => {
      memoryMonitor.trackComponentUnmount(componentName)
    }
  }, [componentName])
}

// Utility functions
export const getMemoryStats = () => memoryMonitor.getMemoryStats()
export const stopMemoryMonitoring = () => memoryMonitor.stop()
export const emergencyMemoryCleanup = () => memoryMonitor.emergencyCleanup()

export default memoryMonitor
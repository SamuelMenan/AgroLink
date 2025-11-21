// Global error logging and monitoring service

export interface ErrorLog {
  message: string
  stack?: string
  componentStack?: string
  url: string
  timestamp: string
  userAgent: string
  userId?: string
  severity: 'error' | 'warning' | 'info'
  context?: Record<string, any>
}

class ErrorLoggingService {
  private queue: ErrorLog[] = []
  private isSending = false
  private readonly MAX_QUEUE_SIZE = 50
  private readonly BATCH_SIZE = 5
  private readonly SEND_INTERVAL = 30000 // 30 seconds

  constructor() {
    this.startPeriodicSend()
    this.setupGlobalErrorHandlers()
  }

  private setupGlobalErrorHandlers() {
    if (typeof window === 'undefined') return

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        severity: 'error'
      })
    })

    // Handle JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        severity: 'error'
      })
    })
  }

  logError(errorLog: Omit<ErrorLog, 'timestamp' | 'url' | 'userAgent'>) {
    const fullErrorLog: ErrorLog = {
      ...errorLog,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    }

    // Add to queue
    this.queue.push(fullErrorLog)

    // Prevent queue from growing too large
    if (this.queue.length > this.MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-this.MAX_QUEUE_SIZE)
    }

    // Send immediately if it's a critical error
    if (errorLog.severity === 'error') {
      this.sendErrors()
    }
  }

  logWarning(message: string, context?: Record<string, any>) {
    this.logError({
      message,
      severity: 'warning',
      context
    })
  }

  logInfo(message: string, context?: Record<string, any>) {
    this.logError({
      message,
      severity: 'info',
      context
    })
  }

  private startPeriodicSend() {
    setInterval(() => {
      if (this.queue.length > 0) {
        this.sendErrors()
      }
    }, this.SEND_INTERVAL)
  }

  private async sendErrors() {
    if (this.isSending || this.queue.length === 0) return

    this.isSending = true
    const errorsToSend = this.queue.splice(0, this.BATCH_SIZE)

    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors: errorsToSend })
      })
    } catch (error) {
      // If sending fails, put errors back in queue
      this.queue.unshift(...errorsToSend)
      console.warn('Failed to send error logs:', error)
    } finally {
      this.isSending = false
    }
  }

  // Utility method to log API errors
  logApiError(endpoint: string, method: string, status: number, _message: string, context?: Record<string, any>) {
    this.logError({
      message: `API Error: ${method} ${endpoint} failed with ${status}`,
      severity: 'error',
      context: {
        endpoint,
        method,
        status,
        ...context
      }
    })
  }

  // Utility method to log performance issues
  logPerformanceIssue(operation: string, duration: number, threshold: number, context?: Record<string, any>) {
    if (duration > threshold) {
      this.logWarning(`Performance issue: ${operation} took ${duration}ms (threshold: ${threshold}ms)`, {
        operation,
        duration,
        threshold,
        ...context
      })
    }
  }

  // Get current queue size (for debugging)
  getQueueSize(): number {
    return this.queue.length
  }

  // Get recent logs for monitoring
  getRecentLogs(maxLogs: number = 10): ErrorLog[] {
    return this.queue.slice(-maxLogs)
  }

  // Clear all logs
  clearLogs(): void {
    this.queue = []
  }

  // Get logs by severity
  getLogsBySeverity(severity: 'error' | 'warning' | 'info'): ErrorLog[] {
    return this.queue.filter(log => log.severity === severity)
  }
}

// Create singleton instance
export const errorLogger = new ErrorLoggingService()

// Convenience exports
export const logError = (message: string, error?: Error, context?: Record<string, any>) => {
  errorLogger.logError({
    message,
    stack: error?.stack,
    severity: 'error',
    context
  })
}

export const logWarning = (message: string, context?: Record<string, any>) => {
  errorLogger.logWarning(message, context)
}

export const logInfo = (message: string, context?: Record<string, any>) => {
  errorLogger.logInfo(message, context)
}

export default errorLogger
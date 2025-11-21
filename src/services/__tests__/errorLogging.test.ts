// Test script for error logging system

import { errorLogger, logError, logWarning, logInfo } from '../errorLogging'

// Test error logging functionality
export function testErrorLogging() {
  console.log('🧪 Testing Error Logging System...')
  
  // Test basic error logging
  logError('Test error message', new Error('Test error'), { test: true })
  
  // Test warning logging
  logWarning('Test warning message', { component: 'TestComponent' })
  
  // Test info logging
  logInfo('Test info message', { userId: 'test-user' })
  
  // Test API error logging
  errorLogger.logApiError('/api/test', 'GET', 500, 'Internal Server Error', { 
    userId: 'test-user',
    timestamp: new Date().toISOString()
  })
  
  // Test performance issue logging
  errorLogger.logPerformanceIssue('heavyOperation', 2500, 1000, {
    operation: 'dataProcessing',
    records: 10000
  })
  
  console.log('✅ Error logging tests completed')
  console.log(`📊 Current queue size: ${errorLogger.getQueueSize()}`)
}

// Test memory monitoring
export function testMemoryMonitoring() {
  console.log('🧪 Testing Memory Monitoring...')
  
  // Simulate memory usage
  // const largeArray = new Array(1000000).fill('test data')
  
  // Force garbage collection if available
  // if ((window as any).gc) {
  //   (window as any).gc()
  // }
  
  console.log('Memory usage:', {
    used: (performance as any).memory?.usedJSHeapSize,
    total: (performance as any).memory?.totalJSHeapSize,
    limit: (performance as any).memory?.jsHeapSizeLimit
  })
  
  console.log('✅ Memory monitoring tests completed')
}

// Test error boundary
export function testErrorBoundary() {
  console.log('🧪 Testing Error Boundary...')
  
  // Create a test error
  setTimeout(() => {
    throw new Error('Test error for error boundary')
  }, 1000)
  
  console.log('✅ Error boundary test initiated')
}

// Run all tests
export function runAllTests() {
  console.log('🚀 Starting comprehensive system tests...')
  
  try {
    testErrorLogging()
    testMemoryMonitoring()
    
    // Only test error boundary if explicitly requested
    // testErrorBoundary()
    
    console.log('🎉 All tests completed successfully!')
  } catch (error) {
    console.error('❌ Test failed:', error)
    logError('Test suite failed', error as Error)
  }
}

// Auto-run tests in development
// if (process.env.NODE_ENV === 'development') {
//   setTimeout(runAllTests, 2000)
// }
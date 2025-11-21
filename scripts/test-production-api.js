/**
 * Production API Test Script for AgroLink
 * Tests all messaging-related endpoints with proper authentication
 */

const PRODUCTION_ORIGIN = 'https://agro-link-jet.vercel.app'
const API_BASE = `${PRODUCTION_ORIGIN}/api`

// Test configuration
const TEST_CONFIG = {
  timeout: 15000,
  retries: 3,
  delayBetweenTests: 1000
}

// Test user credentials (should be valid test user)
const TEST_USER = {
  id: 'test-user-id',
  token: 'test-bearer-token'
}

/**
 * Helper function to make authenticated API requests
 */
async function makeApiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TEST_USER.token}`,
    ...options.headers
  }

  console.log(`[TEST] Making request to: ${url}`)
  console.log(`[TEST] Method: ${options.method || 'GET'}`)
  console.log(`[TEST] Headers:`, headers)

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(TEST_CONFIG.timeout)
    })

    console.log(`[TEST] Response status: ${response.status}`)
    console.log(`[TEST] Response statusText: ${response.statusText}`)

    const responseData = await response.text()
    let parsedData
    try {
      parsedData = JSON.parse(responseData)
      console.log(`[TEST] Response data:`, JSON.stringify(parsedData, null, 2))
    } catch {
      console.log(`[TEST] Response text: ${responseData}`)
      parsedData = { text: responseData }
    }

    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: parsedData,
      headers: Object.fromEntries(response.headers.entries())
    }
  } catch (error) {
    console.error(`[TEST] Request failed:`, error.message)
    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      data: { error: error.message },
      headers: {}
    }
  }
}

/**
 * Test CORS configuration
 */
async function testCorsConfiguration() {
  console.log('\n=== Testing CORS Configuration ===')
  
  const endpoints = [
    '/conversations',
    '/notifications',
    '/proxy/api/v1/conversations'
  ]

  for (const endpoint of endpoints) {
    console.log(`\n[TEST] Testing CORS for: ${endpoint}`)
    
    // Test preflight request
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'OPTIONS',
        headers: {
          'Origin': PRODUCTION_ORIGIN,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Authorization, Content-Type'
        }
      })

      console.log(`[TEST] CORS preflight status: ${response.status}`)
      console.log(`[TEST] CORS headers:`, {
        'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers'),
        'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials')
      })

      const allowedOrigin = response.headers.get('Access-Control-Allow-Origin')
      if (allowedOrigin === PRODUCTION_ORIGIN || allowedOrigin === '*') {
        console.log(`[TEST] ✓ CORS configuration is correct for ${endpoint}`)
      } else {
        console.log(`[TEST] ✗ CORS configuration issue for ${endpoint}`)
      }
    } catch (error) {
      console.error(`[TEST] CORS test failed for ${endpoint}:`, error.message)
    }
  }
}

/**
 * Test authentication validation
 */
async function testAuthenticationValidation() {
  console.log('\n=== Testing Authentication Validation ===')
  
  const endpoints = [
    '/conversations',
    '/notifications'
  ]

  for (const endpoint of endpoints) {
    console.log(`\n[TEST] Testing auth validation for: ${endpoint}`)
    
    // Test without authentication
    const responseNoAuth = await makeApiRequest(endpoint, {
      method: 'GET',
      headers: { 'Authorization': '' }
    })

    if (responseNoAuth.status === 401) {
      console.log(`[TEST] ✓ Authentication validation working for ${endpoint}`)
    } else {
      console.log(`[TEST] ✗ Authentication validation failed for ${endpoint}`)
    }

    // Test with invalid token
    const responseInvalidAuth = await makeApiRequest(endpoint, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer invalid-token' }
    })

    if (responseInvalidAuth.status === 401) {
      console.log(`[TEST] ✓ Invalid token validation working for ${endpoint}`)
    } else {
      console.log(`[TEST] ✗ Invalid token validation failed for ${endpoint}`)
    }
  }
}

/**
 * Test error handling for 403 and 500 errors
 */
async function testErrorHandling() {
  console.log('\n=== Testing Error Handling ===')
  
  // Test 403 error (should trigger permission denied)
  console.log('\n[TEST] Testing 403 error handling...')
  const response403 = await makeApiRequest('/conversations', {
    method: 'POST',
    body: JSON.stringify({
      buyer_id: 'invalid-user-id',
      seller_id: 'another-user-id',
      product_id: 'invalid-product-id'
    })
  })

  console.log(`[TEST] 403 response status: ${response403.status}`)
  if (response403.status === 403 && response403.data.debug?.message) {
    console.log(`[TEST] ✓ 403 error handling with detailed message`)
  } else {
    console.log(`[TEST] ✗ 403 error handling needs improvement`)
  }
}

/**
 * Test proxy configuration
 */
async function testProxyConfiguration() {
  console.log('\n=== Testing Proxy Configuration ===')
  
  const proxyEndpoints = [
    '/proxy/api/v1/notifications/by-user/test-user',
    '/proxy/api/v1/conversations',
    '/proxy/api/v1/utils/health'
  ]

  for (const endpoint of proxyEndpoints) {
    console.log(`\n[TEST] Testing proxy endpoint: ${endpoint}`)
    
    const response = await makeApiRequest(endpoint, {
      method: 'GET'
    })

    console.log(`[TEST] Proxy response status: ${response.status}`)
    if (response.success || response.status === 401) {
      console.log(`[TEST] ✓ Proxy endpoint accessible: ${endpoint}`)
    } else {
      console.log(`[TEST] ✗ Proxy endpoint failed: ${endpoint}`)
    }
  }
}

/**
 * Test timeout configuration
 */
async function testTimeoutConfiguration() {
  console.log('\n=== Testing Timeout Configuration ===')
  
  console.log(`[TEST] Proxy timeout: ${process.env.PROXY_TIMEOUT || 20000}ms`)
  console.log(`[TEST] Notifications timeout: ${process.env.NOTIFICATIONS_TIMEOUT || 9000}ms`)
  
  // Test with a potentially slow endpoint
  const startTime = Date.now()
  const response = await makeApiRequest('/proxy/api/v1/utils/health')
  const endTime = Date.now()
  
  console.log(`[TEST] Request completed in: ${endTime - startTime}ms`)
  if (endTime - startTime < TEST_CONFIG.timeout) {
    console.log(`[TEST] ✓ Request completed within timeout limits`)
  } else {
    console.log(`[TEST] ✗ Request took longer than expected`)
  }
}

/**
 * Main test execution
 */
async function runProductionTests() {
  console.log('🚀 Starting AgroLink Production API Tests')
  console.log(`Production URL: ${PRODUCTION_ORIGIN}`)
  console.log(`Test User: ${TEST_USER.id}`)
  
  try {
    await testCorsConfiguration()
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenTests))
    
    await testAuthenticationValidation()
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenTests))
    
    await testErrorHandling()
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenTests))
    
    await testProxyConfiguration()
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.delayBetweenTests))
    
    await testTimeoutConfiguration()
    
    console.log('\n✅ All production tests completed!')
  } catch (error) {
    console.error('\n❌ Test execution failed:', error)
  }
}

// Run tests if this script is executed directly
if (typeof window === 'undefined') {
  runProductionTests()
}
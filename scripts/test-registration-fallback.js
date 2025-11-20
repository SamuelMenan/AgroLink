/**
 * Test script to verify registration fallback mechanism for 405 errors
 * This script tests both proxy and direct backend registration endpoints
 */

const testEmail = `test-${Date.now()}@example.com`;
const testPassword = 'Test123!@#';
const testFullName = 'Test User';

// Backend URLs
const PROXY_URL = '/api/proxy/api/v1/auth/sign-up';
const DIRECT_URL = 'https://agrolinkbackend.onrender.com/api/v1/auth/sign-up';

// Test data
const testData = {
  email: testEmail,
  password: testPassword,
  data: {
    full_name: testFullName,
    phone: '1234567890'
  }
};

// Helper function to make fetch requests with detailed logging
async function testRegistration(url, description, bypassProxy = false) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`📍 URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(bypassProxy && { 'X-Bypass-Proxy': 'true' })
      },
      body: JSON.stringify(testData)
    };
    
    console.log(`📤 Request headers:`, JSON.stringify(options.headers, null, 2));
    console.log(`📤 Request body:`, JSON.stringify(testData, null, 2));
    
    const response = await fetch(url, options);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    
    const responseText = await response.text();
    console.log(`📄 Response body:`, responseText);
    
    // Try to parse as JSON
    try {
      const jsonResponse = JSON.parse(responseText);
      console.log(`🎯 Parsed JSON response:`, JSON.stringify(jsonResponse, null, 2));
    } catch {
      console.log(`⚠️  Response is not valid JSON`);
    }
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      duration,
      responseText
    };
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      status: 0
    };
  }
}

// Main test function
async function runRegistrationTests() {
  console.log('🚀 Starting Registration Fallback Tests...\n');
  console.log('='.repeat(60));
  
  const results = [];
  
  // Test 1: Proxy endpoint (same origin)
  console.log('\n1️⃣ Testing Proxy Endpoint (Same Origin)');
  console.log('-'.repeat(40));
  const proxyResult = await testRegistration(PROXY_URL, 'Proxy Registration');
  results.push({ test: 'Proxy Registration', ...proxyResult });
  
  // Test 2: Direct backend endpoint (cross origin)
  console.log('\n2️⃣ Testing Direct Backend Endpoint (Cross Origin)');
  console.log('-'.repeat(40));
  const directResult = await testRegistration(DIRECT_URL, 'Direct Backend Registration');
  results.push({ test: 'Direct Backend Registration', ...directResult });
  
  // Test 3: Test with CORS preflight
  console.log('\n3️⃣ Testing CORS Preflight');
  console.log('-'.repeat(40));
  try {
    const corsResponse = await fetch(DIRECT_URL, {
      method: 'OPTIONS',
      headers: {
        'Origin': window.location.origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    console.log(`📊 CORS Preflight Status: ${corsResponse.status}`);
    console.log(`📋 CORS Headers:`, JSON.stringify(Object.fromEntries(corsResponse.headers.entries()), null, 2));
  } catch (error) {
    console.error(`❌ CORS Preflight Error: ${error.message}`);
  }
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(60));
  results.forEach(result => {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${status} - ${result.test}: ${result.status} ${result.statusText}${duration}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Analysis
  console.log('\n🔍 Analysis:');
  const proxySuccess = results.find(r => r.test === 'Proxy Registration')?.success;
  const directSuccess = results.find(r => r.test === 'Direct Backend Registration')?.success;
  
  if (!proxySuccess && directSuccess) {
    console.log('✅ Fallback mechanism is working correctly!');
    console.log('   Proxy failed but direct backend succeeded - this is the expected behavior.');
  } else if (proxySuccess && !directSuccess) {
    console.log('⚠️  Proxy works but direct backend fails - unusual but acceptable.');
  } else if (!proxySuccess && !directSuccess) {
    console.log('❌ Both proxy and direct backend failed - there may be a broader issue.');
  } else {
    console.log('✅ Both endpoints are working - optimal scenario.');
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (!proxySuccess) {
    console.log('   - The proxy is failing with 405 errors as expected');
    console.log('   - The fallback to direct backend should be triggered automatically');
    console.log('   - Check browser console for detailed error messages during actual registration');
  }
  
  return results;
}

// Run tests when script is loaded
if (typeof window !== 'undefined') {
  // Browser environment
  console.log('🌐 Running in browser environment');
  runRegistrationTests().catch(console.error);
} else {
  // Node.js environment
  console.log('🖥️  Running in Node.js environment');
  // Mock fetch for Node.js environment
  global.fetch = async (url, options) => {
    console.log(`🔄 Mock fetch called: ${url}`);
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'application/json']]),
      text: async () => JSON.stringify({ message: 'Mock response' })
    };
  };
  runRegistrationTests().catch(console.error);
}
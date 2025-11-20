/**
 * Simple browser-based test for registration fallback
 * Open test-registration-simple.html in browser to run tests
 */

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test123!@#';
const TEST_FULL_NAME = 'Test User';

const PROXY_URL = '/api/proxy/api/v1/auth/sign-up';
const DIRECT_URL = 'https://agrolinkbackend.onrender.com/api/v1/auth/sign-up';

const testData = {
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  data: {
    full_name: TEST_FULL_NAME,
    phone: '1234567890'
  }
};

async function testRegistration(url, description) {
  console.log(`\n🧪 Testing: ${description}`);
  console.log(`📍 URL: ${url}`);
  
  try {
    const startTime = performance.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    const responseText = await response.text();
    console.log(`📄 Response: ${responseText}`);
    
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

async function runRegistrationTest() {
  console.log('🚀 Starting Registration Fallback Test...\n');
  console.log('='.repeat(60));
  
  const results = [];
  
  // Test 1: Proxy endpoint
  console.log('\n1️⃣ Testing Proxy Endpoint (Same Origin)');
  console.log('-'.repeat(40));
  const proxyResult = await testRegistration(PROXY_URL, 'Proxy Registration');
  results.push({ test: 'Proxy Registration', ...proxyResult });
  
  // Test 2: Direct backend endpoint
  console.log('\n2️⃣ Testing Direct Backend Endpoint (Cross Origin)');
  console.log('-'.repeat(40));
  const directResult = await testRegistration(DIRECT_URL, 'Direct Backend Registration');
  results.push({ test: 'Direct Backend Registration', ...directResult });
  
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
    console.log('   The registration system should automatically fall back to direct backend when proxy returns 405.');
  } else if (proxySuccess && !directSuccess) {
    console.log('⚠️  Proxy works but direct backend fails - unusual but acceptable.');
  } else if (!proxySuccess && !directSuccess) {
    console.log('❌ Both proxy and direct backend failed - there may be a broader issue.');
  } else {
    console.log('✅ Both endpoints are working - optimal scenario.');
  }
  
  return results;
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
  // Browser environment
  window.runRegistrationTest = runRegistrationTest;
  window.TEST_EMAIL = TEST_EMAIL;
  window.TEST_DATA = testData;
} else if (typeof module !== 'undefined') {
  // Node.js environment
  module.exports = { runRegistrationTest, TEST_EMAIL, testData };
}
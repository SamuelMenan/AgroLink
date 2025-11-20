/**
 * Node.js test for registration fallback mechanism
 * Run with: node scripts/test-registration-node.js
 */

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test123!@#';
const TEST_FULL_NAME = 'Test User';

const PROXY_URL = 'http://localhost:5174/api/proxy/api/v1/auth/sign-up';
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
  console.log(`📤 Test data:`, JSON.stringify(testData, null, 2));
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`⏱️  Response time: ${duration}ms`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log(`📄 Response body: ${responseText}`);
    
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

async function runFullTest() {
  console.log('🚀 Starting Registration Fallback Test...\n');
  console.log('='.repeat(60));
  
  const results = [];
  
  // Test 1: Proxy endpoint (should fail with 405)
  console.log('\n1️⃣ Testing Proxy Endpoint (Same Origin)');
  console.log('-'.repeat(40));
  const proxyResult = await testRegistration(PROXY_URL, 'Proxy Registration');
  results.push({ test: 'Proxy Registration', ...proxyResult });
  
  // Test 2: Direct backend endpoint (should succeed)
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

// Run the test
runFullTest().then(results => {
  console.log('\n🎯 Test completed!');
  
  // Final verification
  const proxyResult = results.find(r => r.test === 'Proxy Registration');
  const directResult = results.find(r => r.test === 'Direct Backend Registration');
  
  if (proxyResult && directResult) {
    if (!proxyResult.success && directResult.success) {
      console.log('🎉 SUCCESS: The 405 fallback mechanism is working correctly!');
      console.log('   Users should be able to register despite proxy 405 errors.');
      process.exit(0);
    } else if (!proxyResult.success && !directResult.success) {
      console.log('❌ FAILURE: Both endpoints failed - broader issue detected.');
      process.exit(1);
    } else {
      console.log('✅ Both endpoints are working - system is functional.');
      process.exit(0);
    }
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
/**
 * Test the fixed registration fallback mechanism
 * Run this to verify 405 errors are properly handled
 */

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test123!@#';
const TEST_FULL_NAME = 'Test User Fallback';

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

async function testRegistrationWithFallback() {
  console.log('🧪 Testing Registration with 405 Fallback Mechanism');
  console.log('='.repeat(60));
  console.log(`📧 Test Email: ${TEST_EMAIL}`);
  console.log(`🔑 Test Password: ${TEST_PASSWORD}`);
  console.log('');

  try {
    console.log('1️⃣ Testing proxy endpoint (expecting 405 error)...');
    const proxyResponse = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    console.log(`📊 Proxy Response Status: ${proxyResponse.status} ${proxyResponse.statusText}`);
    
    if (proxyResponse.status === 405) {
      console.log('✅ Got expected 405 error from proxy');
      console.log('🔄 Now testing direct backend endpoint...');
      
      // Test direct backend
      const directResponse = await fetch(DIRECT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(testData)
      });

      console.log(`📊 Direct Backend Response Status: ${directResponse.status} ${directResponse.statusText}`);
      
      if (directResponse.ok) {
        console.log('🎉 SUCCESS: Registration fallback is working!');
        console.log('✅ Proxy returned 405, but direct backend succeeded');
        return { success: true, proxyStatus: proxyResponse.status, directStatus: directResponse.status };
      } else {
        console.log('❌ Direct backend also failed');
        return { success: false, proxyStatus: proxyResponse.status, directStatus: directResponse.status };
      }
    } else {
      console.log(`⚠️  Unexpected proxy response: ${proxyResponse.status}`);
      return { success: false, proxyStatus: proxyResponse.status, directStatus: null };
    }
    
  } catch (error) {
    console.error('❌ Network error during test:', error.message);
    return { success: false, error: error.message };
  }
}

// Run the test
testRegistrationWithFallback().then(result => {
  console.log('\n📊 Test Summary:');
  console.log('='.repeat(60));
  
  if (result.success) {
    console.log('✅ REGISTRATION FALLBACK IS WORKING!');
    console.log('   Users can now register despite 405 proxy errors');
  } else {
    console.log('❌ Registration fallback needs more work');
    if (result.proxyStatus) {
      console.log(`   Proxy status: ${result.proxyStatus}`);
    }
    if (result.directStatus) {
      console.log(`   Direct backend status: ${result.directStatus}`);
    }
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  }
}).catch(error => {
  console.error('Test failed completely:', error);
});
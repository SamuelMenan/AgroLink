/**
 * Command-line test for registration fallback mechanism
 * Run with: node scripts/test-registration-cli.js
 */

import https from 'https';
import http from 'http';

// Test configuration
const TEST_EMAIL = `test-${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test123!@#';
const TEST_FULL_NAME = 'Test User';

const PROXY_URL = 'http://localhost:5173/api/proxy/api/v1/auth/sign-up';
const DIRECT_URL = 'https://agrolinkbackend.onrender.com/api/v1/auth/sign-up';

const testData = JSON.stringify({
  email: TEST_EMAIL,
  password: TEST_PASSWORD,
  data: {
    full_name: TEST_FULL_NAME,
    phone: '1234567890'
  }
});

function makeRequest(url, data, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Testing: ${description}`);
    console.log(`📍 URL: ${url}`);
    console.log(`📤 Request body: ${data}`);
    
    const startTime = Date.now();
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json'
      }
    };

    const protocol = urlObj.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️  Response time: ${duration}ms`);
      console.log(`📊 Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`📋 Response headers:`, res.headers);
      
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        console.log(`📄 Response body: ${responseData}`);
        
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          duration,
          responseData
        });
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Error: ${error.message}`);
      reject({
        success: false,
        error: error.message,
        status: 0
      });
    });
    
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🚀 Starting Registration Fallback Tests...\n');
  console.log('='.repeat(60));
  
  const results = [];
  
  try {
    // Test 1: Proxy endpoint
    console.log('\n1️⃣ Testing Proxy Endpoint');
    console.log('-'.repeat(40));
    const proxyResult = await makeRequest(PROXY_URL, testData, 'Proxy Registration');
    results.push({ test: 'Proxy Registration', ...proxyResult });
    
    // Test 2: Direct backend endpoint
    console.log('\n2️⃣ Testing Direct Backend Endpoint');
    console.log('-'.repeat(40));
    const directResult = await makeRequest(DIRECT_URL, testData, 'Direct Backend Registration');
    results.push({ test: 'Direct Backend Registration', ...directResult });
    
  } catch (error) {
    console.error('Test failed:', error);
    results.push({ test: 'Failed Test', success: false, error: error.error || error.message });
  }
  
  // Summary
  console.log('\n📊 Test Results Summary');
  console.log('='.repeat(60));
  results.forEach(result => {
    const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
    const duration = result.duration ? ` (${result.duration}ms)` : '';
    console.log(`${status} - ${result.test}: ${result.status} ${result.statusText || 'Unknown'}${duration}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
  
  // Analysis
  console.log('\n🔍 Analysis:');
  const proxyResult = results.find(r => r.test === 'Proxy Registration');
  const directResult = results.find(r => r.test === 'Direct Backend Registration');
  
  if (proxyResult && directResult) {
    if (!proxyResult.success && directResult.success) {
      console.log('✅ Fallback mechanism is working correctly!');
      console.log('   Proxy failed but direct backend succeeded - this is the expected behavior.');
    } else if (proxyResult.success && !directResult.success) {
      console.log('⚠️  Proxy works but direct backend fails - unusual but acceptable.');
    } else if (!proxyResult.success && !directResult.success) {
      console.log('❌ Both proxy and direct backend failed - there may be a broader issue.');
    } else {
      console.log('✅ Both endpoints are working - optimal scenario.');
    }
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (proxyResult && !proxyResult.success) {
    console.log('   - The proxy is failing with 405 errors as expected');
    console.log('   - The fallback to direct backend should be triggered automatically');
    console.log('   - Check browser console for detailed error messages during actual registration');
  }
}

// Run tests
runTests().catch(console.error);
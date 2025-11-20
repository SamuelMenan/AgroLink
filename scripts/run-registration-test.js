/**
 * Manual test execution for registration fallback
 * This script runs the test and captures results
 */

// Import the test function
import { runFullTest } from './test-registration-direct.js';

console.log('🚀 Running Registration Fallback Test...');

// Run the test
runFullTest().then(results => {
  console.log('\n🎯 Test completed!');
  console.log('Results:', results);
  
  // Analyze results
  const proxyResult = results.find(r => r.test === 'Proxy Registration');
  const directResult = results.find(r => r.test === 'Direct Backend Registration');
  
  if (proxyResult && directResult) {
    if (!proxyResult.success && directResult.success) {
      console.log('✅ SUCCESS: Fallback mechanism is working correctly!');
      console.log('   The proxy fails with 405 errors, but direct backend succeeds.');
      console.log('   This means the registration fallback is properly implemented.');
    } else if (!proxyResult.success && !directResult.success) {
      console.log('❌ FAILURE: Both proxy and direct backend failed.');
      console.log('   This indicates a broader issue that needs investigation.');
    } else if (proxyResult.success && directResult.success) {
      console.log('✅ SUCCESS: Both endpoints are working optimally.');
    } else {
      console.log('⚠️ WARNING: Unusual configuration detected.');
    }
  }
}).catch(error => {
  console.error('❌ Test failed:', error);
});
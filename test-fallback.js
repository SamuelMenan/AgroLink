// Test script to verify fallback mechanisms
// Run this in browser console on production site

(function testFallbackMechanisms() {
  console.log('=== Testing Fallback Mechanisms ===');
  
  // Test 1: Verify enhanced logging is present
  console.log('Test 1: Checking if enhanced logging is active...');
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  
  let logCount = 0;
  let warnCount = 0;
  let errorCount = 0;
  
  console.log = function(...args) {
    originalConsoleLog.apply(console, args);
    if (args[0] && args[0].includes && args[0].includes('[apiFetch]')) {
      logCount++;
    }
  };
  
  console.warn = function(...args) {
    originalConsoleWarn.apply(console, args);
    if (args[0] && args[0].includes && args[0].includes('[apiFetch]')) {
      warnCount++;
    }
  };
  
  console.error = function(...args) {
    originalConsoleError.apply(console, args);
    if (args[0] && args[0].includes && args[0].includes('[apiFetch]')) {
      errorCount++;
    }
  };
  
  // Test 2: Force a 502 error to trigger fallback
  console.log('Test 2: Testing fallback mechanism...');
  
  // Override fetch to simulate 502 error
  const originalFetch = window.fetch;
  let fallbackTriggered = false;
  let directFetchAttempted = false;
  
  window.fetch = function(url, options) {
    console.log('[Test] Fetch intercepted:', url);
    
    // Simulate 502 error for proxy requests
    if (url.includes('/api/proxy/')) {
      console.log('[Test] Simulating 502 error for proxy request');
      return Promise.resolve(new Response(null, { 
        status: 502, 
        statusText: 'Bad Gateway',
        headers: new Headers()
      }));
    }
    
    // Track direct backend attempts
    if (url.includes('https://agrolinkbackend.onrender.com')) {
      console.log('[Test] Direct backend fetch detected!');
      directFetchAttempted = true;
      fallbackTriggered = true;
      // Return successful response for direct fetch
      return Promise.resolve(new Response(JSON.stringify({ test: 'success' }), { 
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'Content-Type': 'application/json' })
      }));
    }
    
    return originalFetch.apply(this, arguments);
  };
  
  // Test 3: Make an actual API call
  console.log('Test 3: Making test API call...');
  
  // Import the apiFetch function dynamically
  import('/src/services/apiClient.ts').then(module => {
    const { apiFetch } = module;
    
    return apiFetch('/api/v1/conversations/test', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
  }).then(response => {
    console.log('Test API call completed:', response);
    console.log('Fallback triggered:', fallbackTriggered);
    console.log('Direct fetch attempted:', directFetchAttempted);
    console.log('Enhanced logs captured:', { logCount, warnCount, errorCount });
    
    // Restore original functions
    window.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
    
    console.log('=== Test Results ===');
    console.log('✅ Fallback mechanism:', fallbackTriggered ? 'WORKING' : 'NOT WORKING');
    console.log('✅ Direct fetch attempt:', directFetchAttempted ? 'WORKING' : 'NOT WORKING');
    console.log('✅ Enhanced logging:', logCount > 0 ? 'WORKING' : 'NOT WORKING');
    
    if (fallbackTriggered && directFetchAttempted) {
      console.log('🎉 SUCCESS: Fallback mechanisms are working correctly!');
    } else {
      console.log('❌ ISSUE: Fallback mechanisms need investigation');
    }
    
  }).catch(error => {
    console.error('Test failed:', error);
    
    // Restore original functions
    window.fetch = originalFetch;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });
  
})();
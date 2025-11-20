// Manual verification script for production
// Copy and paste this into browser console on https://agro-link-jet.vercel.app

console.log('=== MANUAL FALLBACK VERIFICATION ===');

// Step 1: Check if enhanced logging is working
console.log('Step 1: Checking enhanced logging...');
console.log('Look for [apiFetch] logs in the next API call');

// Step 2: Monitor network requests
console.log('Step 2: Monitoring network requests...');
const originalFetch = window.fetch;
let proxyRequests = 0;
let directRequests = 0;
let fallbackTriggered = false;

window.fetch = function(url, options) {
  console.log(`[Monitor] Fetch: ${url}`);
  
  if (url.includes('/api/proxy/')) {
    proxyRequests++;
    console.log(`[Monitor] Proxy request #${proxyRequests}`);
  }
  
  if (url.includes('agrolinkbackend.onrender.com')) {
    directRequests++;
    fallbackTriggered = true;
    console.log(`[Monitor] 🎯 DIRECT BACKEND REQUEST #${directRequests} - FALLBACK TRIGGERED!`);
  }
  
  return originalFetch.apply(this, arguments);
};

// Step 3: Test with a simple conversation list request
console.log('Step 3: Testing conversation list...');
fetch('/api/proxy/api/v1/conversations/by-user/test-user-id')
  .then(response => {
    console.log('Response received:', response.status, response.statusText);
    return response.json().catch(() => ({ error: 'No JSON response' }));
  })
  .then(data => {
    console.log('Data received:', data);
    console.log('=== RESULTS ===');
    console.log(`Proxy requests: ${proxyRequests}`);
    console.log(`Direct requests: ${directRequests}`);
    console.log(`Fallback triggered: ${fallbackTriggered ? '✅ YES' : '❌ NO'}`);
    
    if (fallbackTriggered) {
      console.log('🎉 SUCCESS! Fallback mechanism is working!');
      console.log('The system successfully bypassed the failing proxy.');
    } else {
      console.log('⚠️  Fallback not triggered - either proxy worked or fallback failed');
    }
    
    // Restore fetch
    window.fetch = originalFetch;
  })
  .catch(error => {
    console.error('Request failed:', error);
    console.log('=== RESULTS ===');
    console.log(`Proxy requests: ${proxyRequests}`);
    console.log(`Direct requests: ${directRequests}`);
    console.log(`Fallback triggered: ${fallbackTriggered ? '✅ YES' : '❌ NO'}`);
    
    // Restore fetch
    window.fetch = originalFetch;
  });

console.log('Script executed. Check network tab and console for results.');
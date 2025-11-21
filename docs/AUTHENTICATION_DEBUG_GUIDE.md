# AgroLink Authentication Debug Guide

## Problem: 403 Error When Sending Messages

The error "No tienes permisos para crear esta conversación. Por favor, verifica que estás autenticado." indicates an authentication issue.

## Debug Steps

### 1. Test Authentication Token

Use the new debug endpoint to check your token:

```bash
# Replace YOUR_TOKEN with your actual bearer token
curl -X GET \
  -H "Authorization: Bearer YOUR_TOKEN" \
  https://agro-link-jet.vercel.app/api/debug/auth
```

Expected response:
```json
{
  "debug": {
    "tokenLength": 500,
    "tokenPreview": "eyJhbGciOiJIUzI1NiIs...",
    "tokenParts": 3,
    "isAnonymousToken": false,
    "hasValidFormat": true,
    "userId": "your-user-id",
    "payloadKeys": ["sub", "email", "iat", "exp"],
    "tokenExpiration": "2024-12-21T10:30:00.000Z",
    "tokenIssued": "2024-11-21T10:30:00.000Z"
  },
  "timestamp": "2024-11-21T10:30:00.000Z"
}
```

### 2. Common Token Issues

#### Issue: Invalid JWT Format
**Symptom**: `tokenParts` is not 3
**Solution**: Token is malformed, user needs to re-authenticate

#### Issue: Anonymous Token
**Symptom**: `isAnonymousToken` is true
**Solution**: User is using anon key, needs to login properly

#### Issue: Token Expired
**Symptom**: `tokenExpiration` is in the past
**Solution**: Token needs refresh, implement token refresh logic

#### Issue: Cannot Decode JWT
**Symptom**: Missing `userId` or `decodeError`
**Solution**: Check token encoding, may need base64 padding fix

### 3. Test Conversation Creation

After verifying token is valid, test conversation creation:

```bash
# Test with your actual user IDs and token
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "buyer_id": "YOUR_USER_ID",
    "seller_id": "SELLER_USER_ID",
    "product_id": "PRODUCT_ID",
    "initial_message": "Hola. ¿Sigue estando disponible?"
  }' \
  https://agro-link-jet.vercel.app/api/conversations
```

### 4. Check Server Logs

Monitor the server logs for detailed error information:

```bash
# Look for these log patterns:
[CONVERSATIONS-XXXXX] Starting request:
[CONVERSATIONS-XXXXX] JWT decoded successfully:
[CONVERSATIONS-XXXXX] buyer_id does not match authenticated user id
[CONVERSATIONS-XXXXX] Could not decode JWT, but allowing request to proceed
```

### 5. Frontend Token Validation

Add this debug code to your frontend to check token before sending:

```javascript
// Add this to your messaging service before createConversation
const token = getAccessToken()
console.log('Token debug:', {
  hasToken: !!token,
  tokenLength: token?.length,
  tokenParts: token?.split('.')?.length,
  isAnonymous: token === process.env.VITE_SUPABASE_ANON_KEY
})

if (token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    console.log('Token payload:', payload)
  } catch (e) {
    console.error('Token decode error:', e)
  }
}
```

## Quick Fixes

### Fix 1: Force Token Refresh
```javascript
// Clear stored token and force re-authentication
localStorage.removeItem('agrolink_access_token')
// Redirect to login or refresh token
```

### Fix 2: Check User ID Mismatch
The most common issue is `buyer_id` not matching the authenticated user ID.

```javascript
// Ensure buyer_id matches the token user ID
const payload = JSON.parse(atob(token.split('.')[1]))
const currentUserId = payload.sub || payload.user_id || payload.id

// Use this ID as buyer_id
const conversationData = {
  buyer_id: currentUserId, // Make sure this matches!
  seller_id: participantId,
  product_id: productId,
  initial_message: initialMessage
}
```

### Fix 3: Test with Debug Mode
Enable debug logging in production:

```bash
# In your Vercel environment variables
ENABLE_PRODUCTION_LOGGING=true
```

## Success Indicators

✅ **Token Valid**: Debug endpoint shows valid JWT with userId
✅ **Auth Working**: No 401 errors in console
✅ **Permissions OK**: No 403 errors when buyer_id matches token userId
✅ **Conversation Created**: 201 response with conversation data

## Emergency Override

If you need to test without JWT validation (development only):

```javascript
// In conversations.js, temporarily comment out:
// if (authUserId && authUserId !== buyer_id) {
//   return res.status(403).json({...})
// }
```

**⚠️ WARNING**: Remove this override in production!

## Need Help?

If issues persist after following this guide:

1. Run the debug endpoint and share the response
2. Check browser console for token information
3. Share the exact error message and status code
4. Verify your user ID matches the token user ID
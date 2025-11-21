# AgroLink Production Deployment Checklist

## Pre-Deployment Verification

### 1. Environment Variables ✅
- [x] `BACKEND_URL=https://agrolinkbackend.onrender.com`
- [x] `VITE_BACKEND_URL=https://agrolinkbackend.onrender.com`
- [x] `VITE_SUPABASE_URL` configured
- [x] `VITE_SUPABASE_ANON_KEY` configured
- [x] Production CORS origins configured
- [x] API timeouts configured (20s proxy, 9s notifications)

### 2. CORS Configuration ✅
- [x] Production origin `https://agro-link-jet.vercel.app` allowed
- [x] Development origins (`localhost:5173`, `localhost:4173`) allowed
- [x] Credentials support enabled
- [x] Proper preflight handling

### 3. Authentication Validation ✅
- [x] Bearer token validation enhanced
- [x] Detailed error messages for 401 errors
- [x] Token format validation
- [x] Anonymous key rejection

### 4. Error Handling ✅
- [x] Enhanced 403 error messages
- [x] Enhanced 401 error messages
- [x] Enhanced 500 error messages
- [x] Detailed debug information
- [x] Production logging enabled

### 5. API Endpoints Configuration ✅
- [x] Proxy function timeout: 20 seconds
- [x] Notifications function timeout: 9 seconds
- [x] Retry logic with exponential backoff
- [x] Function consolidation completed (8 functions)

## Post-Deployment Testing

### 1. CORS Testing
```bash
# Test CORS preflight
curl -X OPTIONS \
  -H "Origin: https://agro-link-jet.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type" \
  https://agro-link-jet.vercel.app/api/conversations
```

### 2. Authentication Testing
```bash
# Test without authentication
curl -X GET \
  https://agro-link-jet.vercel.app/api/conversations

# Test with invalid token
curl -X GET \
  -H "Authorization: Bearer invalid-token" \
  https://agro-link-jet.vercel.app/api/conversations
```

### 3. Messaging System Testing
```bash
# Test conversation creation
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  -d '{
    "buyer_id": "user1",
    "seller_id": "user2",
    "product_id": "product123",
    "initial_message": "Hola. ¿Sigue estando disponible?"
  }' \
  https://agro-link-jet.vercel.app/api/conversations

# Test getting conversations
curl -X GET \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  "https://agro-link-jet.vercel.app/api/conversations?user_id=user1"
```

### 4. Notifications Testing
```bash
# Test notifications endpoint
curl -X GET \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  "https://agro-link-jet.vercel.app/api/notifications?user_id=user1&limit=10"

# Test mark as read
curl -X PATCH \
  -H "Authorization: Bearer YOUR_VALID_TOKEN" \
  "https://agro-link-jet.vercel.app/api/notifications?user_id=user1"
```

## Error Monitoring

### 1. Console Logging
- Monitor browser console for detailed error messages
- Check Vercel function logs for server-side errors
- Verify error details include timestamps and origin information

### 2. Common Error Scenarios
- **403 Forbidden**: Check user permissions and conversation participation
- **401 Unauthorized**: Verify token validity and expiration
- **500 Internal Server**: Check backend connectivity and database status
- **502 Bad Gateway**: Verify proxy configuration and backend availability

### 3. Debugging Information
All error responses now include:
- Detailed error messages in Spanish
- HTTP status codes
- Timestamp information
- Origin details
- Debug information for 403/401 errors

## Performance Monitoring

### 1. Timeout Configuration
- Proxy requests: 20 seconds with 4 retry attempts
- Notifications: 9 seconds with 3 retry attempts
- Exponential backoff with jitter to prevent thundering herd

### 2. Backend Health
- Monitor Render backend status at `https://agrolinkbackend.onrender.com`
- Check health endpoint: `https://agro-link-jet.vercel.app/api/utils?action=health`
- Verify warmup endpoint: `https://agro-link-jet.vercel.app/api/utils?action=warm`

## Rollback Plan

If issues are detected:
1. Check Vercel deployment logs for errors
2. Verify environment variables are correctly set
3. Test individual API endpoints using the test script
4. Rollback to previous deployment if necessary
5. Contact backend team if Render services are down

## Success Criteria

✅ All API requests complete without 500/502 errors
✅ CORS preflight requests succeed from production origin
✅ Authentication validation works correctly
✅ Messaging system creates conversations successfully
✅ Notifications load without errors
✅ Error messages are user-friendly and in Spanish
✅ All timeouts are respected without hanging requests
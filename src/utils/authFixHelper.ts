/**
 * Authentication Fix Helper for AgroLink
 * This script helps fix the anonymous token issue
 */

// Step 1: Check current authentication status
export function checkAuthStatus() {
  const token = localStorage.getItem('agrolink_access_token')
  
  if (!token) {
    console.log('❌ No token found in localStorage')
    return { isValid: false, error: 'No token' }
  }
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { isValid: false, error: 'Invalid JWT format' }
    }
    
    // Fix base64 decoding
    const payloadStr = parts[1]
    const paddedPayload = payloadStr + '='.repeat((4 - payloadStr.length % 4) % 4)
    const payload = JSON.parse(atob(paddedPayload))
    
    console.log('🔍 Token Analysis:', {
      role: payload.role,
      hasUserId: !!(payload.sub || payload.user_id || payload.id),
      userId: payload.sub || payload.user_id || payload.id,
      isAnonymous: payload.role === 'anon',
      expiration: payload.exp ? new Date(payload.exp * 1000).toISOString() : null
    })
    
    if (payload.role === 'anon') {
      return { 
        isValid: false, 
        error: 'Anonymous token - user needs proper authentication',
        details: { role: 'anon' }
      }
    }
    
    if (!(payload.sub || payload.user_id || payload.id)) {
      return { 
        isValid: false, 
        error: 'No user ID in token',
        details: { payload }
      }
    }
    
    return {
      isValid: true,
      userId: payload.sub || payload.user_id || payload.id,
      role: payload.role,
      payload
    }
    
  } catch (error) {
    console.error('❌ Token decode error:', error)
    return { isValid: false, error: error.message }
  }
}

// Step 2: Fix authentication by getting proper user token
export async function fixAuthentication(supabase) {
  console.log('🔄 Attempting to fix authentication...')
  
  try {
    // Check current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError)
      return { success: false, error: sessionError.message }
    }
    
    if (!session) {
      console.log('❌ No active session found')
      return { success: false, error: 'No active session' }
    }
    
    console.log('✅ Found session:', {
      hasAccessToken: !!session.access_token,
      userId: session.user?.id,
      userEmail: session.user?.email
    })
    
    // Validate the session token
    if (session.access_token) {
      const tokenValidation = validateToken(session.access_token)
      
      if (tokenValidation.isValid && tokenValidation.role === 'authenticated') {
        // Store the correct token
        localStorage.setItem('agrolink_access_token', session.access_token)
        console.log('✅ Stored valid user token')
        
        return {
          success: true,
          userId: tokenValidation.userId,
          token: session.access_token
        }
      } else {
        console.log('❌ Session token is invalid or anonymous')
      }
    }
    
    return { success: false, error: 'Session token is not valid for messaging' }
    
  } catch (error) {
    console.error('❌ Authentication fix failed:', error)
    return { success: false, error: error.message }
  }
}

// Step 3: Validate token
function validateToken(token) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return { isValid: false, error: 'Invalid JWT format' }
    }
    
    const payloadStr = parts[1]
    const paddedPayload = payloadStr + '='.repeat((4 - payloadStr.length % 4) % 4)
    const payload = JSON.parse(atob(paddedPayload))
    
    return {
      isValid: true,
      role: payload.role,
      userId: payload.sub || payload.user_id || payload.id,
      payload
    }
    
  } catch (error) {
    return { isValid: false, error: error.message }
  }
}

// Step 4: Force re-authentication if needed
export async function forceReAuthentication(supabase) {
  console.log('🔄 Forcing re-authentication...')
  
  try {
    // Clear current token
    localStorage.removeItem('agrolink_access_token')
    
    // Sign out current user
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      console.error('❌ Sign out error:', signOutError)
    }
    
    console.log('✅ Cleared authentication state')
    console.log('📝 Please sign in again to get proper authentication')
    
    return { success: true, message: 'Please sign in again' }
    
  } catch (error) {
    console.error('❌ Force re-authentication failed:', error)
    return { success: false, error: error.message }
  }
}

// Step 5: Complete authentication fix flow
export async function completeAuthFix(supabase) {
  console.log('🚀 Starting complete authentication fix...')
  
  // Step 1: Check current status
  const currentStatus = checkAuthStatus()
  console.log('Current auth status:', currentStatus)
  
  if (currentStatus.isValid && currentStatus.role === 'authenticated') {
    console.log('✅ Authentication is already correct')
    return { success: true, alreadyFixed: true, userId: currentStatus.userId }
  }
  
  // Step 2: Try to fix with existing session
  const fixResult = await fixAuthentication(supabase)
  if (fixResult.success) {
    return fixResult
  }
  
  // Step 3: Force re-authentication if needed
  console.log('🔄 Existing session fix failed, forcing re-authentication...')
  const forceResult = await forceReAuthentication(supabase)
  
  return {
    success: true,
    needsReAuth: true,
    message: 'Please sign in again to get proper authentication for messaging'
  }
}

// Usage example:
/*
import { createClient } from '@supabase/supabase-js'
import { completeAuthFix, checkAuthStatus } from './authFixHelper'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Before sending messages, check and fix authentication
const authStatus = checkAuthStatus()
if (!authStatus.isValid) {
  console.log('Authentication issue detected:', authStatus.error)
  
  const fixResult = await completeAuthFix(supabase)
  if (fixResult.needsReAuth) {
    // Redirect to login page
    window.location.href = '/login'
    return
  }
}

// Now you can safely create conversations
const { userId } = checkAuthStatus()
if (userId) {
  // Create conversation with proper user ID
  await createConversation({
    participantId: sellerId,
    productId: productId,
    initialMessage: 'Hola. ¿Sigue estando disponible?'
  })
}
*/
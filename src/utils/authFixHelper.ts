/**
 * Authentication Fix Helper for AgroLink
 * This script helps fix the anonymous token issue
 * Works with existing apiAuth service
 */

import { getAccessToken, getRefreshToken, clearTokens } from '../services/apiAuth'

interface AuthStatus {
  isValid: boolean
  error?: string
  userId?: string
  role?: string
  details?: any
}

interface FixResult {
  success: boolean
  userId?: string
  token?: string
  alreadyFixed?: boolean
  needsReAuth?: boolean
  message?: string
  error?: string
}

// Step 1: Check current authentication status
export function checkAuthStatus(): AuthStatus {
  const token = getAccessToken()
  
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
      role: payload.role
    }
    
  } catch (error: any) {
    console.error('❌ Token decode error:', error)
    return { isValid: false, error: error.message }
  }
}

// Step 2: Fix authentication by getting proper user token
export async function fixAuthentication(): Promise<FixResult> {
  console.log('🔄 Attempting to fix authentication...')
  
  try {
    // For this debug version, we'll use a simplified approach
    // Check if we have a refresh token
    const refreshToken = getRefreshToken()
    
    if (!refreshToken) {
      console.log('❌ No refresh token found')
      return { success: false, error: 'No refresh token' }
    }
    
    console.log('✅ Found refresh token, attempting to get new access token')
    
    // Try to refresh the session (this would normally call refreshSession from apiAuth)
    // For now, we'll just indicate that re-authentication is needed
    return { success: false, error: 'Please sign in again to refresh your authentication' }
    
  } catch (error: any) {
    console.error('❌ Authentication fix failed:', error)
    return { success: false, error: error.message }
  }
}

// Step 3: Validate token (currently unused but kept for reference)
// function validateToken(token: string): TokenValidation {
//   try {
//     const parts = token.split('.')
//     if (parts.length !== 3) {
//       return { isValid: false, error: 'Invalid JWT format' }
//     }
//     
//     const payloadStr = parts[1]
//     const paddedPayload = payloadStr + '='.repeat((4 - payloadStr.length % 4) % 4)
//     const payload = JSON.parse(atob(paddedPayload))
//     
//     return {
//       isValid: true,
//       role: payload.role,
//       userId: payload.sub || payload.user_id || payload.id,
//       payload
//     }
//     
//   } catch (error: any) {
//     return { isValid: false, error: error.message }
//   }
// }

// Step 4: Force re-authentication if needed
export async function forceReAuthentication(): Promise<FixResult> {
  console.log('🔄 Forcing re-authentication...')
  
  try {
    // Clear current tokens
    clearTokens()
    
    console.log('✅ Cleared authentication state')
    console.log('📝 Please sign in again to get proper authentication')
    
    return { success: true, message: 'Please sign in again' }
    
  } catch (error: any) {
    console.error('❌ Force re-authentication failed:', error)
    return { success: false, error: error.message }
  }
}

// Step 5: Complete authentication fix flow
export async function completeAuthFix(): Promise<FixResult> {
  console.log('🚀 Starting complete authentication fix...')
  
  // Step 1: Check current status
  const currentStatus = checkAuthStatus()
  console.log('Current auth status:', currentStatus)
  
  if (currentStatus.isValid && currentStatus.role === 'authenticated') {
    console.log('✅ Authentication is already correct')
    return { success: true, alreadyFixed: true, userId: currentStatus.userId }
  }
  
  // Step 2: Try to fix with existing session
  const fixResult = await fixAuthentication()
  if (fixResult.success) {
    return fixResult
  }
  
  // Step 3: Force re-authentication if needed
  console.log('🔄 Existing session fix failed, forcing re-authentication...')
  await forceReAuthentication()
  
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
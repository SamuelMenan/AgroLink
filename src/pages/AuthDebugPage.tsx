import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-co'
import { checkAuthStatus, completeAuthFix } from '../utils/authFixHelper'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export default function AuthDebugPage() {
  const [authStatus, setAuthStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [fixResult, setFixResult] = useState(null)

  useEffect(() => {
    checkCurrentAuth()
  }, [])

  const checkCurrentAuth = async () => {
    setIsLoading(true)
    const status = checkAuthStatus()
    setAuthStatus(status)
    setIsLoading(false)
  }

  const handleFixAuth = async () => {
    setIsLoading(true)
    const result = await completeAuthFix(supabase)
    setFixResult(result)
    
    // Recheck status after fix
    setTimeout(async () => {
      await checkCurrentAuth()
      setIsLoading(false)
    }, 1000)
  }

  const handleTestMessage = async () => {
    setIsLoading(true)
    try {
      const status = checkAuthStatus()
      if (!status.isValid) {
        alert('Authentication issue: ' + status.error)
        return
      }

      // Test conversation creation
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('agrolink_access_token')}`
        },
        body: JSON.stringify({
          buyer_id: status.userId,
          seller_id: 'test-seller-id',
          product_id: 'test-product-id',
          initial_message: 'Test message from debug page'
        })
      })

      const result = await response.json()
      console.log('Test result:', result)
      
      if (response.ok) {
        alert('✅ Message sent successfully!')
      } else {
        alert('❌ Error: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Test error:', error)
      alert('❌ Test failed: ' + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">🔧 AgroLink Authentication Debug</h1>
        
        <div className="space-y-6">
          {/* Current Status */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Current Authentication Status</h2>
            {isLoading ? (
              <div className="text-gray-600">Checking...</div>
            ) : authStatus ? (
              <div className="space-y-2">
                <div className={`flex items-center space-x-2 ${authStatus.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  <span className="text-2xl">{authStatus.isValid ? '✅' : '❌'}</span>
                  <span className="font-medium">
                    {authStatus.isValid ? 'Valid Authentication' : 'Authentication Issue'}
                  </span>
                </div>
                
                {authStatus.details && (
                  <div className="mt-3 p-3 bg-white rounded border">
                    <h3 className="font-medium mb-2">Details:</h3>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(authStatus.details, null, 2)}
                    </pre>
                  </div>
                )}
                
                {authStatus.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                    <strong className="text-red-800">Error:</strong>
                    <p className="text-red-700 mt-1">{authStatus.error}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-600">No status available</div>
            )}
          </div>

          {/* Fix Authentication */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Fix Authentication</h2>
            <p className="text-gray-600 mb-4">
              Click this button to attempt fixing authentication issues
            </p>
            <button
              onClick={handleFixAuth}
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Fixing...' : 'Fix Authentication'}
            </button>
            
            {fixResult && (
              <div className="mt-3 p-3 bg-white rounded border">
                <h3 className="font-medium mb-2">Fix Result:</h3>
                <pre className="text-sm text-gray-700">
                  {JSON.stringify(fixResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Test Messaging */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Test Message Sending</h2>
            <p className="text-gray-600 mb-4">
              Test if you can send messages with current authentication
            </p>
            <button
              onClick={handleTestMessage}
              disabled={isLoading || !authStatus?.isValid}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {isLoading ? 'Testing...' : 'Test Send Message'}
            </button>
          </div>

          {/* Manual Token Input */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Manual Token Test</h2>
            <p className="text-gray-600 mb-4">
              Test with a specific token (for debugging)
            </p>
            <div className="space-y-3">
              <textarea
                className="w-full p-2 border rounded text-sm"
                rows={3}
                placeholder="Paste JWT token here..."
                id="manualToken"
              />
              <button
                onClick={() => {
                  const token = document.getElementById('manualToken').value
                  if (token) {
                    localStorage.setItem('agrolink_access_token', token)
                    checkCurrentAuth()
                    alert('Token saved - check status above')
                  }
                }}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
              >
                Test Manual Token
              </button>
            </div>
          </div>

          {/* Environment Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Environment Info</h2>
            <div className="space-y-2 text-sm">
              <div><strong>Supabase URL:</strong> {import.meta.env.VITE_SUPABASE_URL}</div>
              <div><strong>Backend URL:</strong> {import.meta.env.VITE_BACKEND_URL}</div>
              <div><strong>Current Origin:</strong> {window.location.origin}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
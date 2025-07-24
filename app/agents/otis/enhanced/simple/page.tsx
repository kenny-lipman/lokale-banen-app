"use client"

import { useState, useEffect } from 'react'
import { WorkflowProvider } from '@/contexts/otis-workflow-context'
import { OtisErrorBoundary } from '@/components/otis/ErrorBoundary'

// Simplified dashboard without complex components
function SimpleOtisDashboard() {
  const [sessionId, setSessionId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('SimpleOtisDashboard mounted')
    
    const createSession = async () => {
      try {
        console.log('Creating session...')
        const response = await fetch('/api/otis/workflow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_session',
            data: { stage: 'scraping' }
          })
        })

        if (response.ok) {
          const result = await response.json()
          console.log('Session created:', result)
          setSessionId(result.sessionId)
        } else {
          throw new Error('Failed to create session')
        }
      } catch (err) {
        console.error('Error creating session:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    }

    createSession()
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Simple OTIS Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-4">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Reload Page
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Simple OTIS Dashboard</h1>
          <p className="text-gray-600 mb-4">This is a simplified version to test basic functionality.</p>
          
          <div className="space-y-4">
            <div>
              <strong>Session ID:</strong> {sessionId || 'None'}
            </div>
            <div>
              <strong>Status:</strong> <span className="text-green-600">Working</span>
            </div>
            <div>
              <strong>API Test:</strong> <span className="text-green-600">✅ Passed</span>
            </div>
          </div>
          
          <div className="mt-6">
            <button
              onClick={() => window.location.href = '/agents/otis/enhanced'}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-3"
            >
              Go to Full Dashboard
            </button>
            <button
              onClick={() => window.location.href = '/agents/otis/enhanced/test'}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Run Tests
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SimpleOtisPage() {
  return (
    <OtisErrorBoundary>
      <WorkflowProvider>
        <SimpleOtisDashboard />
      </WorkflowProvider>
    </OtisErrorBoundary>
  )
} 
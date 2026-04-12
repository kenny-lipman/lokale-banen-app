"use client"

import React from 'react'
import { useWorkflow } from '@/contexts/otis-workflow-context'

export function OtisDashboardMinimal() {
  const { sessionId, currentStage, isLoading, error, createSession } = useWorkflow()

  React.useEffect(() => {
    if (!sessionId) {
      createSession()
    }
  }, [sessionId, createSession])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading OTIS Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-900 mb-4">Error</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">OTIS Dashboard - Minimal</h1>
          <p className="text-gray-600 mb-4">Minimal version of the OTIS dashboard for testing.</p>
          
          <div className="space-y-4">
            <div>
              <strong>Session ID:</strong> {sessionId || 'None'}
            </div>
            <div>
              <strong>Current Stage:</strong> <span className="text-blue-600">{currentStage}</span>
            </div>
            <div>
              <strong>Status:</strong> <span className="text-green-600">Active</span>
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
              onClick={() => window.location.href = '/agents/otis/enhanced/simple'}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Go to Simple Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
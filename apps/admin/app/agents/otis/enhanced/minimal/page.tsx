"use client"

import React from 'react'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { WorkflowProvider } from '@/contexts/otis-workflow-context'
import { OtisDashboardMinimal } from '@/components/otis/OtisDashboardMinimal'
import { OtisErrorBoundary } from '@/components/otis/ErrorBoundary'

export default function MinimalOtisPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('MinimalOtisPage mounted with sessionId:', sessionId)
    setIsLoading(false)
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading OTIS Minimal...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-900 mb-4">Error Loading OTIS Minimal</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.location.href = '/agents/otis'}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Go to OTIS Home
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <OtisErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <WorkflowProvider initialSessionId={sessionId}>
          <OtisDashboardMinimal />
        </WorkflowProvider>
      </div>
    </OtisErrorBoundary>
  )
} 
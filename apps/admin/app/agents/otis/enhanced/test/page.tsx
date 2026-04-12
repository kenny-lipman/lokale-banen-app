"use client"

import { useState, useEffect } from 'react'

export default function OtisTestPage() {
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<any>({})

  useEffect(() => {
    console.log('OtisTestPage mounted')
    runTests()
  }, [])

  const runTests = async () => {
    const testResults: any = {}
    
    try {
      // Test 1: Basic React functionality
      console.log('Test 1: Basic React functionality')
      testResults.react = 'PASS'
      setStep(2)
      
      // Test 2: Check if hooks are available
      console.log('Test 2: Checking hooks availability')
      if (typeof useState === 'function' && typeof useEffect === 'function') {
        testResults.hooks = 'PASS'
      } else {
        testResults.hooks = 'FAIL'
        throw new Error('React hooks not available')
      }
      setStep(3)
      
      // Test 3: Check if fetch is available
      console.log('Test 3: Checking fetch availability')
      if (typeof fetch === 'function') {
        testResults.fetch = 'PASS'
      } else {
        testResults.fetch = 'FAIL'
        throw new Error('Fetch not available')
      }
      setStep(4)
      
      // Test 4: Test API endpoint
      console.log('Test 4: Testing API endpoint')
      try {
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
          testResults.api = 'PASS'
          testResults.sessionId = result.sessionId
        } else {
          testResults.api = 'FAIL'
          testResults.apiError = `HTTP ${response.status}`
        }
      } catch (apiError) {
        testResults.api = 'FAIL'
        testResults.apiError = apiError instanceof Error ? apiError.message : 'Unknown API error'
      }
      setStep(5)
      
      // Test 5: Check if EventSource is available
      console.log('Test 5: Checking EventSource availability')
      if (typeof EventSource === 'function') {
        testResults.eventSource = 'PASS'
      } else {
        testResults.eventSource = 'FAIL'
        throw new Error('EventSource not available')
      }
      setStep(6)
      
      setResults(testResults)
      console.log('All tests completed:', testResults)
      
    } catch (err) {
      console.error('Test failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown test error')
      setResults(testResults)
    }
  }

  const getStepDescription = (stepNumber: number) => {
    switch (stepNumber) {
      case 1: return 'Initializing...'
      case 2: return 'Testing React functionality...'
      case 3: return 'Testing React hooks...'
      case 4: return 'Testing fetch API...'
      case 5: return 'Testing OTIS API...'
      case 6: return 'Testing EventSource...'
      default: return 'Completed'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">OTIS Enhanced Test Page</h1>
          
          {error ? (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-red-900 mb-4">Test Failed</h2>
              <p className="text-gray-600 mb-4">{error}</p>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Running Tests</h2>
              <div className="flex items-center justify-center mb-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                <p className="text-gray-600">{getStepDescription(step)}</p>
              </div>
            </div>
          )}
          
          <div className="text-left">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Test Results:</h3>
            <div className="space-y-2">
              {Object.entries(results).map(([test, result]) => (
                <div key={test} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="font-medium text-gray-700">{test}:</span>
                  <span className={`px-2 py-1 rounded text-sm ${
                    result === 'PASS' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {result}
                  </span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Run Tests Again
            </button>
            <button
              onClick={() => window.location.href = '/agents/otis/enhanced'}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Go to Enhanced Page
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestResumePage() {
  const [testResult, setTestResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testResumeSession = async (sessionId: string) => {
    setLoading(true)
    setError(null)
    setTestResult(null)

    try {
      console.log('Testing resume for session:', sessionId)
      
      const response = await fetch(`/api/otis/sessions/${sessionId}/resume`)
      const data = await response.json()
      
      console.log('Resume API response:', { status: response.status, data })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.details || data.error || 'Unknown error'}`)
      }
      
      if (!data.success) {
        throw new Error(data.details || data.error || 'API returned success: false')
      }
      
      setTestResult(data)
    } catch (err) {
      console.error('Test resume failed:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const testSessions = [
    'otis_1753197068942_s8io23aiv',
    'otis_1753196667018_s672mv9bk'
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Resume Session</h1>
      
      <div className="space-y-4">
        {testSessions.map((sessionId) => (
          <Card key={sessionId}>
            <CardHeader>
              <CardTitle className="text-sm font-mono">{sessionId}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => testResumeSession(sessionId)}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Testing...' : 'Test Resume'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {error && (
        <Card className="mt-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
          </CardContent>
        </Card>
      )}

      {testResult && (
        <Card className="mt-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">Success</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-green-700 whitespace-pre-wrap overflow-auto max-h-96">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 
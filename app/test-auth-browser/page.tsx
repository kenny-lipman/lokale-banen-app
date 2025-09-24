"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { authFetch } from "@/lib/authenticated-fetch"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

export default function TestAuthBrowserPage() {
  const { user, isAuthenticated, loading } = useAuth()
  const [testResults, setTestResults] = useState<Record<string, any>>({})
  const [testing, setTesting] = useState(false)

  const runTests = async () => {
    setTesting(true)
    const results: Record<string, any> = {}

    // Test 1: API Test endpoint
    try {
      const response = await authFetch("/api/test-auth")
      if (response.ok) {
        const data = await response.json()
        results.testAuth = { success: true, data }
      } else {
        results.testAuth = { success: false, error: `HTTP ${response.status}` }
      }
    } catch (error) {
      results.testAuth = { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }

    // Test 2: Companies API
    try {
      const response = await authFetch("/api/companies?limit=1")
      if (response.ok) {
        const data = await response.json()
        results.companies = { success: true, count: data.data?.length || 0 }
      } else {
        results.companies = { success: false, error: `HTTP ${response.status}` }
      }
    } catch (error) {
      results.companies = { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }

    // Test 3: Contacts API
    try {
      const response = await authFetch("/api/contacts?limit=1")
      if (response.ok) {
        const data = await response.json()
        results.contacts = { success: true, count: data.data?.length || 0 }
      } else {
        results.contacts = { success: false, error: `HTTP ${response.status}` }
      }
    } catch (error) {
      results.contacts = { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }

    // Test 4: Job Postings API
    try {
      const response = await authFetch("/api/job-postings?limit=1")
      if (response.ok) {
        const data = await response.json()
        results.jobPostings = { success: true, count: data.data?.length || 0 }
      } else {
        results.jobPostings = { success: false, error: `HTTP ${response.status}` }
      }
    } catch (error) {
      results.jobPostings = { success: false, error: error instanceof Error ? error.message : "Unknown error" }
    }

    setTestResults(results)
    setTesting(false)
  }

  useEffect(() => {
    if (isAuthenticated && !testing && Object.keys(testResults).length === 0) {
      runTests()
    }
  }, [isAuthenticated])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="container max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Authentication Required</CardTitle>
            <CardDescription>
              You must be logged in to view this test page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication Test Dashboard</CardTitle>
            <CardDescription>
              Test various API endpoints to verify authentication is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p><strong>User:</strong> {user?.email}</p>
                <p><strong>User ID:</strong> {user?.id}</p>
                <p><strong>Authenticated:</strong>
                  <Badge variant={isAuthenticated ? "default" : "destructive"} className="ml-2">
                    {isAuthenticated ? "Yes" : "No"}
                  </Badge>
                </p>
              </div>

              <Button onClick={runTests} disabled={testing}>
                {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {testing ? "Running Tests..." : "Run API Tests"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {Object.keys(testResults).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(testResults).map(([testName, result]) => (
                  <div key={testName} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-2">
                      {result.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="font-medium capitalize">
                        {testName.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {result.success ? (
                        <span className="text-green-600">
                          ✓ {result.count !== undefined ? `${result.count} records` : "Success"}
                        </span>
                      ) : (
                        <span className="text-red-600">✗ {result.error}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
"use client"

import { useAuth } from "@/components/auth-provider"
import { useEffect, useState } from "react"

export default function TestAuthPage() {
  const { user, profile, isAuthenticated, loading, authState } = useAuth()
  const [testResults, setTestResults] = useState<any>({})

  useEffect(() => {
    const runTests = async () => {
      const results: any = {}
      
      // Test 1: Check if Supabase client is working
      try {
        const { createClient } = await import('@/lib/supabase')
        const client = createClient()
        const { data, error } = await client.from('contacts').select('count', { count: 'exact', head: true })
        results.supabaseConnection = { success: !error, data, error: error?.message }
      } catch (e) {
        results.supabaseConnection = { success: false, error: e instanceof Error ? e.message : String(e) }
      }

      // Test 2: Check environment variables
      results.envVars = {
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) || 'not set'
      }

      setTestResults(results)
    }

    runTests()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Test Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Auth State</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</div>
            <div><strong>Auth State:</strong> {authState}</div>
            <div><strong>Is Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</div>
            <div><strong>User ID:</strong> {user?.id || 'None'}</div>
            <div><strong>User Email:</strong> {user?.email || 'None'}</div>
            <div><strong>Profile Role:</strong> {profile?.role || 'None'}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Supabase URL:</strong> {testResults.envVars?.hasSupabaseUrl ? 'Set' : 'Not Set'}</div>
            <div><strong>Supabase Key:</strong> {testResults.envVars?.hasSupabaseKey ? 'Set' : 'Not Set'}</div>
            <div><strong>URL Prefix:</strong> {testResults.envVars?.urlPrefix}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Database Connection</h2>
          <div className="space-y-2 text-sm">
            <div><strong>Status:</strong> {testResults.supabaseConnection?.success ? 'Connected' : 'Failed'}</div>
            {testResults.supabaseConnection?.error && (
              <div><strong>Error:</strong> {testResults.supabaseConnection.error}</div>
            )}
            {testResults.supabaseConnection?.data && (
              <div><strong>Contacts Count:</strong> {testResults.supabaseConnection.data}</div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            <button 
              onClick={() => window.location.reload()} 
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
            <button 
              onClick={() => window.location.href = '/login'} 
              className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Go to Login
            </button>
            <button 
              onClick={() => window.location.href = '/contacten'} 
              className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Go to Contacten
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
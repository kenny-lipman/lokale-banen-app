"use client"

import { useAuth } from "@/components/auth-provider"
import { useEffect, useState } from "react"
import { supabaseService } from "@/lib/supabase-service"

export default function TestAuthPage() {
  const { user, profile, isAuthenticated, loading, session } = useAuth()
  const [connectionTest, setConnectionTest] = useState<any>(null)
  const [sessionTest, setSessionTest] = useState<any>(null)

  useEffect(() => {
    // Test connection
    const testConnection = async () => {
      const result = await supabaseService.testConnection()
      setConnectionTest(result)
    }

    // Test session
    const testSession = async () => {
      try {
        const { data, error } = await supabaseService.client.auth.getSession()
        setSessionTest({ data, error })
      } catch (err) {
        setSessionTest({ error: err })
      }
    }

    testConnection()
    testSession()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Authentication Test Page</h1>
      
      <div className="space-y-6">
        {/* Auth State */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Authentication State</h2>
          <div className="space-y-2">
            <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
            <p><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</p>
            <p><strong>User ID:</strong> {user?.id || 'None'}</p>
            <p><strong>User Email:</strong> {user?.email || 'None'}</p>
            <p><strong>Profile ID:</strong> {profile?.id || 'None'}</p>
            <p><strong>Profile Role:</strong> {profile?.role || 'None'}</p>
            <p><strong>Session User ID:</strong> {session?.user?.id || 'None'}</p>
          </div>
        </div>

        {/* Connection Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Database Connection Test</h2>
          {connectionTest ? (
            <div className="space-y-2">
              <p><strong>Success:</strong> {connectionTest.success ? 'Yes' : 'No'}</p>
              {connectionTest.error && (
                <p><strong>Error:</strong> {connectionTest.error}</p>
              )}
              {connectionTest.count !== undefined && (
                <p><strong>Companies Count:</strong> {connectionTest.count}</p>
              )}
              {connectionTest.contactsCount !== undefined && (
                <p><strong>Contacts Count:</strong> {connectionTest.contactsCount}</p>
              )}
              {connectionTest.message && (
                <p><strong>Message:</strong> {connectionTest.message}</p>
              )}
            </div>
          ) : (
            <p>Testing connection...</p>
          )}
        </div>

        {/* Session Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Session Test</h2>
          {sessionTest ? (
            <div className="space-y-2">
              <p><strong>Has Session:</strong> {sessionTest.data?.session ? 'Yes' : 'No'}</p>
              <p><strong>Session User ID:</strong> {sessionTest.data?.session?.user?.id || 'None'}</p>
              <p><strong>Session User Email:</strong> {sessionTest.data?.session?.user?.email || 'None'}</p>
              {sessionTest.error && (
                <p><strong>Error:</strong> {JSON.stringify(sessionTest.error)}</p>
              )}
            </div>
          ) : (
            <p>Testing session...</p>
          )}
        </div>

        {/* Environment Variables */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-2">
            <p><strong>SUPABASE_URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not Set'}</p>
            <p><strong>SUPABASE_ANON_KEY:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Not Set'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-2">
            <button 
              onClick={() => window.location.href = '/login'}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Go to Login
            </button>
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 ml-2"
            >
              Go to Dashboard
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 ml-2"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 
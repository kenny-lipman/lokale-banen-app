"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabaseService } from "@/lib/supabase-service"
import { useAuth } from "@/components/auth-provider"
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Database, User, Shield, ChevronDown, ChevronRight } from "lucide-react"

export function ConnectionTest() {
  const [connectionStatus, setConnectionStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [authDebug, setAuthDebug] = useState<any>(null)
  const [dbExpanded, setDbExpanded] = useState(false)
  const [authExpanded, setAuthExpanded] = useState(false)
  const { user, session, isAuthenticated, authState, loading: authLoading } = useAuth()

  const testConnection = async () => {
    setLoading(true)
    try {
      const result = await supabaseService.testConnection()
      setConnectionStatus(result)
    } catch (error) {
      setConnectionStatus({ success: false, error: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }

  const getAuthDebugInfo = async () => {
    try {
      // Get current session
      const { data: { session: currentSession }, error: sessionError } = await supabaseService.client.auth.getSession()
      
      // Get current user
      const { data: { user: currentUser }, error: userError } = await supabaseService.client.auth.getUser()
      
      // Check localStorage for auth data
      const storageKey = 'lokale-banen-auth'
      const storedAuth = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null
      
      setAuthDebug({
        currentSession: currentSession ? {
          user: currentSession.user?.id,
          expiresAt: currentSession.expires_at,
          accessToken: currentSession.access_token ? 'present' : 'missing',
          refreshToken: currentSession.refresh_token ? 'present' : 'missing'
        } : null,
        currentUser: currentUser ? {
          id: currentUser.id,
          email: currentUser.email,
          emailConfirmed: currentUser.email_confirmed_at
        } : null,
        sessionError: sessionError?.message,
        userError: userError?.message,
        storedAuth: storedAuth ? 'present' : 'missing',
        localStorageAvailable: typeof window !== 'undefined',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      setAuthDebug({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      })
    }
  }

  useEffect(() => {
    testConnection()
    getAuthDebugInfo()
  }, [])

  return (
    <div className="space-y-4">
      {/* Database Connection Test - Collapsible */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setDbExpanded(!dbExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle className="text-lg">Database Verbinding</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {connectionStatus && (
                <Badge variant={connectionStatus.success ? "default" : "destructive"} className="text-xs">
                  {connectionStatus.success ? (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Verbonden
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      Fout
                    </>
                  )}
                </Badge>
              )}
              {dbExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </div>
          <CardDescription>
            Test de verbinding met de Supabase database
          </CardDescription>
        </CardHeader>
        
        {dbExpanded && (
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Status:</span>
                {connectionStatus ? (
                  <Badge variant={connectionStatus.success ? "default" : "destructive"}>
                    {connectionStatus.success ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Verbonden
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-1" />
                        Fout
                      </>
                    )}
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                    Testen...
                  </Badge>
                )}
              </div>
              
              {connectionStatus && (
                <div className="text-sm space-y-2">
                  {connectionStatus.success ? (
                    <>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Database verbinding succesvol</span>
                      </div>
                      {connectionStatus.count !== undefined && (
                        <div className="text-gray-600">
                          Bedrijven in database: {connectionStatus.count}
                        </div>
                      )}
                      {connectionStatus.contactsCount !== undefined && (
                        <div className="text-gray-600">
                          Contacten in database: {connectionStatus.contactsCount}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-4 w-4" />
                      <span>Fout: {connectionStatus.error}</span>
                    </div>
                  )}
                </div>
              )}
              
              <Button onClick={testConnection} disabled={loading} variant="outline" size="sm">
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testen...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Opnieuw Testen
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Authentication Debug - Collapsible */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setAuthExpanded(!authExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <CardTitle className="text-lg">Authenticatie Debug</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isAuthenticated ? "default" : "secondary"} className="text-xs">
                {authLoading ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Laden...
                  </>
                ) : (
                  <>
                    {isAuthenticated ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Ingelogd
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Uitgelogd
                      </>
                    )}
                  </>
                )}
              </Badge>
              {authExpanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500" />
              )}
            </div>
          </div>
          <CardDescription>
            Debug informatie over de huidige authenticatie status
          </CardDescription>
        </CardHeader>
        
        {authExpanded && (
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Auth State:</span>
                <Badge variant={isAuthenticated ? "default" : "secondary"}>
                  {authLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                      Laden...
                    </>
                  ) : (
                    <>
                      {isAuthenticated ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Ingelogd
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 mr-1" />
                          Uitgelogd
                        </>
                      )}
                    </>
                  )}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Auth State:</span>
                  <div className="text-gray-600">{authState}</div>
                </div>
                <div>
                  <span className="font-medium">Loading:</span>
                  <div className="text-gray-600">{authLoading ? 'Ja' : 'Nee'}</div>
                </div>
                <div>
                  <span className="font-medium">User ID:</span>
                  <div className="text-gray-600">{user?.id || 'Geen'}</div>
                </div>
                <div>
                  <span className="font-medium">Session:</span>
                  <div className="text-gray-600">{session ? 'Aanwezig' : 'Geen'}</div>
                </div>
              </div>

              {authDebug && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Debug Info:</h4>
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(authDebug, null, 2)}
                  </pre>
                </div>
              )}

              <Button onClick={getAuthDebugInfo} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Debug Info Vernieuwen
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

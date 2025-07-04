"use client"

import { useState, useEffect } from "react"
import { supabaseService } from "@/lib/supabase-service"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, XCircle, RefreshCw } from "lucide-react"

export function ConnectionTest() {
  const [connectionStatus, setConnectionStatus] = useState<{
    success: boolean
    error?: string
    count?: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const runTest = async () => {
    setIsLoading(true)
    const result = await supabaseService.testConnection()
    setConnectionStatus(result)
    setIsLoading(false)
  }

  useEffect(() => {
    runTest()
  }, [])

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>Supabase Connection Status</span>
          {connectionStatus?.success ? (
            <CheckCircle className="w-5 h-5 text-green-500" />
          ) : connectionStatus?.success === false ? (
            <XCircle className="w-5 h-5 text-red-500" />
          ) : null}
        </CardTitle>
        <CardDescription>Test connection to your Supabase database</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            {connectionStatus === null ? (
              <Badge variant="secondary">Testing...</Badge>
            ) : connectionStatus.success ? (
              <div className="space-y-1">
                <Badge className="bg-green-100 text-green-800">Connected</Badge>
                <p className="text-sm text-gray-600">Database URL: https://wnfhwhvrknvmidmzeclh.supabase.co</p>
              </div>
            ) : (
              <div className="space-y-1">
                <Badge variant="destructive">Connection Failed</Badge>
                <p className="text-sm text-red-600">{connectionStatus.error}</p>
              </div>
            )}
          </div>
          <Button onClick={runTest} disabled={isLoading} variant="outline" size="sm">
            {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Test Connection
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

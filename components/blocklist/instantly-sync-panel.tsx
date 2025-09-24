"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  Info,
} from "lucide-react"

interface SyncResult {
  success: number
  failed: number
  skipped: number
  total: number
  errors: Array<{
    email: string
    error: string
  }>
}

interface InstantlySyncPanelProps {
  onSync: () => Promise<SyncResult>
  loading?: boolean
  stats?: {
    syncStatus: {
      instantly: {
        synced: number
        pending: number
      }
    }
  } | null
}

export function InstantlySyncPanel({ onSync, loading = false, stats }: InstantlySyncPanelProps) {
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)

  const handleSync = async () => {
    try {
      setSyncLoading(true)
      const result = await onSync()
      setLastSyncResult(result)
    } catch (error) {
      console.error("Sync failed:", error)
    } finally {
      setSyncLoading(false)
    }
  }

  const getSyncStatusBadge = () => {
    if (!stats?.syncStatus?.instantly) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Onbekend
        </Badge>
      )
    }

    const { synced, pending } = stats.syncStatus.instantly

    if (pending > 0) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3" />
          {pending} pending
        </Badge>
      )
    }

    if (synced > 0) {
      return (
        <Badge variant="default" className="flex items-center gap-1 bg-green-100 text-green-800">
          <CheckCircle2 className="h-3 w-3" />
          {synced} gesynchroniseerd
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Niet gesynchroniseerd
      </Badge>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Instantly.ai Synchronisatie
              <a
                href="https://app.instantly.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </CardTitle>
            <CardDescription>
              Synchroniseer geblokkeerde contacten naar Instantly.ai blocklist
            </CardDescription>
          </div>
          {getSyncStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Deze synchronisatie voegt alleen geblokkeerde contacten (is_blocked = true) toe aan de Instantly.ai blocklist.
            Contacten die al in de blocklist staan worden overgeslagen.
          </AlertDescription>
        </Alert>

        {/* Sync Button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleSync}
            disabled={syncLoading || loading}
            className="flex items-center gap-2"
          >
            {syncLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {syncLoading ? "Synchroniseren..." : "Synchroniseer naar Instantly.ai"}
          </Button>

          {stats?.syncStatus?.instantly && (
            <div className="text-sm text-muted-foreground">
              {stats.syncStatus.instantly.synced} van {stats.syncStatus.instantly.synced + stats.syncStatus.instantly.pending} contacten gesynchroniseerd
            </div>
          )}
        </div>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Laatste Synchronisatie Resultaat</h4>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{lastSyncResult.success}</div>
                <div className="text-xs text-green-700">Geslaagd</div>
              </div>

              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{lastSyncResult.failed}</div>
                <div className="text-xs text-red-700">Gefaald</div>
              </div>

              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{lastSyncResult.skipped}</div>
                <div className="text-xs text-gray-700">Overgeslagen</div>
              </div>

              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{lastSyncResult.total}</div>
                <div className="text-xs text-blue-700">Totaal</div>
              </div>
            </div>

            {/* Errors */}
            {lastSyncResult.errors.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-sm font-medium text-red-600">Fouten ({lastSyncResult.errors.length})</h5>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {lastSyncResult.errors.slice(0, 5).map((error, index) => (
                    <div key={index} className="text-xs bg-red-50 p-2 rounded">
                      <strong>{error.email}:</strong> {error.error}
                    </div>
                  ))}
                  {lastSyncResult.errors.length > 5 && (
                    <div className="text-xs text-muted-foreground">
                      ... en {lastSyncResult.errors.length - 5} meer
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BlocklistSyncStatus } from "@/components/blocklist/blocklist-sync-status"
import { authenticatedFetch } from "@/lib/api-client"
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
      pipedrive?: {
        synced: number
        pending: number
      }
    }
  } | null
}

export function InstantlySyncPanel({ onSync, loading = false, stats }: InstantlySyncPanelProps) {
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)
  const [syncLoading, setSyncLoading] = useState(false)
  const [platformSyncLoading, setPlatformSyncLoading] = useState<Record<string, boolean>>({})

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

  const handlePlatformSync = async (platform: "instantly" | "pipedrive") => {
    try {
      setPlatformSyncLoading({ ...platformSyncLoading, [platform]: true })

      const endpoint = platform === "instantly" ? "/api/blocklist/sync" : "/api/blocklist/sync-pipedrive"
      const response = await authenticatedFetch(endpoint, { method: "POST" })

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`)
      }

      const result = await response.json()

      // Show success message or handle result
      console.log(`${platform} sync completed:`, result)

      // You might want to refetch the data here to update the UI
      // onRefresh?.()

    } catch (error) {
      console.error(`${platform} sync failed:`, error)
    } finally {
      setPlatformSyncLoading({ ...platformSyncLoading, [platform]: false })
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
              Blocklist Synchronisatie
            </CardTitle>
            <CardDescription>
              Synchroniseer geblokkeerde contacten naar Instantly.ai en Pipedrive. Je kunt alle platforms tegelijk of individueel synchroniseren.
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
            Deze synchronisatie voegt geblokkeerde entries toe aan de respectievelijke platforms.
            Entries die al gesynchroniseerd zijn worden overgeslagen.
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
            {syncLoading ? "Synchroniseren..." : "Alles Synchroniseren"}
          </Button>

          {stats?.syncStatus?.instantly && (
            <div className="text-sm text-muted-foreground">
              {stats.syncStatus.instantly.synced} van {stats.syncStatus.instantly.synced + stats.syncStatus.instantly.pending} contacten gesynchroniseerd
            </div>
          )}
        </div>

        {/* Individual Platform Sync Status */}
        <BlocklistSyncStatus
          instantly={{
            synced: stats?.syncStatus?.instantly ? (stats.syncStatus.instantly.synced > 0) : false,
            syncedAt: null, // You might want to add this to your stats
            error: null
          }}
          pipedrive={{
            synced: stats?.syncStatus?.pipedrive ? (stats.syncStatus.pipedrive.synced > 0) : false,
            syncedAt: null, // You might want to add this to your stats
            error: null
          }}
          onRetrySync={handlePlatformSync}
          loading={syncLoading || platformSyncLoading.instantly || platformSyncLoading.pipedrive}
        />

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
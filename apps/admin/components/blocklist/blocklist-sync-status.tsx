"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  AlertTriangle,
  Loader2,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"

interface SyncStatusInfo {
  synced: boolean
  syncedAt?: string | null
  error?: string | null
}

interface BlocklistSyncStatusProps {
  instantly?: SyncStatusInfo
  pipedrive?: SyncStatusInfo
  onRetrySync?: (platform: "instantly" | "pipedrive") => void
  loading?: boolean
  compact?: boolean
}

export function BlocklistSyncStatus({
  instantly,
  pipedrive,
  onRetrySync,
  loading = false,
  compact = false,
}: BlocklistSyncStatusProps) {
  const getSyncStatusIcon = (status: SyncStatusInfo | undefined) => {
    if (!status) {
      return <Clock className="h-4 w-4 text-gray-400" />
    }

    if (status.error) {
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    }

    if (status.synced) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />
    }

    return <XCircle className="h-4 w-4 text-red-500" />
  }

  const getSyncStatusText = (status: SyncStatusInfo | undefined) => {
    if (!status) return "Niet gesynchroniseerd"
    if (status.error) return "Fout bij synchronisatie"
    if (status.synced) return "Gesynchroniseerd"
    return "Synchronisatie pending"
  }

  const getSyncDetails = (status: SyncStatusInfo | undefined) => {
    if (!status) return null

    if (status.error) {
      return `Fout: ${status.error}`
    }

    if (status.syncedAt) {
      return `Laatst gesynchroniseerd: ${formatDistanceToNow(new Date(status.syncedAt), {
        addSuffix: true,
        locale: nl,
      })}`
    }

    return null
  }

  const getSyncBadgeVariant = (status: SyncStatusInfo | undefined) => {
    if (!status || !status.synced) return "destructive"
    if (status.error) return "destructive"
    return "default"
  }

  const getSyncBadgeClassName = (status: SyncStatusInfo | undefined) => {
    if (!status || !status.synced) return ""
    if (status.error) return ""
    return "bg-green-100 text-green-800"
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                {getSyncStatusIcon(instantly)}
                <span className="text-xs text-muted-foreground">I</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <div className="font-medium">Instantly</div>
                <div>{getSyncStatusText(instantly)}</div>
                {getSyncDetails(instantly) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {getSyncDetails(instantly)}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1">
                {getSyncStatusIcon(pipedrive)}
                <span className="text-xs text-muted-foreground">P</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <div className="font-medium">Pipedrive</div>
                <div>{getSyncStatusText(pipedrive)}</div>
                {getSyncDetails(pipedrive) && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {getSyncDetails(pipedrive)}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Synchronisatie Status</h4>
        {onRetrySync && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Retry both platforms
              onRetrySync("instantly")
              onRetrySync("pipedrive")
            }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Opnieuw Synchroniseren
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {/* Instantly Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSyncStatusIcon(instantly)}
            <span className="text-sm font-medium">Instantly</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getSyncBadgeVariant(instantly)} className={`text-xs ${getSyncBadgeClassName(instantly)}`}>
              {getSyncStatusText(instantly)}
            </Badge>
            {onRetrySync && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRetrySync("instantly")}
                disabled={loading}
                className="h-6 px-2"
                title="Sync naar Instantly"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {getSyncDetails(instantly) && (
          <div className="text-xs text-muted-foreground ml-6">
            {getSyncDetails(instantly)}
          </div>
        )}

        {/* Pipedrive Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getSyncStatusIcon(pipedrive)}
            <span className="text-sm font-medium">Pipedrive</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getSyncBadgeVariant(pipedrive)} className={`text-xs ${getSyncBadgeClassName(pipedrive)}`}>
              {getSyncStatusText(pipedrive)}
            </Badge>
            {onRetrySync && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRetrySync("pipedrive")}
                disabled={loading}
                className="h-6 px-2"
                title="Sync naar Pipedrive"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {getSyncDetails(pipedrive) && (
          <div className="text-xs text-muted-foreground ml-6">
            {getSyncDetails(pipedrive)}
          </div>
        )}
      </div>
    </div>
  )
}
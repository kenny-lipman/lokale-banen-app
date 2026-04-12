"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MultiSelect } from "@/components/ui/multi-select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { SyncStatsCards } from "@/components/instantly-sync/sync-stats-cards"
import { MailerLiteEventsTable } from "@/components/mailerlite-sync/mailerlite-events-table"
import { MailerLiteEventDrawer } from "@/components/mailerlite-sync/mailerlite-event-drawer"
import { useMailerLiteSync } from "@/hooks/use-mailerlite-sync"
import { MailerLiteSyncEvent } from "@/app/api/mailerlite/sync-events/route"
import { TablePagination } from "@/components/ui/table-filters"
import {
  RefreshCw,
  Search,
  Filter,
  X,
  Zap,
  Mail,
} from "lucide-react"

export default function MailerLiteSyncPage() {
  const {
    events,
    pagination,
    stats,
    filters,
    loading,
    error,
    autoRefreshEnabled,
    changePage,
    changeLimit,
    updateFilters,
    clearFilters,
    refetch,
    toggleAutoRefresh,
  } = useMailerLiteSync({
    autoRefresh: true,
    refreshInterval: 30000,
  })

  const [selectedEvent, setSelectedEvent] = useState<MailerLiteSyncEvent | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const hasActiveFilters =
    filters.search ||
    (filters.statuses && filters.statuses.length > 0) ||
    filters.syncSource

  // Stats for SyncStatsCards: add skippedCount (0) for compatibility
  const statsWithSkipped = {
    ...stats,
    skippedCount: 0,
  }

  const statusOptions = [
    { value: 'success', label: 'Succesvol' },
    { value: 'error', label: 'Error' },
  ]

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-8 w-8" />
            MailerLite Sync
          </h1>
          <p className="text-muted-foreground mt-1">
            Overzicht van alle MailerLite subscriber syncs
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefreshEnabled}
              onCheckedChange={toggleAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm text-muted-foreground">
              Auto-refresh
            </Label>
            {autoRefreshEnabled && (
              <Badge variant="secondary" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Live
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Vernieuwen
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Stats Cards */}
      <SyncStatsCards stats={statsWithSkipped} loading={loading && events.length === 0} />

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle className="text-lg">Filters</CardTitle>
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-2">
                  Actief
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Wissen
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                {showFilters ? "Verbergen" : "Tonen"}
              </Button>
            </div>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Zoeken</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Email of groep..."
                    value={filters.search || ""}
                    onChange={(e) => updateFilters({ search: e.target.value })}
                    className="pl-8"
                  />
                </div>
              </div>

              {/* Status (Multi-select) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <MultiSelect
                  options={statusOptions}
                  selected={filters.statuses || []}
                  onChange={(selected) => updateFilters({ statuses: selected })}
                  placeholder="Alle statussen"
                />
              </div>

              {/* Sync Source */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Sync Source</label>
                <Input
                  placeholder="bijv. webhook, manual..."
                  value={filters.syncSource || ""}
                  onChange={(e) => updateFilters({ syncSource: e.target.value || undefined })}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Events Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Sync Events
              {pagination.total > 0 && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({pagination.total.toLocaleString()} totaal)
                </span>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <MailerLiteEventsTable
            events={events}
            loading={loading}
            onViewDetails={(event) => setSelectedEvent(event)}
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <TablePagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.total}
          itemsPerPage={pagination.limit}
          onPageChange={changePage}
          onItemsPerPageChange={changeLimit}
        />
      )}

      {/* Event Detail Drawer */}
      <MailerLiteEventDrawer
        event={selectedEvent}
        open={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}

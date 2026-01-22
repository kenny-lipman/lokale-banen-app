"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MultiSelect } from "@/components/ui/multi-select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SyncStatsCards } from "@/components/instantly-sync/sync-stats-cards"
import { SyncEventsTable } from "@/components/instantly-sync/sync-events-table"
import { SyncEventDrawer } from "@/components/instantly-sync/sync-event-drawer"
import { BackfillTab } from "@/components/instantly-sync/backfill-tab"
import { useInstantlySync, EVENT_TYPE_CONFIG } from "@/hooks/use-instantly-sync"
import { SyncEvent } from "@/app/api/instantly/sync-events/route"
import { TablePagination } from "@/components/ui/table-filters"
import {
  RefreshCw,
  Search,
  Filter,
  X,
  Zap,
  ArrowLeftRight,
  Radio,
  Database,
} from "lucide-react"

export default function InstantlySyncPage() {
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
  } = useInstantlySync({
    autoRefresh: true,
    refreshInterval: 30000, // 30 seconds
  })

  // UI State
  const [selectedEvent, setSelectedEvent] = useState<SyncEvent | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [activeTab, setActiveTab] = useState("live-events")

  const hasActiveFilters =
    filters.search ||
    (filters.eventTypes && filters.eventTypes.length > 0) ||
    (filters.statuses && filters.statuses.length > 0)

  // Build options for multi-select dropdowns
  const eventTypeOptions = Object.entries(EVENT_TYPE_CONFIG).map(([value, config]) => ({
    value,
    label: `${config.icon} ${config.label}`,
  }))

  const statusOptions = [
    { value: 'success', label: '✅ Succesvol' },
    { value: 'error', label: '❌ Error' },
    { value: 'skipped', label: '⏭️ Overgeslagen' },
  ]

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ArrowLeftRight className="h-8 w-8" />
            Instantly {"<>"} PD Sync
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time overzicht van alle webhook events tussen Instantly en Pipedrive
          </p>
        </div>
        {activeTab === "live-events" && (
          <div className="flex items-center gap-4">
            {/* Auto-refresh toggle */}
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
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="live-events" className="flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Live Events
          </TabsTrigger>
          <TabsTrigger value="backfill" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Backfill
          </TabsTrigger>
        </TabsList>

        {/* Live Events Tab */}
        <TabsContent value="live-events" className="space-y-6">
          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Stats Cards */}
          <SyncStatsCards stats={stats} loading={loading && events.length === 0} />

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
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {/* Search */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Zoeken</label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Email of campaign..."
                        value={filters.search || ""}
                        onChange={(e) => updateFilters({ search: e.target.value })}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  {/* Event Types (Multi-select) */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Event Types</label>
                    <MultiSelect
                      options={eventTypeOptions}
                      selected={filters.eventTypes || []}
                      onChange={(selected) => updateFilters({ eventTypes: selected })}
                      placeholder="Alle events"
                    />
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
              <SyncEventsTable
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
          <SyncEventDrawer
            event={selectedEvent}
            open={!!selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        </TabsContent>

        {/* Backfill Tab */}
        <TabsContent value="backfill">
          <BackfillTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

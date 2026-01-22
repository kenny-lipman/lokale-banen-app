"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CampaignAssignmentStatsCards } from "@/components/campaign-assignment/stats-cards"
import { CampaignAssignmentLogsTable } from "@/components/campaign-assignment/logs-table"
import { CampaignAssignmentLogDrawer } from "@/components/campaign-assignment/log-drawer"
import { CampaignAssignmentBatchesTable } from "@/components/campaign-assignment/batches-table"
import { CampaignAssignmentSettingsCard } from "@/components/campaign-assignment/settings-card"
import { useCampaignAssignment, CampaignAssignmentLog, STATUS_CONFIG } from "@/hooks/use-campaign-assignment"
import { TablePagination } from "@/components/ui/table-filters"
import {
  RefreshCw,
  Search,
  Filter,
  X,
  Zap,
  Mail,
  Play,
  History,
  LayoutList,
  Loader2,
  Settings,
  Square,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CampaignSettings {
  max_total_contacts: number
  max_per_platform: number
  is_enabled: boolean
}

export default function CampaignAssignmentPage() {
  const {
    logs,
    pagination,
    filters,
    stats,
    platformStats,
    recentBatches,
    dailyTrend,
    activeBatch,
    loading,
    statsLoading,
    error,
    autoRefreshEnabled,
    isRunning,
    changePage,
    changeLimit,
    updateFilters,
    clearFilters,
    refetch,
    toggleAutoRefresh,
    runAssignment,
    cancelAssignment,
  } = useCampaignAssignment({
    autoRefresh: true,
    refreshInterval: 30000,
  })

  const { toast } = useToast()

  // UI State
  const [selectedLog, setSelectedLog] = useState<CampaignAssignmentLog | null>(null)
  const [showFilters, setShowFilters] = useState(true) // Filters standaard tonen
  const [activeTab, setActiveTab] = useState("logs")
  const [currentSettings, setCurrentSettings] = useState<CampaignSettings>({
    max_total_contacts: 500,
    max_per_platform: 30,
    is_enabled: true
  })

  // Fetch initial settings
  useEffect(() => {
    fetch('/api/campaign-assignment/settings')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.settings) {
          setCurrentSettings({
            max_total_contacts: data.settings.max_total_contacts,
            max_per_platform: data.settings.max_per_platform,
            is_enabled: data.settings.is_enabled
          })
        }
      })
      .catch(console.error)
  }, [])

  const hasActiveFilters =
    filters.search ||
    filters.status ||
    filters.platformId ||
    filters.batchId

  // Status options for filter
  const statusOptions = Object.entries(STATUS_CONFIG).map(([value, config]) => ({
    value,
    label: `${config.icon} ${config.label}`,
  }))

  // Handle run assignment
  const handleRunAssignment = async () => {
    const result = await runAssignment(currentSettings.max_total_contacts, currentSettings.max_per_platform)
    if (result.success) {
      toast({
        title: "Campaign Assignment Gestart",
        description: `Batch ${result.batchId} is gestart met max ${currentSettings.max_total_contacts} contacten (${currentSettings.max_per_platform} per platform).`,
      })
    } else {
      toast({
        title: "Error",
        description: result.error || "Er is iets misgegaan bij het starten van de assignment.",
        variant: "destructive",
      })
    }
  }

  // Handle settings change
  const handleSettingsChange = (settings: any) => {
    setCurrentSettings({
      max_total_contacts: settings.max_total_contacts,
      max_per_platform: settings.max_per_platform,
      is_enabled: settings.is_enabled
    })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Mail className="h-8 w-8" />
            Campaign Assignment
          </h1>
          <p className="text-muted-foreground mt-1">
            Automatische toewijzing van contacts aan Instantly campagnes met AI personalisatie
          </p>
        </div>
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
          <Button onClick={handleRunAssignment} disabled={isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Bezig...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Active Batch Progress - Show loading state or active batch */}
      {statsLoading && recentBatches.length === 0 && (
        <Card className="border-gray-200 bg-gray-50/50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Controleren op actieve batches...</span>
            </div>
          </CardContent>
        </Card>
      )}
      {activeBatch && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <CardTitle className="text-lg">Batch Actief</CardTitle>
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  {activeBatch.batch_id.slice(0, 25)}...
                </Badge>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  const result = await cancelAssignment(activeBatch.batch_id)
                  if (result.success) {
                    toast({
                      title: "Batch Geannuleerd",
                      description: "De campaign assignment is gestopt.",
                    })
                  } else {
                    toast({
                      title: "Error",
                      description: result.error || "Kon batch niet annuleren",
                      variant: "destructive",
                    })
                  }
                }}
              >
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </div>
            <CardDescription>
              Verwerkt contacten... (auto-refresh elke 3 seconden)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Progress
                  value={activeBatch.total_candidates > 0
                    ? (activeBatch.processed / activeBatch.total_candidates) * 100
                    : 0
                  }
                  className="flex-1 h-3"
                />
                <span className="text-sm font-medium min-w-[80px] text-right">
                  {activeBatch.processed} / {activeBatch.total_candidates}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-600 font-medium">
                  ✓ {activeBatch.added} toegevoegd
                </span>
                <span className="text-yellow-600 font-medium">
                  ⊘ {activeBatch.skipped} overgeslagen
                </span>
                {activeBatch.errors > 0 && (
                  <span className="text-red-600 font-medium">
                    ✗ {activeBatch.errors} fouten
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <CampaignAssignmentStatsCards
        stats={stats}
        platformStats={platformStats}
        loading={statsLoading}
      />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <LayoutList className="h-4 w-4" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Batches
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Instellingen
          </TabsTrigger>
        </TabsList>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-6">
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
                        placeholder="Email of bedrijf..."
                        value={filters.search || ""}
                        onChange={(e) => updateFilters({ search: e.target.value })}
                        className="pl-8"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <Select
                      value={filters.status || "all"}
                      onValueChange={(value) => updateFilters({ status: value === "all" ? undefined : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Alle statussen" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Alle statussen</SelectItem>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Batch ID */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Batch ID</label>
                    <Input
                      placeholder="batch_..."
                      value={filters.batchId || ""}
                      onChange={(e) => updateFilters({ batchId: e.target.value || undefined })}
                    />
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Logs Table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  Assignment Logs
                  {pagination.total > 0 && (
                    <span className="text-muted-foreground font-normal ml-2">
                      ({pagination.total.toLocaleString()} totaal)
                    </span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <CampaignAssignmentLogsTable
                logs={logs}
                loading={loading}
                onViewDetails={(log) => setSelectedLog(log)}
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

          {/* Log Detail Drawer */}
          <CampaignAssignmentLogDrawer
            log={selectedLog}
            open={!!selectedLog}
            onClose={() => setSelectedLog(null)}
          />
        </TabsContent>

        {/* Batches Tab */}
        <TabsContent value="batches" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Recente Batches
                {recentBatches.length > 0 && (
                  <span className="text-muted-foreground font-normal ml-2">
                    ({recentBatches.length} batches)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <CampaignAssignmentBatchesTable
                batches={recentBatches}
                loading={statsLoading}
                onSelectBatch={(batchId) => {
                  updateFilters({ batchId })
                  setActiveTab("logs")
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <CampaignAssignmentSettingsCard onSettingsChange={handleSettingsChange} />

          {/* Info about cron job */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cron Job Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Dagelijkse automatische run</p>
                  <p className="text-sm text-muted-foreground">
                    Elke dag om 06:00 (NL tijd) wordt de campaign assignment automatisch uitgevoerd
                  </p>
                </div>
                <Badge variant={currentSettings.is_enabled ? "default" : "secondary"}>
                  {currentSettings.is_enabled ? "Actief" : "Uitgeschakeld"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Huidige configuratie:</strong> Max {currentSettings.max_total_contacts} contacten per run,{" "}
                  {currentSettings.max_per_platform} per platform
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

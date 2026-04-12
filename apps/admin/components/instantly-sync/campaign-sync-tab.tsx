"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import {
  RefreshCw,
  Search,
  Loader2,
  Rocket,
  CheckCircle2,
  XCircle,
  SkipForward,
  ArrowUpDown,
  Mail,
  Users,
  MessageSquare,
  Eye,
  Square,
  Clock,
  Info,
} from "lucide-react"

interface CampaignWithStats {
  id: string
  name: string
  status: string
  leadsCount: number
  contactedCount: number
  emailsSentCount: number
  openCount: number
  replyCount: number
  bouncedCount: number
  completedCount: number
}

interface SkippedBreakdown {
  alreadySynced: number
  duringProcessing: number
  total: number
}

interface ChunkResult {
  success: boolean
  done: boolean
  campaignId?: string
  campaigns?: number
  total?: number
  totalLeads?: number
  leadsProcessed?: number
  synced?: number
  skipped?: SkippedBreakdown | number // Support both old and new format
  errors?: number
  dryRun?: boolean
  duration?: string
}

interface SyncProgress {
  totalSynced: number
  skipped: SkippedBreakdown
  totalErrors: number
  totalLeads: number
  leadsProcessed: number
  chunksCompleted: number
  done: boolean
  startedAt: number
  cancelled: boolean
}

type SortField = "name" | "leadsCount" | "replyCount" | "completedCount" | "status"
type SortDirection = "asc" | "desc"

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  "1": { label: "Actief", variant: "default" },
  "2": { label: "Gepauzeerd", variant: "secondary" },
  "3": { label: "Voltooid", variant: "outline" },
  "0": { label: "Draft", variant: "secondary" },
  "-1": { label: "Error", variant: "destructive" },
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

export function CampaignSyncTab() {
  const { toast } = useToast()

  // Data state
  const [campaigns, setCampaigns] = useState<CampaignWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Filter/sort state
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("leadsCount")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  // Sync options
  const [maxLeads, setMaxLeads] = useState<number>(100)
  const [dryRun, setDryRun] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const cancelRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Fetch campaigns
  const fetchCampaigns = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/instantly/campaigns-with-stats")
      const data = await response.json()
      if (data.success) {
        setCampaigns(data.campaigns)
      } else {
        throw new Error(data.error || "Failed to fetch campaigns")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch campaigns")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  // Filtered and sorted campaigns
  const filteredCampaigns = useMemo(() => {
    let result = campaigns

    // Search filter
    if (search) {
      const lower = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(lower) ||
          c.id.toLowerCase().includes(lower)
      )
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: string | number = a[sortField]
      let bVal: string | number = b[sortField]

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase()
        bVal = (bVal as string).toLowerCase()
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [campaigns, search, sortField, sortDirection])

  // Selection helpers
  const allVisibleSelected =
    filteredCampaigns.length > 0 &&
    filteredCampaigns.every((c) => selectedIds.has(c.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCampaigns.map((c) => c.id)))
    }
  }

  // Sort handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  // Start/stop elapsed timer
  const startTimer = useCallback((startedAt: number) => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer()
  }, [stopTimer])

  // Helper to extract skip breakdown from response (supports old and new format)
  const extractSkipped = (data: ChunkResult): SkippedBreakdown => {
    if (typeof data.skipped === 'object' && data.skipped !== null) {
      return data.skipped as SkippedBreakdown
    }
    // Legacy format: treat all as alreadySynced
    const total = (data.skipped as number) ?? 0
    return { alreadySynced: total, duringProcessing: 0, total }
  }

  // Chunked sync handler
  const handleSync = useCallback(async () => {
    if (selectedIds.size === 0) return

    setSyncing(true)
    cancelRef.current = false

    const startedAt = Date.now()
    const syncProgress: SyncProgress = {
      totalSynced: 0,
      skipped: { alreadySynced: 0, duringProcessing: 0, total: 0 },
      totalErrors: 0,
      totalLeads: 0,
      leadsProcessed: 0,
      chunksCompleted: 0,
      done: false,
      startedAt,
      cancelled: false,
    }
    setProgress({ ...syncProgress })
    setElapsed(0)
    startTimer(startedAt)

    try {
      let isDone = false

      while (!isDone && !cancelRef.current) {
        const response = await fetch("/api/instantly/backfill", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            campaign_ids: Array.from(selectedIds),
            dry_run: dryRun,
            batch_size: 25,
            max_leads: maxLeads || undefined,
            time_limit_ms: 30_000, // 30s chunks for responsive progress updates
          }),
        })

        const data: ChunkResult = await response.json()

        if (!data.success) {
          throw new Error((data as any).error || (data as any).message || "Sync failed")
        }

        // Extract skip breakdown
        const chunkSkipped = extractSkipped(data)

        // Accumulate progress
        syncProgress.totalSynced += data.synced ?? 0
        syncProgress.skipped.alreadySynced += chunkSkipped.alreadySynced
        syncProgress.skipped.duringProcessing += chunkSkipped.duringProcessing
        syncProgress.skipped.total += chunkSkipped.total
        syncProgress.totalErrors += data.errors ?? 0
        syncProgress.totalLeads = data.total ?? data.totalLeads ?? syncProgress.totalLeads
        syncProgress.leadsProcessed += data.leadsProcessed ?? 0
        syncProgress.chunksCompleted += 1
        isDone = data.done

        setProgress({ ...syncProgress, done: isDone })

        // If not done, the backend stopped early due to time limit.
        // On the next request, skipExisting will quickly skip already-synced leads.
        if (!isDone && !cancelRef.current) {
          console.log(`Chunk ${syncProgress.chunksCompleted} done: ${data.synced} synced, ${chunkSkipped.total} skipped. Continuing...`)
        }
      }

      if (cancelRef.current) {
        syncProgress.cancelled = true
        setProgress({ ...syncProgress })
        toast({
          title: "Sync geannuleerd",
          description: `${syncProgress.totalSynced} leads gesynchroniseerd voor annulering.`,
        })
      } else {
        syncProgress.done = true
        setProgress({ ...syncProgress })
        toast({
          title: dryRun ? "Dry run voltooid" : "Sync voltooid",
          description: `${syncProgress.totalSynced} leads gesynchroniseerd, ${syncProgress.skipped.total} overgeslagen, ${syncProgress.totalErrors} fouten (${formatDuration(Date.now() - syncProgress.startedAt)})`,
        })
      }
    } catch (err) {
      toast({
        title: "Sync mislukt",
        description: err instanceof Error ? err.message : "Onbekende fout",
        variant: "destructive",
      })
    } finally {
      stopTimer()
      setSyncing(false)
    }
  }, [selectedIds, dryRun, maxLeads, toast, startTimer, stopTimer])

  const handleCancel = () => {
    cancelRef.current = true
  }

  // Status badge
  const getStatusBadge = (status: string) => {
    const config = STATUS_BADGE[status] || { label: status, variant: "secondary" as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  // Selected campaigns stats
  const selectedCampaigns = campaigns.filter((c) => selectedIds.has(c.id))
  const totalSelectedLeads = selectedCampaigns.reduce((sum, c) => sum + c.leadsCount, 0)

  // Progress percentage (estimate based on synced + skipped vs total)
  const progressPercent = progress && progress.totalLeads > 0
    ? Math.min(100, Math.round(((progress.totalSynced + progress.skipped.total + progress.totalErrors) / progress.totalLeads) * 100))
    : 0

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Campagne Sync</CardTitle>
              <CardDescription>
                Selecteer campagnes om leads naar Pipedrive te syncen
              </CardDescription>
            </div>
            <Button variant="outline" onClick={fetchCampaigns} disabled={loading || syncing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Verversen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Zoek op campagnenaam..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              disabled={syncing}
            />
          </div>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Campaigns Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Campagnes
              {!loading && (
                <span className="text-muted-foreground font-normal ml-2">
                  ({filteredCampaigns.length} van {campaigns.length})
                </span>
              )}
            </CardTitle>
            {selectedIds.size > 0 && (
              <Badge variant="secondary">
                {selectedIds.size} geselecteerd ({totalSelectedLeads.toLocaleString()} leads)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              {search ? "Geen campagnes gevonden voor deze zoekopdracht" : "Geen campagnes gevonden"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Selecteer alles"
                      disabled={syncing}
                    />
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleSort("name")}
                    >
                      Campagne
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                      onClick={() => handleSort("status")}
                    >
                      Status
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                      onClick={() => handleSort("leadsCount")}
                    >
                      <Users className="h-3 w-3" />
                      Leads
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center gap-1 justify-end">
                      <Mail className="h-3 w-3" />
                      Verstuurd
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center gap-1 justify-end">
                      <Eye className="h-3 w-3" />
                      Opens
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                      onClick={() => handleSort("replyCount")}
                    >
                      <MessageSquare className="h-3 w-3" />
                      Replies
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors"
                      onClick={() => handleSort("completedCount")}
                    >
                      Voltooid
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCampaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    className={selectedIds.has(campaign.id) ? "bg-muted/50" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(campaign.id)}
                        onCheckedChange={() => toggleSelect(campaign.id)}
                        aria-label={`Selecteer ${campaign.name}`}
                        disabled={syncing}
                      />
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {campaign.name}
                    </TableCell>
                    <TableCell>{getStatusBadge(String(campaign.status))}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {campaign.leadsCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {campaign.emailsSentCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {campaign.openCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {campaign.replyCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {campaign.completedCount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Sync Controls */}
      {selectedIds.size > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sync naar Pipedrive</CardTitle>
            <CardDescription>
              {selectedIds.size} campagne{selectedIds.size !== 1 ? "s" : ""} geselecteerd
              — {totalSelectedLeads.toLocaleString()} leads totaal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-6 flex-wrap">
              {/* Max leads per campaign */}
              <div className="flex items-center gap-2">
                <Label htmlFor="max-leads-sync" className="flex items-center gap-1">
                  Max leads per campagne:
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Dit is het maximum aantal leads dat per campagne wordt opgehaald van Instantly. Leads die al eerder gesynchroniseerd zijn worden snel overgeslagen.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Input
                  id="max-leads-sync"
                  type="number"
                  min={1}
                  max={10000}
                  value={maxLeads || ""}
                  onChange={(e) =>
                    setMaxLeads(e.target.value ? parseInt(e.target.value) : 0)
                  }
                  placeholder="Alles"
                  className="w-24"
                  disabled={syncing}
                />
              </div>

              {/* Dry run */}
              <div className="flex items-center space-x-2">
                <Switch
                  id="dry-run-sync"
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                  disabled={syncing}
                />
                <Label htmlFor="dry-run-sync">Dry Run</Label>
              </div>
            </div>

            {dryRun && (
              <p className="text-sm text-muted-foreground">
                In dry run modus worden geen echte wijzigingen gemaakt in Pipedrive.
              </p>
            )}

            {/* Sync / Cancel button */}
            {syncing ? (
              <Button
                size="lg"
                variant="destructive"
                onClick={handleCancel}
                className="w-full sm:w-auto"
              >
                <Square className="mr-2 h-4 w-4" />
                Stop sync
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="lg" className="w-full sm:w-auto">
                    <Rocket className="mr-2 h-4 w-4" />
                    {dryRun ? "Start Dry Run" : "Start Sync naar Pipedrive"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {dryRun ? "Dry Run starten?" : "Sync starten?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {dryRun ? (
                        <>
                          Er wordt een dry run gestart voor{" "}
                          <strong>{selectedIds.size} campagne{selectedIds.size !== 1 ? "s" : ""}</strong>.
                          Er worden geen wijzigingen gemaakt.
                        </>
                      ) : (
                        <>
                          Dit synct{" "}
                          {maxLeads ? (
                            <>max <strong>{maxLeads} leads per campagne</strong></>
                          ) : (
                            <strong>alle leads</strong>
                          )}{" "}
                          uit <strong>{selectedIds.size} campagne{selectedIds.size !== 1 ? "s" : ""}</strong>{" "}
                          naar Pipedrive. Bij grote aantallen wordt dit automatisch in chunks verwerkt.
                        </>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleSync}>
                      {dryRun ? "Start Dry Run" : "Ja, start sync"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      )}

      {/* Live Progress */}
      {syncing && progress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              Sync bezig...
              <Badge variant="secondary" className="ml-2">
                Chunk {progress.chunksCompleted + 1}
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Verstreken: {formatDuration(elapsed)}
              {progress.totalLeads > 0 && (
                <span className="ml-2">
                  — {progressPercent}% verwerkt
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress.totalLeads > 0 && (
              <Progress value={progressPercent} className="h-2" />
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Totaal leads</p>
                <p className="text-2xl font-bold tabular-nums">
                  {progress.totalLeads.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Gesynchroniseerd
                </p>
                <p className="text-2xl font-bold tabular-nums text-green-600">
                  {progress.totalSynced.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <SkipForward className="h-3 w-3 text-yellow-500" />
                  Overgeslagen
                </p>
                <p className="text-2xl font-bold tabular-nums text-yellow-600">
                  {progress.skipped.total.toLocaleString()}
                </p>
                {progress.skipped.total > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {progress.skipped.alreadySynced > 0 && (
                      <span className="block">{progress.skipped.alreadySynced.toLocaleString()} al gesynchroniseerd</span>
                    )}
                    {progress.skipped.duringProcessing > 0 && (
                      <span className="block">{progress.skipped.duringProcessing.toLocaleString()} ongeldige data</span>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  Fouten
                </p>
                <p className="text-2xl font-bold tabular-nums text-red-600">
                  {progress.totalErrors.toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Grote batches worden automatisch in chunks van ~4 minuten verwerkt.
              Je kunt deze pagina open laten — de sync gaat automatisch door.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Final Result */}
      {!syncing && progress && (progress.done || progress.cancelled) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {progress.cancelled ? (
                <>
                  <Square className="h-5 w-5 text-orange-500" />
                  Sync geannuleerd
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  {dryRun ? "Dry Run Resultaat" : "Sync Resultaat"}
                </>
              )}
              {progress.chunksCompleted > 1 && (
                <Badge variant="outline" className="ml-2">
                  {progress.chunksCompleted} chunks
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Totaal leads</p>
                <p className="text-2xl font-bold tabular-nums">
                  {progress.totalLeads.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  Gesynchroniseerd
                </p>
                <p className="text-2xl font-bold tabular-nums text-green-600">
                  {progress.totalSynced.toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <SkipForward className="h-3 w-3 text-yellow-500" />
                  Overgeslagen
                </p>
                <p className="text-2xl font-bold tabular-nums text-yellow-600">
                  {progress.skipped.total.toLocaleString()}
                </p>
                {progress.skipped.total > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {progress.skipped.alreadySynced > 0 && (
                      <span className="block">{progress.skipped.alreadySynced.toLocaleString()} al gesynchroniseerd</span>
                    )}
                    {progress.skipped.duringProcessing > 0 && (
                      <span className="block">{progress.skipped.duringProcessing.toLocaleString()} ongeldige data</span>
                    )}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  Fouten
                </p>
                <p className="text-2xl font-bold tabular-nums text-red-600">
                  {progress.totalErrors.toLocaleString()}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              Totale duur: {formatDuration(elapsed)}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

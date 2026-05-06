"use client"

/**
 * BulkActionBar — sticky bar above /job-postings table that shows when
 * one or more job postings are selected.
 *
 * Mode:
 *   'review' (default) → Approve / Reject / Archive knoppen voor pending/
 *     approved/rejected/all tabs.
 *   'archived' → alleen Activeer-knop voor de Archief-tab.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Archive, ArchiveRestore, CheckCircle2, XCircle, Loader2, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"

export interface BulkActionBarProps {
  selectedIds: string[]
  platformId?: string | null
  onDeselect: () => void
  onActionComplete: () => void
  className?: string
  /** 'review' (default) toont Approve/Reject/Archive. 'archived' toont alleen Activate. */
  mode?: "review" | "archived"
}

export function BulkActionBar({
  selectedIds,
  platformId,
  onDeselect,
  onActionComplete,
  className = "",
  mode = "review",
}: BulkActionBarProps) {
  const [loading, setLoading] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const [archiveReason, setArchiveReason] = useState("")

  const count = selectedIds.length
  const isDisabled = loading || count === 0

  const handleApprove = async () => {
    if (isDisabled) return
    setLoading(true)
    try {
      const res = await fetch("/api/review/bulk-approve", {
        method: "POST",
        body: JSON.stringify({
          ids: selectedIds,
          platformId: platformId || undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        toast.error(result.error || "Goedkeuren mislukt")
      } else {
        const approved = result.approved ?? 0
        const errors = result.errors?.length ?? 0
        if (errors > 0) {
          toast.warning(`${approved} goedgekeurd, ${errors} fout(en)`)
        } else {
          toast.success(result.message || `${approved} vacature(s) goedgekeurd`)
        }
        onActionComplete()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij goedkeuren")
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (isDisabled) return
    setRejectDialogOpen(false)
    setLoading(true)
    try {
      const res = await fetch("/api/review/bulk-reject", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        toast.error(result.error || "Afkeuren mislukt")
      } else {
        toast.success(result.message || `${result.rejected ?? 0} vacature(s) afgekeurd`)
        onActionComplete()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij afkeuren")
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async () => {
    if (isDisabled) return
    setLoading(true)
    try {
      const res = await fetch("/api/review/bulk-archive", {
        method: "POST",
        body: JSON.stringify({
          ids: selectedIds,
          reason: archiveReason.trim() || undefined,
        }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        toast.error(result.error || "Archiveren mislukt")
      } else {
        toast.success(result.message || `${result.archived ?? 0} vacature(s) gearchiveerd`)
        setArchiveDialogOpen(false)
        setArchiveReason("")
        onActionComplete()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij archiveren")
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    if (isDisabled) return
    setLoading(true)
    try {
      const res = await fetch("/api/review/bulk-activate", {
        method: "POST",
        body: JSON.stringify({ ids: selectedIds }),
      })
      const result = await res.json()
      if (!res.ok || result.error) {
        toast.error(result.error || "Activeren mislukt")
      } else {
        toast.success(result.message || `${result.activated ?? 0} vacature(s) geactiveerd`)
        onActionComplete()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fout bij activeren")
    } finally {
      setLoading(false)
    }
  }

  if (count === 0) return null

  const barColor =
    mode === "archived"
      ? "border-amber-200 bg-amber-50"
      : "border-blue-200 bg-blue-50"
  const labelColor = mode === "archived" ? "text-amber-800" : "text-blue-800"
  const buttonColor = mode === "archived" ? "text-amber-600 hover:text-amber-800" : "text-blue-600 hover:text-blue-800"

  return (
    <>
      <div className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 ${barColor} ${className}`}>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-medium ${labelColor}`}>{count} geselecteerd</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeselect}
            className={buttonColor}
            disabled={loading}
          >
            <X className="w-4 h-4 mr-1" />
            Deselecteer alles
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {mode === "review" ? (
            <>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isDisabled}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Approve ({count})
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setRejectDialogOpen(true)} disabled={isDisabled}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <XCircle className="h-4 w-4 mr-2" />}
                Reject ({count})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setArchiveDialogOpen(true)}
                disabled={isDisabled}
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Archive className="h-4 w-4 mr-2" />}
                Archiveer ({count})
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={isDisabled}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArchiveRestore className="h-4 w-4 mr-2" />}
              Activeer ({count})
            </Button>
          )}
        </div>
      </div>

      {/* Reject confirmation */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {count} vacature{count !== 1 ? "s" : ""} afkeuren?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deze vacatures worden op &quot;afgekeurd&quot; gezet en verdwijnen van de publieke sites.
              Deze actie kan ongedaan gemaakt worden door de status te wijzigen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} disabled={loading} className="bg-red-600 hover:bg-red-700">
              Afkeuren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive confirmation with optional reason */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {count} vacature{count !== 1 ? "s" : ""} archiveren?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Gearchiveerde vacatures verdwijnen uit de andere tabs. Approved+gepubliceerde
              vacatures verdwijnen meteen uit publieke listings; detail-pagina&apos;s blijven
              30 dagen toegankelijk met &quot;afgelopen&quot;-bordje, daarna 410 Gone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="archive-reason" className="text-sm font-medium">
              Reden (optioneel)
            </Label>
            <Textarea
              id="archive-reason"
              placeholder="Bijv. 'Bedrijf failliet' of 'Niet meer relevant'"
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              disabled={loading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Archiveer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default BulkActionBar

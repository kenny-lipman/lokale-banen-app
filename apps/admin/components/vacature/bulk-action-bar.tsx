"use client"

/**
 * BulkActionBar — sticky bar above /job-postings table that shows when
 * one or more job postings are selected. Provides approve/reject bulk
 * actions that call /api/review/bulk-approve and /api/review/bulk-reject.
 *
 * Used in job-postings-table.tsx when review_status filtering is active
 * (pending/approved/rejected/all tabs).
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Loader2, X } from "lucide-react"
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
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"

export interface BulkActionBarProps {
  selectedIds: string[]
  platformId?: string | null
  onDeselect: () => void
  onActionComplete: () => void
  className?: string
}

export function BulkActionBar({
  selectedIds,
  platformId,
  onDeselect,
  onActionComplete,
  className = "",
}: BulkActionBarProps) {
  const [loading, setLoading] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)

  const count = selectedIds.length
  const isDisabled = loading || count === 0

  const handleApprove = async () => {
    if (isDisabled) return
    setLoading(true)
    try {
      const res = await authFetch("/api/review/bulk-approve", {
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
      const res = await authFetch("/api/review/bulk-reject", {
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

  if (count === 0) return null

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 ${className}`}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-blue-800">
            {count} geselecteerd
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeselect}
            className="text-blue-600 hover:text-blue-800"
            disabled={loading}
          >
            <X className="w-4 h-4 mr-1" />
            Deselecteer alles
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isDisabled}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Approve ({count})
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRejectDialogOpen(true)}
            disabled={isDisabled}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 mr-2" />
            )}
            Reject ({count})
          </Button>
        </div>
      </div>

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
            <AlertDialogAction
              onClick={handleReject}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700"
            >
              Afkeuren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default BulkActionBar

"use client"

import { useState, useCallback, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, MinusCircle, Loader2 } from "lucide-react"

interface PipedriveSyncDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contactIds: string[]
  alreadySyncedCount: number
  onComplete: () => void
}

interface SyncState {
  phase: "confirm" | "syncing" | "done"
  processed: number
  total: number
  success: number
  failed: number
  skipped: number
  current: string
  duration: string
  errors: Array<{ contact: string; reason: string }>
}

export function PipedriveSyncDialog({
  open,
  onOpenChange,
  contactIds,
  alreadySyncedCount,
  onComplete,
}: PipedriveSyncDialogProps) {
  const [state, setState] = useState<SyncState>({
    phase: "confirm",
    processed: 0,
    total: contactIds.length,
    success: 0,
    failed: 0,
    skipped: 0,
    current: "",
    duration: "",
    errors: [],
  })

  const abortRef = useRef<AbortController | null>(null)

  const handleStart = useCallback(async () => {
    setState(prev => ({
      ...prev,
      phase: "syncing",
      processed: 0,
      total: contactIds.length,
      success: 0,
      failed: 0,
      skipped: 0,
      current: "",
      errors: [],
    }))

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch("/api/pipedrive/sync-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        setState(prev => ({
          ...prev,
          phase: "done",
          failed: contactIds.length,
          errors: [{ contact: "-", reason: `HTTP ${response.status}` }],
        }))
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6))

            if (event.type === "progress") {
              setState(prev => ({
                ...prev,
                processed: event.processed,
                success: event.success,
                failed: event.failed,
                skipped: event.skipped,
                current: event.current,
              }))
            } else if (event.type === "error") {
              setState(prev => ({
                ...prev,
                errors: [...prev.errors.slice(-19), { contact: event.contact, reason: event.reason }],
              }))
            } else if (event.type === "done") {
              setState(prev => ({
                ...prev,
                phase: "done",
                success: event.success,
                failed: event.failed,
                skipped: event.skipped,
                duration: event.duration,
              }))
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setState(prev => ({ ...prev, phase: "done", duration: "geannuleerd" }))
      } else {
        setState(prev => ({
          ...prev,
          phase: "done",
          errors: [...prev.errors, { contact: "-", reason: (err as Error).message }],
        }))
      }
    }
  }, [contactIds])

  const handleCancel = () => {
    if (state.phase === "syncing") {
      abortRef.current?.abort()
    }
  }

  const handleClose = () => {
    if (state.phase === "done" && state.success > 0) {
      onComplete()
    }
    setState(prev => ({ ...prev, phase: "confirm", processed: 0, success: 0, failed: 0, skipped: 0, errors: [] }))
    onOpenChange(false)
  }

  const progressPercent = state.total > 0 ? Math.round((state.processed / state.total) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={state.phase === "syncing" ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state.phase === "done" ? "Sync voltooid" : "Sync naar Pipedrive"}
          </DialogTitle>
          {state.phase === "confirm" && (
            <DialogDescription>
              Geselecteerde contacten worden naar Pipedrive gesynchroniseerd.
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Confirm state */}
        {state.phase === "confirm" && (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{contactIds.length}</span> contact{contactIds.length !== 1 ? "en" : ""} geselecteerd
            </p>
            {alreadySyncedCount > 0 && (
              <p className="text-sm text-amber-600">
                {alreadySyncedCount} daarvan al in Pipedrive (worden bijgewerkt)
              </p>
            )}
            {contactIds.length > 300 && (
              <p className="text-sm text-amber-600">
                Grote batch: dit kan enkele minuten duren.
              </p>
            )}
          </div>
        )}

        {/* Syncing state */}
        {state.phase === "syncing" && (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Voortgang</span>
                <span className="font-medium">{state.processed}/{state.total}</span>
              </div>
              <Progress value={progressPercent} />
            </div>
            {state.current && (
              <p className="text-sm text-muted-foreground truncate">
                <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />
                {state.current}
              </p>
            )}
            <div className="flex gap-4 text-sm">
              <span className="text-green-600">
                <CheckCircle className="inline w-3.5 h-3.5 mr-1" />
                {state.success}
              </span>
              {state.failed > 0 && (
                <span className="text-red-600">
                  <XCircle className="inline w-3.5 h-3.5 mr-1" />
                  {state.failed}
                </span>
              )}
              {state.skipped > 0 && (
                <span className="text-gray-500">
                  <MinusCircle className="inline w-3.5 h-3.5 mr-1" />
                  {state.skipped}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Done state */}
        {state.phase === "done" && (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                <p className="text-lg font-semibold text-green-700">{state.success}</p>
                <p className="text-xs text-green-600">Gelukt</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                <p className="text-lg font-semibold text-red-700">{state.failed}</p>
                <p className="text-xs text-red-600">Mislukt</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <MinusCircle className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                <p className="text-lg font-semibold text-gray-700">{state.skipped}</p>
                <p className="text-xs text-gray-500">Overgeslagen</p>
              </div>
            </div>
            {state.duration && (
              <p className="text-sm text-muted-foreground text-center">
                Duur: {state.duration}
              </p>
            )}
            {state.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto border rounded-md p-2">
                {state.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600 py-0.5">
                    <span className="font-medium">{err.contact}</span>: {err.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {state.phase === "confirm" && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuleren
              </Button>
              <Button onClick={handleStart}>
                Start Sync
              </Button>
            </>
          )}
          {state.phase === "syncing" && (
            <Button variant="outline" onClick={handleCancel}>
              Annuleren
            </Button>
          )}
          {state.phase === "done" && (
            <Button onClick={handleClose}>
              Sluiten
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"

export type AutoSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

export interface UseAutoSaveOptions<T> {
  platformId: string
  /** Debounce in ms before PATCH is sent. Defaults to 2000. */
  debounceMs?: number
  /** Transform form values to PATCH payload. */
  toPayload: (values: T) => Record<string, unknown>
  /** Called after a successful PATCH with the updated platform. */
  onSaved?: (updatedPlatform: unknown) => void
  /** Whether form is currently fully loaded — gate autosave until true. */
  enabled?: boolean
}

export interface UseAutoSaveReturn<T> {
  status: AutoSaveStatus
  lastSavedAt: Date | null
  markDirty: (values: T) => void
  flush: () => Promise<void>
  saveNow: (values: T) => Promise<boolean>
  error: string | null
}

/**
 * Generic auto-save hook for the platform editor.
 *
 * Usage:
 *   const autoSave = useAutoSave({
 *     platformId,
 *     toPayload: formToPatchPayload,
 *     onSaved: (platform) => setPlatform(platform),
 *   })
 *   // whenever form changes:
 *   autoSave.markDirty(values)
 */
export function useAutoSave<T>({
  platformId,
  debounceMs = 2000,
  toPayload,
  onSaved,
  enabled = true,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn<T> {
  const [status, setStatus] = useState<AutoSaveStatus>("idle")
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingValuesRef = useRef<T | null>(null)
  const inFlightRef = useRef<boolean>(false)

  const doSave = useCallback(
    async (values: T): Promise<boolean> => {
      if (!platformId) return false
      if (inFlightRef.current) {
        // A save is already in flight — remember latest and bail out. The
        // in-flight save's finally-block will re-enter via the pending ref.
        pendingValuesRef.current = values
        return false
      }

      inFlightRef.current = true
      setStatus("saving")
      setError(null)

      try {
        const res = await authFetch(`/api/review/platforms/${platformId}`, {
          method: "PATCH",
          body: JSON.stringify(toPayload(values)),
        })
        const result = await res.json()
        if (!res.ok || result.error) {
          const msg = result.error || `HTTP ${res.status}`
          setStatus("error")
          setError(msg)
          toast.error(`Opslaan mislukt: ${msg}`)
          return false
        }

        setStatus("saved")
        setLastSavedAt(new Date())
        if (result.data && onSaved) {
          onSaved(result.data)
        }
        return true
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error"
        setStatus("error")
        setError(msg)
        toast.error(`Opslaan mislukt: ${msg}`)
        return false
      } finally {
        inFlightRef.current = false
        // If new changes arrived during the save, trigger another pass.
        const queued = pendingValuesRef.current
        pendingValuesRef.current = null
        if (queued) {
          setStatus("dirty")
          // Minimal delay to allow state to flush; keep consistent with debounce UX.
          timerRef.current = setTimeout(() => {
            void doSave(queued)
          }, 100)
        }
      }
    },
    [platformId, toPayload, onSaved],
  )

  const markDirty = useCallback(
    (values: T) => {
      if (!enabled) return
      setStatus("dirty")
      pendingValuesRef.current = values
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        const latest = pendingValuesRef.current
        pendingValuesRef.current = null
        if (latest) {
          void doSave(latest)
        }
      }, debounceMs)
    },
    [enabled, debounceMs, doSave],
  )

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const latest = pendingValuesRef.current
    pendingValuesRef.current = null
    if (latest) {
      await doSave(latest)
    }
  }, [doSave])

  const saveNow = useCallback(
    async (values: T): Promise<boolean> => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      pendingValuesRef.current = null
      return doSave(values)
    },
    [doSave],
  )

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  return {
    status,
    lastSavedAt,
    markDirty,
    flush,
    saveNow,
    error,
  }
}

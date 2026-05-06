"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { warnIfPostPublishIssue } from "@/lib/publication-toasts"

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
        const res = await fetch(`/api/review/platforms/${platformId}`, {
          method: "PATCH",
          body: JSON.stringify(toPayload(values)),
        })
        const result = await res.json()
        if (!res.ok || result.error) {
          const baseMsg = result.error || `HTTP ${res.status}`
          // H6: missing_checks lijst meelopen in de toast zodat de gebruiker
          // weet waarom de toggle weigerde te publishen.
          const missingChecks: unknown = result?.details?.missing_checks
          const missingMsg =
            Array.isArray(missingChecks) && missingChecks.length > 0
              ? ` (mist: ${missingChecks.join(", ")})`
              : ""
          const msg = `${baseMsg}${missingMsg}`
          setStatus("error")
          setError(msg)
          toast.error(`Opslaan mislukt: ${msg}`)
          // H7: bij publish-fail stuurt de server zijn huidige (niet-live)
          // platform-state mee in `data`. Pingen we `onSaved` daarmee, dan
          // syncen de form-velden terug naar de werkelijke DB-state — de
          // optimistische `is_public: true` toggle valt vanzelf terug naar
          // `false`. Velden die wél opgeslagen zijn blijven correct.
          if (result.data && onSaved) {
            onSaved(result.data)
          }
          return false
        }

        setStatus("saved")
        setLastSavedAt(new Date())
        // alias is alleen aanwezig wanneer de PATCH een publish-flow trok
        // (is_public false→true). Voor reguliere veld-edits is hij `undefined`,
        // dus warnIfPostPublishIssue blijft stil. revalidate is altijd present
        // — daar warnen we alleen op echte fails.
        warnIfPostPublishIssue(result.alias, result.revalidate)
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

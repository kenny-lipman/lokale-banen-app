"use client"

import { useCallback, useEffect, useRef } from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { swrKeys } from "@/lib/swr-keys"

interface AutomationPreference {
  region_id: string
  automation_enabled: boolean
}

interface UseAutomationPreferencesReturn {
  preferences: AutomationPreference[]
  updatePreference: (regionId: string, enabled: boolean) => Promise<void>
  saving: boolean
  error: string | null
  loading: boolean
}

async function fetchAutomationPreferences(): Promise<AutomationPreference[]> {
  const response = await fetch("/api/settings/automation-preferences")
  if (!response.ok) {
    throw new Error("Failed to load preferences")
  }
  const data = await response.json()
  return data.preferences ?? []
}

async function saveAutomationPreferences(preferences: AutomationPreference[]) {
  const response = await fetch("/api/settings/automation-preferences", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ preferences }),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.error || "Failed to save preferences")
  }
  return preferences
}

export const useAutomationPreferences = (): UseAutomationPreferencesReturn => {
  const {
    data: preferences,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<AutomationPreference[]>(
    swrKeys.automationPreferences,
    fetchAutomationPreferences,
  )

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  const updatePreference = useCallback(
    async (regionId: string, enabled: boolean) => {
      const current = preferences ?? []
      const optimistic = current.map((p) =>
        p.region_id === regionId ? { ...p, automation_enabled: enabled } : p,
      )

      // Optimistic UI
      mutate(optimistic, { revalidate: false })

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await saveAutomationPreferences(optimistic)
          toast.success("Automation preferences saved successfully")
          mutate(optimistic, { revalidate: false })
        } catch (err) {
          toast.error("Failed to save automation preferences")
          // Revalidate to roll back to server truth
          mutate()
        }
      }, 1000)
    },
    [preferences, mutate],
  )

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    preferences: preferences ?? [],
    updatePreference,
    saving: isValidating && !isLoading,
    error: error ? (error instanceof Error ? error.message : "Failed to load preferences") : null,
    loading: isLoading,
  }
}

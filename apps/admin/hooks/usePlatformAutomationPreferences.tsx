"use client"

import { useCallback, useState } from "react"
import { toast } from "sonner"
import useSWR from "swr"
import { swrKeys } from "@/lib/swr-keys"

interface PlatformAutomationPreference {
  regio_platform: string
  automation_enabled: boolean
}

interface UsePlatformAutomationPreferencesReturn {
  preferences: PlatformAutomationPreference[]
  updatePreference: (platform: string, enabled: boolean) => Promise<void>
  saving: boolean
  error: string | null
  loading: boolean
}

async function fetchPlatformAutomationPreferences(): Promise<PlatformAutomationPreference[]> {
  const response = await fetch("/api/platforms/automation")
  if (!response.ok) {
    throw new Error("Failed to load platform automation settings")
  }
  const data = await response.json()
  return data.platforms ?? []
}

export function usePlatformAutomationPreferences(): UsePlatformAutomationPreferencesReturn {
  const {
    data: preferences,
    error,
    isLoading,
    mutate,
  } = useSWR<PlatformAutomationPreference[]>(
    swrKeys.platformAutomationPreferences,
    fetchPlatformAutomationPreferences,
  )

  const [saving, setSaving] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const updatePreference = useCallback(
    async (platform: string, enabled: boolean) => {
      const current = preferences ?? []
      const existingIndex = current.findIndex((p) => p.regio_platform === platform)
      const optimistic = [...current]
      if (existingIndex >= 0) {
        optimistic[existingIndex] = { ...optimistic[existingIndex], automation_enabled: enabled }
      } else {
        optimistic.push({ regio_platform: platform, automation_enabled: enabled })
      }

      mutate(optimistic, { revalidate: false })
      setSaving(true)
      setUpdateError(null)

      try {
        const response = await fetch("/api/platforms/automation", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ platform, automation_enabled: enabled }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || "Failed to update platform automation")
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update platform automation"
        setUpdateError(errorMessage)
        toast.error("Failed to update platform automation")
        // Revalidate to roll back to server truth
        mutate()
      } finally {
        setSaving(false)
      }
    },
    [preferences, mutate],
  )

  return {
    preferences: preferences ?? [],
    updatePreference,
    saving,
    error: updateError ?? (error ? (error instanceof Error ? error.message : "Failed to load") : null),
    loading: isLoading,
  }
}

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabaseService } from '@/lib/supabase-service'

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

// Debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function usePlatformAutomationPreferences(): UsePlatformAutomationPreferencesReturn {
  const [preferences, setPreferences] = useState<PlatformAutomationPreference[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get current session for authentication
        const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()

        if (sessionError || !session?.access_token) {
          throw new Error('Authentication required')
        }

        const response = await fetch('/api/settings/platform-automation-preferences', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to load platform preferences')
        }

        const data = await response.json()
        setPreferences(data.preferences || [])
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load platform preferences'
        setError(errorMessage)
        console.error('Error loading platform preferences:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [])

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (newPreferences: PlatformAutomationPreference[]) => {
      setSaving(true)
      setError(null)

      try {
        // Get current session for authentication
        const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()

        if (sessionError || !session?.access_token) {
          throw new Error('Authentication required')
        }

        const response = await fetch('/api/settings/platform-automation-preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ preferences: newPreferences })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to save platform preferences')
        }

        const data = await response.json()
        setPreferences(data.preferences || [])
        setError(null)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to save platform preferences'
        setError(errorMessage)
        console.error('Error saving platform preferences:', err)
        toast.error('Failed to save platform preferences')
      } finally {
        setSaving(false)
      }
    }, 500),
    []
  )

  // Update preference function
  const updatePreference = useCallback(async (platform: string, enabled: boolean) => {
    // Optimistic update
    const newPreferences = [...preferences]
    const existingIndex = newPreferences.findIndex(p => p.regio_platform === platform)
    
    if (existingIndex >= 0) {
      newPreferences[existingIndex] = { ...newPreferences[existingIndex], automation_enabled: enabled }
    } else {
      newPreferences.push({ regio_platform: platform, automation_enabled: enabled })
    }
    
    setPreferences(newPreferences)

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set a new timeout for saving
    saveTimeoutRef.current = setTimeout(() => {
      debouncedSave(newPreferences)
    }, 500)
  }, [preferences, debouncedSave])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    preferences,
    updatePreference,
    saving,
    error,
    loading
  }
} 
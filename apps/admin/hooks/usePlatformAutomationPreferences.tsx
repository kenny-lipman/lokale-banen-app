import { useState, useCallback, useEffect } from 'react'
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

export function usePlatformAutomationPreferences(): UsePlatformAutomationPreferencesReturn {
  const [preferences, setPreferences] = useState<PlatformAutomationPreference[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load preferences on mount from platforms table
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

        const response = await fetch('/api/platforms/automation', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to load platform automation settings')
        }

        const data = await response.json()
        setPreferences(data.platforms || [])
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load platform automation settings'
        setError(errorMessage)
        console.error('Error loading platform automation settings:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPreferences()
  }, [])

  // Update preference function - now updates platforms table directly
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
    setSaving(true)
    setError(null)

    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required')
      }

      const response = await fetch('/api/platforms/automation', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          platform: platform,
          automation_enabled: enabled 
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update platform automation')
      }

      const data = await response.json()
      setError(null)
      
      // Update local state with the response
      if (data.success) {
        // Keep the optimistic update since it succeeded
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update platform automation'
      setError(errorMessage)
      console.error('Error updating platform automation:', err)
      
      // Revert optimistic update on error
      const revertedPreferences = [...preferences]
      if (existingIndex >= 0) {
        revertedPreferences[existingIndex] = { ...revertedPreferences[existingIndex], automation_enabled: !enabled }
      }
      setPreferences(revertedPreferences)
      
      toast.error('Failed to update platform automation')
    } finally {
      setSaving(false)
    }
  }, [preferences])

  return {
    preferences,
    updatePreference,
    saving,
    error,
    loading
  }
} 
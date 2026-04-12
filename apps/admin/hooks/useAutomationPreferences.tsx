"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { supabaseService } from '@/lib/supabase-service'

interface AutomationPreference {
  region_id: string;
  automation_enabled: boolean;
}

interface UseAutomationPreferencesReturn {
  preferences: AutomationPreference[];
  updatePreference: (regionId: string, enabled: boolean) => Promise<void>;
  saving: boolean;
  error: string | null;
  loading: boolean;
}

// Debounce function
const debounce = <T extends (...args: any[]) => any>(
  func: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: NodeJS.Timeout

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

export const useAutomationPreferences = (): UseAutomationPreferencesReturn => {
  const [preferences, setPreferences] = useState<AutomationPreference[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const pendingSavesRef = useRef<Set<string>>(new Set())

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (newPreferences: AutomationPreference[]) => {
      setSaving(true)
      setError(null)
      
      try {
        // Get current session for authentication
        const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()
        
        if (sessionError || !session?.access_token) {
          throw new Error('Authentication required')
        }
        
        const response = await fetch('/api/settings/automation-preferences', {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ preferences: newPreferences })
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to save preferences')
        }
        
        // Update cache
        localStorage.setItem('automation_preferences', JSON.stringify(newPreferences))
        
        // Clear pending saves
        pendingSavesRef.current.clear()
        
        // Show success toast
        toast.success('Automation preferences saved successfully')
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        setError(errorMessage)
        
        // Show error toast
        toast.error('Failed to save automation preferences')
        
        throw err
      } finally {
        setSaving(false)
      }
    }, 1000), // 1 second delay
    []
  )

  const updatePreference = useCallback(async (regionId: string, enabled: boolean) => {
    // Add to pending saves to prevent duplicate requests
    pendingSavesRef.current.add(regionId)
    
    const newPreferences = preferences.map(pref =>
      pref.region_id === regionId 
        ? { ...pref, automation_enabled: enabled }
        : pref
    )
    
    // Optimistic update
    setPreferences(newPreferences)
    
    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      debouncedSave(newPreferences)
    }, 1000)
  }, [preferences, debouncedSave])

  // Load initial preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true)
        setError(null)

        // Try to load from cache first
        const cached = localStorage.getItem('automation_preferences')
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            setPreferences(parsed)
          } catch {
            // Invalid cache, ignore
          }
        }

        // Get current session for authentication
        const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()
        
        if (sessionError || !session?.access_token) {
          throw new Error('Authentication required')
        }
        
        // Load from API
        const response = await fetch('/api/settings/automation-preferences', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setPreferences(data.preferences)
          
          // Update cache
          localStorage.setItem('automation_preferences', JSON.stringify(data.preferences))
        } else {
          throw new Error('Failed to load preferences')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load preferences'
        setError(errorMessage)
        console.error('Error loading automation preferences:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadPreferences()
  }, [])

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
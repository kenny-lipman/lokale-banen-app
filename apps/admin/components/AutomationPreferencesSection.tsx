"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Settings, Zap, CheckCircle } from 'lucide-react'
import { PlatformGroup } from './PlatformGroup'
import { useAutomationPreferences } from '@/hooks/useAutomationPreferences'
import { toast } from 'sonner'
import { supabaseService } from '@/lib/supabase-service'

interface AutomationPreferencesSectionProps {
  onPreferencesChange?: (preferences: Array<{ region_id: string; automation_enabled: boolean }>) => void;
}

interface CentralPlace {
  central_place: string;
  central_postcode?: string;
}

interface PlatformGroupData {
  platform: string;
  centralPlace?: CentralPlace;
  regions: {
    id: string;
    plaats: string;
    postcode: string;
    automation_enabled: boolean;
  }[];
}

export const AutomationPreferencesSection: React.FC<AutomationPreferencesSectionProps> = ({
  onPreferencesChange
}) => {
  const [platforms, setPlatforms] = useState<PlatformGroupData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedPlatforms, setExpandedPlatforms] = useState<Set<string>>(new Set())

  const {
    preferences,
    updatePreference,
    saving,
    error: preferencesError
  } = useAutomationPreferences()

  // Load regions grouped by platform
  useEffect(() => {
    const loadRegions = async () => {
      try {
        setLoading(true)
        setError(null)

        // Get current session for authentication
        const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()
        
        if (sessionError || !session?.access_token) {
          throw new Error('Authentication required')
        }
        
        const response = await fetch('/api/regions/grouped-by-platform', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (!response.ok) {
          throw new Error('Failed to load regions')
        }

        const data = await response.json()
        setPlatforms(data.platforms)
        
        // Expand first platform by default
        if (data.platforms.length > 0) {
          setExpandedPlatforms(new Set([data.platforms[0].platform]))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load regions')
      } finally {
        setLoading(false)
      }
    }

    loadRegions()
  }, [])

  const handleRegionToggle = async (regionId: string, enabled: boolean) => {
    try {
      await updatePreference(regionId, enabled)
      
      // Update local state
      setPlatforms(prevPlatforms => 
        prevPlatforms.map(platform => ({
          ...platform,
          regions: platform.regions.map(region => 
            region.id === regionId 
              ? { ...region, automation_enabled: enabled }
              : region
          )
        }))
      )

      // Notify parent component
      onPreferencesChange?.(preferences)
      
      // Show success toast
      const regionName = platforms
        .flatMap(p => p.regions)
        .find(r => r.id === regionId)?.plaats || 'Region'
      
      toast.success(`${regionName} automation ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Failed to update preference:', error)
      
      // Show error toast
      const regionName = platforms
        .flatMap(p => p.regions)
        .find(r => r.id === regionId)?.plaats || 'Region'
      
      toast.error(`Failed to update ${regionName} automation`)
    }
  }

  const togglePlatformExpanded = (platform: string) => {
    setExpandedPlatforms(prev => {
      const newSet = new Set(prev)
      if (newSet.has(platform)) {
        newSet.delete(platform)
      } else {
        newSet.add(platform)
      }
      return newSet
    })
  }

  const getTotalEnabledCount = () => {
    return platforms.reduce((total, platform) => 
      total + platform.regions.filter(r => r.automation_enabled).length, 0
    )
  }

  const getTotalRegionsCount = () => {
    return platforms.reduce((total, platform) => total + platform.regions.length, 0)
  }

  const getCentralPlacesCount = () => {
    return platforms.filter(platform => platform.centralPlace).length
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-48" />
          </div>
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <div className="space-y-2 pl-4">
                {[1, 2, 3].map(j => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}. Please refresh the page to try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full" role="region" aria-label="Automation preferences settings">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg" aria-hidden="true">
            <Zap className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-xl" id="automation-title">Job Posting Automation</CardTitle>
            <CardDescription id="automation-description">
              Control which regions have automated job posting scraping enabled. Each platform has a central place where job postings are scraped from.
            </CardDescription>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="flex items-center space-x-4 text-sm text-gray-600" aria-live="polite" aria-atomic="true">
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span id="enabled-count">{getTotalEnabledCount()} of {getTotalRegionsCount()} regions enabled</span>
          </div>
          {getCentralPlacesCount() > 0 && (
            <div className="flex items-center space-x-1 text-blue-600">
              <span>• {getCentralPlacesCount()} platforms with central places configured</span>
            </div>
          )}
          {saving && (
            <div className="flex items-center space-x-1 text-blue-600" aria-live="assertive">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" aria-hidden="true"></div>
              <span>Saving...</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {preferencesError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {preferencesError}. Your changes may not have been saved.
            </AlertDescription>
          </Alert>
        )}

        {platforms.length === 0 ? (
          <div className="text-center py-8 text-gray-500" role="status" aria-live="polite">
            <Settings className="h-12 w-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
            <p>No regions found. Please contact your administrator.</p>
          </div>
        ) : (
          <div className="space-y-4" role="list" aria-labelledby="automation-title">
            {platforms.map((platform) => (
              <PlatformGroup
                key={platform.platform}
                platform={platform.platform}
                regions={platform.regions}
                centralPlace={platform.centralPlace}
                onRegionToggle={handleRegionToggle}
                expanded={expandedPlatforms.has(platform.platform)}
                onToggleExpanded={() => togglePlatformExpanded(platform.platform)}
                saving={saving}
              />
            ))}
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="space-y-1">
                <li>• Each platform has a <strong>central place</strong> (marked with 🎯) where job postings are scraped from</li>
                <li>• Enabled regions will have job postings scraped automatically at 4 AM daily</li>
                <li>• Only job postings from the last 24 hours will be collected</li>
                <li>• Changes are saved automatically when you toggle regions</li>
                <li>• You can collapse/expand platform sections to focus on specific areas</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
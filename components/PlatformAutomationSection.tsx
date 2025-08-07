"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Settings, Zap, CheckCircle, Target } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { usePlatformAutomationPreferences } from '@/hooks/usePlatformAutomationPreferences'
import { toast } from 'sonner'
import { supabaseService } from '@/lib/supabase-service'

interface PlatformAutomationSectionProps {
  onPreferencesChange?: (preferences: Array<{ regio_platform: string; automation_enabled: boolean }>) => void;
}

interface PlatformData {
  platform: string;
  centralPlace?: {
    central_place: string;
    central_postcode?: string;
  };
  automation_enabled: boolean;
  regions: {
    id: string;
    plaats: string;
    postcode: string;
  }[];
}

export const PlatformAutomationSection: React.FC<PlatformAutomationSectionProps> = ({
  onPreferencesChange
}) => {
  const [platforms, setPlatforms] = useState<PlatformData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const {
    preferences,
    updatePreference,
    saving,
    error: preferencesError
  } = usePlatformAutomationPreferences()

  // Load platforms grouped by platform
  useEffect(() => {
    const loadPlatforms = async () => {
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
          throw new Error('Failed to load platforms')
        }

        const data = await response.json()
        setPlatforms(data.platforms)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load platforms')
      } finally {
        setLoading(false)
      }
    }

    loadPlatforms()
  }, [])

  const handlePlatformToggle = async (platform: string, enabled: boolean) => {
    try {
      await updatePreference(platform, enabled)
      
      // Update local state
      setPlatforms(prevPlatforms => 
        prevPlatforms.map(p => 
          p.platform === platform 
            ? { ...p, automation_enabled: enabled }
            : p
        )
      )

      // Notify parent component
      onPreferencesChange?.(preferences)
      
      // Show success toast
      const platformData = platforms.find(p => p.platform === platform)
      const centralPlace = platformData?.centralPlace?.central_place || platform
      
      toast.success(`${centralPlace} automation ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Failed to update preference:', error)
      
      // Show error toast
      const platformData = platforms.find(p => p.platform === platform)
      const centralPlace = platformData?.centralPlace?.central_place || platform
      
      toast.error(`Failed to update ${centralPlace} automation`)
    }
  }

  const getTotalEnabledCount = () => {
    return platforms.filter(p => p.automation_enabled).length
  }

  const getTotalPlatformsCount = () => {
    return platforms.length
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
            <Skeleton key={i} className="h-16 w-full" />
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
    <Card className="w-full" role="region" aria-label="Platform automation preferences settings">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg" aria-hidden="true">
            <Zap className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-xl" id="platform-automation-title">Scrape Automation</CardTitle>
            <CardDescription id="platform-automation-description">
              Selecteer voor welke platforms je automatische scrapen wilt inschakelen. Er zal dagelijks om 4:00 uur een nieuwe scrape worden gemaakt via de daily scrape webhook.
            </CardDescription>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="flex items-center space-x-4 text-sm text-gray-600" aria-live="polite" aria-atomic="true">
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span id="enabled-count">{getTotalEnabledCount()} of {getTotalPlatformsCount()} platforms enabled</span>
          </div>
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
            <p>No platforms found. Please contact your administrator.</p>
          </div>
        ) : (
          <div className="space-y-3" role="list" aria-labelledby="platform-automation-title">
            {platforms.map((platform) => (
              <div 
                key={platform.platform}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                role="listitem"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {/* Platform Icon */}
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-lg flex-shrink-0" aria-hidden="true">
                    <Target className="h-5 w-5 text-blue-600" />
                  </div>
                  
                  {/* Platform Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {platform.platform}
                      </h3>
                      {platform.centralPlace ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          🎯 {platform.centralPlace.central_place}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          ⚠️ No central place configured
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {platform.regions.length} places • Scraping from {platform.centralPlace?.central_place || 'central place'}
                      {platform.centralPlace?.central_postcode && ` (${platform.centralPlace.central_postcode})`}
                    </p>
                  </div>
                </div>
                
                {/* Toggle Switch */}
                <div className="flex items-center space-x-2 ml-4">
                  <Switch
                    checked={platform.automation_enabled}
                    onCheckedChange={(enabled) => handlePlatformToggle(platform.platform, enabled)}
                    disabled={saving}
                    aria-label={`${platform.automation_enabled ? 'Disable' : 'Enable'} automation for ${platform.platform}`}
                    className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200"
                  />
                  
                  {/* Status indicator */}
                  <div className="flex items-center space-x-1" aria-live="polite" aria-atomic="true">
                    <div 
                      className={`w-2 h-2 rounded-full transition-colors ${
                        platform.automation_enabled ? 'bg-green-500' : 'bg-gray-300'
                      }`} 
                      aria-hidden="true"
                    />
                    <span className="text-xs text-gray-500 font-medium">
                      {platform.automation_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Hoe werkt het:</p>
              <ul className="space-y-1">
                <li>• Elk platform heeft een <strong>centrale plek</strong> (aangeduid met 🎯) waarvan vacatures worden opgehaald</li>
                <li>• De centrale plek is de hoofdlocatie die de hele regio van het platform dekt</li>
                <li>• Ingeschakelde platforms worden dagelijks om 04:00 uur automatisch gescand via de daily scrape webhook</li>
                <li>• Voor elk platform wordt een aparte webhook call gemaakt met de centrale plek</li>
                <li>• Alleen vacatures van de afgelopen 24 uur worden verzameld</li>
                <li>• Wijzigingen worden automatisch opgeslagen wanneer je platforms aan- of uitzet</li>
  <li>• Deze aanpak vermindert complexiteit – je beheert platforms in plaats van afzonderlijke regio’s</li>
</ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 
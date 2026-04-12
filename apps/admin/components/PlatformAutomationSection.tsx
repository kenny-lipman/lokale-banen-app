"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Settings, Zap, CheckCircle, Target, Save, Link, Unlink } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { usePlatformAutomationPreferences } from '@/hooks/usePlatformAutomationPreferences'
import { toast } from 'sonner'
import { supabaseService } from '@/lib/supabase-service'

interface PlatformAutomationSectionProps {
  onPreferencesChange?: (preferences: Array<{ regio_platform: string; automation_enabled: boolean }>) => void;
}

interface PlatformData {
  regio_platform: string;
  central_place: string;
  central_postcode?: string;
  automation_enabled: boolean;
  is_active: boolean;
  instantly_campaign_id?: string | null;
}

export const PlatformAutomationSection: React.FC<PlatformAutomationSectionProps> = ({
  onPreferencesChange
}) => {
  const [platforms, setPlatforms] = useState<PlatformData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingCampaign, setEditingCampaign] = useState<Record<string, string>>({})
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null)

  const {
    preferences,
    updatePreference,
    saving,
    error: preferencesError
  } = usePlatformAutomationPreferences()

  // Load platforms directly from platforms table
  useEffect(() => {
    const loadPlatforms = async () => {
      try {
        setLoading(true)
        setError(null)

        const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()

        if (sessionError || !session?.access_token) {
          throw new Error('Authentication required')
        }

        const response = await fetch('/api/platforms', {
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

  const getAuthToken = async () => {
    const { data: { session } } = await supabaseService.client.auth.getSession()
    return session?.access_token
  }

  const patchPlatform = async (platformName: string, updates: Record<string, unknown>) => {
    const token = await getAuthToken()
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`/api/regio-platforms/central-places/${encodeURIComponent(platformName)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Update failed')
    }

    return response.json()
  }

  const handlePlatformToggle = async (platform: string, enabled: boolean) => {
    try {
      await updatePreference(platform, enabled)

      setPlatforms(prev =>
        prev.map(p =>
          p.regio_platform === platform
            ? { ...p, automation_enabled: enabled }
            : p
        )
      )

      onPreferencesChange?.(preferences)

      const platformData = platforms.find(p => p.regio_platform === platform)
      const centralPlace = platformData?.central_place || platform
      toast.success(`${centralPlace} automation ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Failed to update preference:', error)
      const platformData = platforms.find(p => p.regio_platform === platform)
      const centralPlace = platformData?.central_place || platform
      toast.error(`Failed to update ${centralPlace} automation`)
    }
  }

  const handleIsActiveToggle = async (platform: string, isActive: boolean) => {
    setSavingPlatform(platform)
    try {
      await patchPlatform(platform, { is_active: isActive })

      setPlatforms(prev =>
        prev.map(p =>
          p.regio_platform === platform
            ? { ...p, is_active: isActive }
            : p
        )
      )

      toast.success(`${platform} ${isActive ? 'geactiveerd' : 'gedeactiveerd'}`)
    } catch (error) {
      console.error('Failed to toggle is_active:', error)
      toast.error(`Kon ${platform} niet ${isActive ? 'activeren' : 'deactiveren'}`)
    } finally {
      setSavingPlatform(null)
    }
  }

  const handleSaveCampaignId = async (platform: string) => {
    const campaignId = editingCampaign[platform]?.trim() || null

    setSavingPlatform(platform)
    try {
      await patchPlatform(platform, { instantly_campaign_id: campaignId })

      setPlatforms(prev =>
        prev.map(p =>
          p.regio_platform === platform
            ? { ...p, instantly_campaign_id: campaignId }
            : p
        )
      )

      setEditingCampaign(prev => {
        const next = { ...prev }
        delete next[platform]
        return next
      })

      toast.success(campaignId
        ? `Campaign ID gekoppeld aan ${platform}`
        : `Campaign ID ontkoppeld van ${platform}`)
    } catch (error) {
      console.error('Failed to save campaign ID:', error)
      toast.error(`Kon campaign ID niet opslaan voor ${platform}`)
    } finally {
      setSavingPlatform(null)
    }
  }

  const startEditingCampaign = (platform: string, currentId: string | null | undefined) => {
    setEditingCampaign(prev => ({
      ...prev,
      [platform]: currentId || ''
    }))
  }

  const cancelEditingCampaign = (platform: string) => {
    setEditingCampaign(prev => {
      const next = { ...prev }
      delete next[platform]
      return next
    })
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
            <CardTitle className="text-xl" id="platform-automation-title">Platform Management</CardTitle>
            <CardDescription id="platform-automation-description">
              Beheer platform status, scrape automation en Instantly campaign koppelingen.
            </CardDescription>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="flex items-center space-x-4 text-sm text-gray-600" aria-live="polite" aria-atomic="true">
          <div className="flex items-center space-x-1">
            <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" />
            <span id="enabled-count">{getTotalEnabledCount()} of {getTotalPlatformsCount()} platforms enabled</span>
          </div>
          {(saving || savingPlatform) && (
            <div className="flex items-center space-x-1 text-blue-600" aria-live="assertive">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600" aria-hidden="true"></div>
              <span>Opslaan...</span>
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
            {platforms.map((platform) => {
              const isEditing = platform.regio_platform in editingCampaign
              const isSaving = savingPlatform === platform.regio_platform

              return (
                <div
                  key={platform.regio_platform}
                  className={`p-4 border rounded-lg transition-colors ${
                    platform.is_active
                      ? 'border-gray-200 hover:bg-gray-50'
                      : 'border-gray-200 bg-gray-50 opacity-75'
                  }`}
                  role="listitem"
                >
                  {/* Top row: Platform info + toggles */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      {/* Platform Icon */}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${
                        platform.is_active ? 'bg-blue-50' : 'bg-gray-100'
                      }`} aria-hidden="true">
                        <Target className={`h-5 w-5 ${
                          platform.is_active ? 'text-blue-600' : 'text-gray-400'
                        }`} />
                      </div>

                      {/* Platform Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className={`font-semibold truncate ${
                            platform.is_active ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                            {platform.regio_platform}
                          </h3>
                          {platform.central_place ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {platform.central_place}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              No central place
                            </span>
                          )}
                          {/* Campaign linked badge */}
                          {platform.instantly_campaign_id ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <Link className="h-3 w-3 mr-1" />
                              Campaign gekoppeld
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                              <Unlink className="h-3 w-3 mr-1" />
                              Geen campaign
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          {platform.central_place || 'central place'}
                          {platform.central_postcode && ` (${platform.central_postcode})`}
                        </p>
                      </div>
                    </div>

                    {/* Toggles */}
                    <div className="flex items-center space-x-6 ml-4">
                      {/* is_active toggle */}
                      <div className="flex flex-col items-center space-y-1">
                        <Switch
                          checked={platform.is_active}
                          onCheckedChange={(active) => handleIsActiveToggle(platform.regio_platform, active)}
                          disabled={isSaving}
                          aria-label={`${platform.is_active ? 'Deactivate' : 'Activate'} ${platform.regio_platform}`}
                          className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-200"
                        />
                        <span className="text-xs text-gray-500 font-medium">
                          {platform.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      {/* automation_enabled toggle */}
                      <div className="flex flex-col items-center space-y-1">
                        <Switch
                          checked={platform.automation_enabled}
                          onCheckedChange={(enabled) => handlePlatformToggle(platform.regio_platform, enabled)}
                          disabled={saving || isSaving}
                          aria-label={`${platform.automation_enabled ? 'Disable' : 'Enable'} automation for ${platform.regio_platform}`}
                          className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200"
                        />
                        <span className="text-xs text-gray-500 font-medium">
                          {platform.automation_enabled ? 'Auto On' : 'Auto Off'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Campaign ID row */}
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-medium text-gray-500 whitespace-nowrap">Instantly Campaign:</span>
                      {isEditing ? (
                        <div className="flex items-center space-x-2 flex-1">
                          <input
                            type="text"
                            value={editingCampaign[platform.regio_platform] || ''}
                            onChange={(e) => setEditingCampaign(prev => ({
                              ...prev,
                              [platform.regio_platform]: e.target.value
                            }))}
                            placeholder="Plak campaign ID hier..."
                            className="flex-1 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                            disabled={isSaving}
                          />
                          <button
                            onClick={() => handleSaveCampaignId(platform.regio_platform)}
                            disabled={isSaving}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3 mr-1" />
                            Opslaan
                          </button>
                          <button
                            onClick={() => cancelEditingCampaign(platform.regio_platform)}
                            disabled={isSaving}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                          >
                            Annuleren
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 flex-1">
                          <code className="text-xs text-gray-600 font-mono truncate max-w-[300px]">
                            {platform.instantly_campaign_id || 'Niet gekoppeld'}
                          </code>
                          <button
                            onClick={() => startEditingCampaign(platform.regio_platform, platform.instantly_campaign_id)}
                            disabled={isSaving}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                          >
                            {platform.instantly_campaign_id ? 'Wijzigen' : 'Koppelen'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Hoe werkt het:</p>
              <ul className="space-y-1">
                <li>• <strong>Active/Inactive</strong> — Zet het platform aan of uit. Inactieve platforms worden niet meegenomen in campaign assignment.</li>
                <li>• <strong>Auto On/Off</strong> — Schakelt automatische scraping in/uit voor het platform.</li>
                <li>• <strong>Instantly Campaign</strong> — Koppel een Instantly campaign ID om leads automatisch toe te voegen via de dagelijkse campaign assignment.</li>
                <li>• Campaign assignment draait dagelijks om 08:00 NL tijd en voegt nieuwe leads toe aan gekoppelde campaigns.</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

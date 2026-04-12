"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, Mail, CheckCircle, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import { supabaseService } from '@/lib/supabase-service'

interface MailerLiteGroup {
  id: string
  name: string
  active_count: number
}

interface PlatformData {
  regio_platform: string
  mailerlite_group_id: string | null
}

interface MailerLiteGroupSectionProps {
  onConfigChange?: (config: { platform: string; groupId: string | null }) => void
}

export const MailerLiteGroupSection: React.FC<MailerLiteGroupSectionProps> = ({
  onConfigChange
}) => {
  const [groups, setGroups] = useState<MailerLiteGroup[]>([])
  const [platforms, setPlatforms] = useState<PlatformData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null)

  const getAuthToken = async () => {
    const { data: { session } } = await supabaseService.client.auth.getSession()
    return session?.access_token
  }

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const token = await getAuthToken()
        if (!token) {
          throw new Error('Authentication required')
        }

        const headers = { 'Authorization': `Bearer ${token}` }

        // Fetch groups and platforms in parallel
        const [groupsRes, platformsRes] = await Promise.all([
          fetch('/api/mailerlite/groups', { headers }),
          fetch('/api/platforms', { headers })
        ])

        if (!groupsRes.ok) {
          throw new Error('Failed to load MailerLite groups')
        }
        if (!platformsRes.ok) {
          throw new Error('Failed to load platforms')
        }

        const groupsData = await groupsRes.json()
        const platformsData = await platformsRes.json()

        setGroups(groupsData.groups || [])
        setPlatforms(platformsData.platforms || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleGroupChange = async (platform: string, groupId: string | null) => {
    try {
      setSavingPlatform(platform)
      const token = await getAuthToken()
      if (!token) throw new Error('Authentication required')

      const response = await fetch(`/api/regio-platforms/central-places/${platform}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mailerlite_group_id: groupId || null
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update platform')
      }

      // Update local state
      setPlatforms(prev => prev.map(p =>
        p.regio_platform === platform
          ? { ...p, mailerlite_group_id: groupId }
          : p
      ))

      toast.success(`MailerLite groep ${groupId ? 'gekoppeld' : 'ontkoppeld'} voor ${platform}`)
      onConfigChange?.({ platform, groupId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update mislukt')
    } finally {
      setSavingPlatform(null)
    }
  }

  /**
   * Auto-match suggestion: if platform name appears in group name, suggest it
   */
  const getSuggestedGroup = (platformName: string): string | null => {
    // Extract base name: "AlmeerseBanen" -> "almeer" or "Almere"
    const baseName = platformName.replace(/Banen$/i, '').toLowerCase()
    const match = groups.find(g => g.name.toLowerCase().includes(baseName))
    return match?.id || null
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            MailerLite Groep-Koppeling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            MailerLite Groep-Koppeling
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  const linkedCount = platforms.filter(p => p.mailerlite_group_id).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          MailerLite Groep-Koppeling
        </CardTitle>
        <CardDescription>
          Koppel elke platform aan een MailerLite &quot;Werkgevers&quot; groep voor de maandelijkse nieuwsbrief.
          {' '}{linkedCount}/{platforms.length} platforms gekoppeld.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {platforms.map(platform => {
            const currentGroupId = platform.mailerlite_group_id
            const suggestedGroupId = !currentGroupId ? getSuggestedGroup(platform.regio_platform) : null
            const isSaving = savingPlatform === platform.regio_platform

            return (
              <div
                key={platform.regio_platform}
                className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-white"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {currentGroupId ? (
                    <Link2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Unlink className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{platform.regio_platform}</p>
                    {currentGroupId && (
                      <p className="text-xs text-green-600">Gekoppeld</p>
                    )}
                    {!currentGroupId && suggestedGroupId && (
                      <p className="text-xs text-amber-500">Suggestie beschikbaar</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="text-sm border rounded-md px-2 py-1.5 bg-white min-w-[200px] disabled:opacity-50"
                    value={currentGroupId || ''}
                    onChange={(e) => handleGroupChange(platform.regio_platform, e.target.value || null)}
                    disabled={isSaving}
                  >
                    <option value="">-- Geen groep --</option>
                    {suggestedGroupId && !currentGroupId && (
                      <option value={suggestedGroupId} className="font-bold">
                        {groups.find(g => g.id === suggestedGroupId)?.name} (Suggestie)
                      </option>
                    )}
                    {groups.map(group => (
                      <option
                        key={group.id}
                        value={group.id}
                        // Don't duplicate the suggested option
                        hidden={!currentGroupId && group.id === suggestedGroupId}
                      >
                        {group.name} ({group.active_count} abonnees)
                      </option>
                    ))}
                  </select>

                  {isSaving && (
                    <div className="h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {groups.length === 0 && (
          <Alert className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Geen &quot;Werkgevers&quot; groepen gevonden in MailerLite. Controleer of de API key correct is geconfigureerd.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { MapPin, AlertCircle, CheckCircle, RefreshCw, XCircle } from 'lucide-react'
import { supabaseService } from '@/lib/supabase-service'

interface Region {
  id: string
  regio_platform: string
  plaats: string
  postcode: string
  created_at: string
}

interface PlatformData {
  platform: string;
  centralPlace?: {
    central_place: string;
    central_postcode?: string;
  };
  automation_enabled: boolean;
  is_active: boolean;
  regions: {
    id: string;
    plaats: string;
    postcode: string;
  }[];
}

interface ActiveRegionsSectionProps {
  onRegionsChange?: (activeRegions: Region[]) => void
}

export const ActiveRegionsSection: React.FC<ActiveRegionsSectionProps> = ({
  onRegionsChange
}) => {
  const [activeRegions, setActiveRegions] = useState<Region[]>([])
  const [platforms, setPlatforms] = useState<PlatformData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadActiveRegions = async () => {
    try {
      setError(null)
      const regions = await supabaseService.getActiveRegions()
      setActiveRegions(regions)
      onRegionsChange?.(regions)
    } catch (err) {
      console.error('Error loading active regions:', err)
      setError('Kon actieve regio\'s niet laden')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadPlatforms = async () => {
    try {
      // Get current session for authentication
      const { data: { session }, error: sessionError } = await supabaseService.client.auth.getSession()
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required')
      }
      
      // Load platforms directly from platforms table for accurate statistics
      const response = await fetch('/api/platforms', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load platforms')
      }

      const data = await response.json()
      // Convert platforms data to match expected format
      const platformsData = data.platforms?.map((p: any) => ({
        platform: p.regio_platform,
        automation_enabled: p.automation_enabled,
        is_active: p.is_active,
        regions: [] // Not needed for statistics
      })) || []
      
      setPlatforms(platformsData)
    } catch (err) {
      console.error('Error loading platforms:', err)
      // Don't set error for platforms as it's not critical for this component
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadActiveRegions(), loadPlatforms()])
  }

  useEffect(() => {
    Promise.all([loadActiveRegions(), loadPlatforms()])
  }, [])

  // Group regions by platform for better UX
  const regionsByPlatform = activeRegions.reduce((acc, region) => {
    if (!acc[region.regio_platform]) {
      acc[region.regio_platform] = []
    }
    acc[region.regio_platform].push(region)
    return acc
  }, {} as Record<string, Region[]>)

  const totalActiveRegions = activeRegions.length
  
  // Platform statistics based on is_active status
  const getTotalActivePlatforms = () => {
    return platforms.filter(p => p.is_active).length
  }
  
  const getTotalInactivePlatforms = () => {
    return platforms.filter(p => !p.is_active).length
  }
  
  const getTotalAutomationEnabledPlatforms = () => {
    return platforms.filter(p => p.automation_enabled).length
  }

  const getTotalPlatforms = () => {
    return platforms.length
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            <div>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48 mt-2" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            <div>
              <CardTitle>Actieve Regio's</CardTitle>
              <CardDescription>Regio's met actieve centrale plaatsen</CardDescription>
            </div>
          </div>
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-orange-500" />
            <div>
              <CardTitle className="flex items-center gap-2">
                Statistieken
                <CheckCircle className="w-4 h-4 text-green-500" />
              </CardTitle>
              <CardDescription>
                Overzicht van platform en regio statistieken
              </CardDescription>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="shrink-0 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Vernieuwen
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg bg-orange-50">
            <div className="text-2xl font-bold text-orange-600">{getTotalActivePlatforms()}</div>
            <div className="text-sm text-gray-600">Actieve Platforms</div>
          </div>
          <div className="p-4 border rounded-lg bg-red-50">
            <div className="text-2xl font-bold text-red-600">{getTotalInactivePlatforms()}</div>
            <div className="text-sm text-gray-600">Inactieve Platforms</div>
          </div>
          <div className="p-4 border rounded-lg bg-blue-50">
            <div className="text-2xl font-bold text-blue-600">{getTotalAutomationEnabledPlatforms()}</div>
            <div className="text-sm text-gray-600">Actieve scraping platforms</div>
          </div>
        </div>

        {/* Alert for when no regions found */}
        {getTotalActivePlatforms() === 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Geen actieve platforms gevonden. Controleer platform configuratie.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
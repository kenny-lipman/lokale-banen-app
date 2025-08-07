"use client"

import React, { useState, memo } from 'react'
import { Switch } from '@/components/ui/switch'
import { Loader2, MapPin, Target } from 'lucide-react'

interface Region {
  id: string;
  plaats: string;
  postcode: string;
  automation_enabled: boolean;
}

interface CentralPlace {
  central_place: string;
  central_postcode?: string;
}

interface RegionToggleProps {
  region: Region;
  centralPlace?: CentralPlace;
  onToggle: (regionId: string, enabled: boolean) => void;
  saving?: boolean;
}

export const RegionToggle: React.FC<RegionToggleProps> = memo(({
  region,
  centralPlace,
  onToggle,
  saving = false
}) => {
  const [localEnabled, setLocalEnabled] = useState(region.automation_enabled)
  const [isSaving, setIsSaving] = useState(false)

  const isCentralPlace = centralPlace && region.plaats === centralPlace.central_place

  const handleToggle = async (enabled: boolean) => {
    // Optimistic update for immediate feedback
    setLocalEnabled(enabled)
    setIsSaving(true)
    
    try {
      await onToggle(region.id, enabled)
      // Success - local state already updated
    } catch (error) {
      // Revert on error
      setLocalEnabled(!enabled)
      console.error(`Failed to update ${region.plaats} automation:`, error)
    } finally {
      setIsSaving(false)
    }
  }

  const isLoading = isSaving || saving

  return (
    <div className="px-4 py-3 hover:bg-gray-50 transition-colors relative" role="listitem">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1 min-w-0">
          {/* Location Icon */}
          <div className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-full flex-shrink-0" aria-hidden="true">
            {isCentralPlace ? (
              <Target className="h-4 w-4 text-blue-600" />
            ) : (
              <MapPin className="h-4 w-4 text-blue-600" />
            )}
          </div>
          
          {/* Region Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h4 className="font-medium text-gray-900 truncate" id={`region-${region.id}-name`}>
                {region.plaats}
              </h4>
              {isCentralPlace && (
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  aria-label="This is the central place for job posting scraping"
                >
                  Central
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate" aria-describedby={`region-${region.id}-name`}>
              {region.postcode}
            </p>
          </div>
        </div>
        
        {/* Toggle Switch */}
        <div className="flex items-center space-x-2 ml-4">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
          )}
          
          <Switch
            checked={localEnabled}
            onCheckedChange={handleToggle}
            disabled={isLoading}
            aria-label={`${localEnabled ? 'Disable' : 'Enable'} automation for ${region.plaats}${isCentralPlace ? ' (central place)' : ''}`}
            aria-describedby={`region-${region.id}-name`}
            className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-gray-200"
          />
          
          {/* Status indicator */}
          <div className="flex items-center space-x-1" aria-live="polite" aria-atomic="true">
            <div 
              className={`w-2 h-2 rounded-full transition-colors ${
                localEnabled ? 'bg-green-500' : 'bg-gray-300'
              }`} 
              aria-hidden="true"
            />
            <span className="text-xs text-gray-500 font-medium">
              {localEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Loading overlay for better UX */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center rounded" aria-hidden="true">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  )
}) 
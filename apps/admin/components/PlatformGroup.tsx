"use client"

import React, { memo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { RegionToggle } from './RegionToggle'
import { CentralPlaceIndicator, CentralPlaceTooltip } from './CentralPlaceIndicator'

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

interface PlatformGroupProps {
  platform: string;
  regions: Region[];
  centralPlace?: CentralPlace;
  onRegionToggle: (regionId: string, enabled: boolean) => void;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  saving?: boolean;
}

export const PlatformGroup: React.FC<PlatformGroupProps> = memo(({
  platform,
  regions,
  centralPlace,
  onRegionToggle,
  expanded = true,
  onToggleExpanded,
  saving = false
}) => {
  const enabledCount = regions.filter(r => r.automation_enabled).length
  const totalCount = regions.length

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white" role="listitem">
      {/* Platform Header */}
      <div 
        className="px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer border-b border-gray-200"
        onClick={onToggleExpanded}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleExpanded?.()
          }
        }}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ${platform} regions`}
        aria-describedby={`${platform}-stats`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-6 h-6">
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-gray-500 transition-transform" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-500 transition-transform" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-1">
                <h3 className="font-semibold text-gray-900">{platform}</h3>
                {centralPlace && (
                  <CentralPlaceTooltip>
                    <CentralPlaceIndicator
                      centralPlace={centralPlace.central_place}
                      centralPostcode={centralPlace.central_postcode}
                      variant="compact"
                      showLabel={false}
                    />
                  </CentralPlaceTooltip>
                )}
              </div>
              <p className="text-sm text-gray-600" id={`${platform}-stats`}>
                {enabledCount} of {totalCount} regions enabled
                {centralPlace && (
                  <span className="ml-2 text-blue-600">
                    • Scraping from {centralPlace.central_place}
                  </span>
                )}
              </p>
            </div>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-sm text-gray-500" aria-hidden="true">
              <span className="font-medium">{enabledCount}</span>
              <span>/</span>
              <span>{totalCount}</span>
            </div>
            <div 
              className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden" 
              role="progressbar"
              aria-valuenow={enabledCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-label={`${enabledCount} of ${totalCount} regions enabled for ${platform}`}
            >
              <div 
                className="h-full bg-green-500 transition-all duration-300 ease-out"
                style={{ width: `${totalCount > 0 ? (enabledCount / totalCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Regions List */}
      {expanded && (
        <div className="divide-y divide-gray-100" role="list" aria-label={`${platform} regions`}>
          {regions.map((region) => (
            <RegionToggle
              key={region.id}
              region={region}
              centralPlace={centralPlace}
              onToggle={onRegionToggle}
              saving={saving}
            />
          ))}
        </div>
      )}
    </div>
  )
}) 
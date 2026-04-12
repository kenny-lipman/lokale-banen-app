"use client"

import { useState } from 'react'
import { MapPin, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocationData } from '@/hooks/use-location-data'

interface LocationSummaryCompactProps {
  contactIds: string[]
}

export function LocationSummaryCompact({ contactIds }: LocationSummaryCompactProps) {
  const [expanded, setExpanded] = useState(false)
  const { data, loading, error } = useLocationData(contactIds)
  
  // Don't show anything if no contacts selected
  if (!contactIds.length) return null
  
  // Loading state
  if (loading) {
    return (
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          <span className="text-sm font-medium">Locaties laden...</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-32 mb-1" />
            <Skeleton className="h-3 w-28" />
          </div>
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-3 w-32 mb-1" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="p-3 bg-red-50 rounded-lg border border-red-200">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-red-600" />
          <span className="text-sm text-red-700">
            Kon locatie data niet laden
          </span>
        </div>
      </div>
    )
  }
  
  // No data state
  if (!data) return null
  
  const showExpander = 
    data.companyLocations.length > 3 || 
    data.jobLocations.length > 3
  
  const displayCompanyLocations = expanded 
    ? data.companyLocations 
    : data.companyLocations.slice(0, 3)
    
  const displayJobLocations = expanded 
    ? data.jobLocations 
    : data.jobLocations.slice(0, 3)
  
  return (
    <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-600" />
          <h4 className="font-medium text-sm text-gray-900">Locatie Overzicht</h4>
        </div>
        
        {/* Location Grid */}
        <div className="grid grid-cols-2 gap-4">
          {/* Company Locations */}
          <div>
            <p className="text-xs text-gray-600 mb-2 font-medium">
              Bedrijfslocaties {data.uniqueCompanyLocations > 0 && `(${data.uniqueCompanyLocations} uniek)`}
            </p>
            {displayCompanyLocations.length > 0 ? (
              <ul className="space-y-1">
                {displayCompanyLocations.map((location, index) => (
                  <li 
                    key={`company-${location.name}-${index}`} 
                    className="flex justify-between text-xs text-gray-700"
                  >
                    <span className="truncate">• {location.name}</span>
                    <span className="text-gray-500 ml-2 flex-shrink-0">
                      ({location.count})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 italic">Geen locaties gevonden</p>
            )}
          </div>
          
          {/* Job Locations */}
          <div>
            <p className="text-xs text-gray-600 mb-2 font-medium">
              Vacature locaties {data.totalJobPostings > 0 && `(${data.totalJobPostings} totaal)`}
            </p>
            {displayJobLocations.length > 0 ? (
              <ul className="space-y-1">
                {displayJobLocations.map((location, index) => (
                  <li 
                    key={`job-${location.name}-${index}`} 
                    className="flex justify-between text-xs text-gray-700"
                  >
                    <span className="truncate">• {location.name}</span>
                    <span className="text-gray-500 ml-2 flex-shrink-0">
                      ({location.count})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400 italic">Geen vacatures gevonden</p>
            )}
          </div>
        </div>
        
        {/* Expand/Collapse Button */}
        {showExpander && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full text-xs h-7 text-gray-600 hover:text-gray-800"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Toon minder
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Toon alle {data.totalLocations} locaties
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
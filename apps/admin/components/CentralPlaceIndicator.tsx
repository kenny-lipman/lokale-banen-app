"use client"

import React from 'react'
import { Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CentralPlaceIndicatorProps {
  centralPlace: string
  centralPostcode?: string
  className?: string
  showLabel?: boolean
  variant?: 'default' | 'compact' | 'highlighted'
}

export const CentralPlaceIndicator: React.FC<CentralPlaceIndicatorProps> = ({
  centralPlace,
  centralPostcode,
  className = "",
  showLabel = true,
  variant = 'default'
}) => {
  const baseClasses = "flex items-center space-x-2 text-sm"
  
  const variantClasses = {
    default: "text-blue-600",
    compact: "text-blue-600 text-xs",
    highlighted: "text-blue-700 font-medium bg-blue-50 px-2 py-1 rounded-md"
  }

  const iconClasses = {
    default: "text-lg",
    compact: "text-sm",
    highlighted: "text-base"
  }

  return (
    <div 
      className={cn(
        baseClasses,
        variantClasses[variant],
        className
      )}
      role="status"
      aria-label={`Central place: ${centralPlace}${centralPostcode ? ` (${centralPostcode})` : ''}`}
    >
      <Target 
        className={cn("flex-shrink-0", iconClasses[variant])}
        aria-hidden="true"
      />
      
      {showLabel && (
        <span className="font-medium">Central Place:</span>
      )}
      
      <span className="font-semibold truncate" title={centralPlace}>
        {centralPlace}
      </span>
      
      {centralPostcode && (
        <span 
          className="text-gray-500 flex-shrink-0"
          aria-label={`Postcode: ${centralPostcode}`}
        >
          ({centralPostcode})
        </span>
      )}
    </div>
  )
}

// Tooltip component for explaining central place concept
export const CentralPlaceTooltip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        <div className="text-center">
          <div className="font-medium mb-1">Central Place</div>
          <div className="text-gray-300">
            This is the main location where job postings will be scraped from for this platform
          </div>
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  )
} 
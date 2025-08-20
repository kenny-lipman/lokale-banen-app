'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { LayoutGrid, List, Table } from 'lucide-react'

export type ViewMode = 'cards' | 'list' | 'table'

interface ViewModeOption {
  mode: ViewMode
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  description: string
}

const viewModeOptions: ViewModeOption[] = [
  {
    mode: 'cards',
    label: 'Cards',
    icon: LayoutGrid,
    description: 'Card view with rich details'
  },
  {
    mode: 'list',
    label: 'List',
    icon: List,
    description: 'Compact list showing 15-20 runs'
  },
  {
    mode: 'table',
    label: 'Table',
    icon: Table,
    description: 'Dense table view for quick scanning'
  }
]

interface ViewModeToggleProps {
  currentMode: ViewMode
  onModeChange: (mode: ViewMode) => void
  availableModes?: ViewMode[]
  className?: string
}

export function ViewModeToggle({
  currentMode,
  onModeChange,
  availableModes = ['cards', 'list'],
  className
}: ViewModeToggleProps) {
  const filteredOptions = viewModeOptions.filter(option => 
    availableModes.includes(option.mode)
  )

  return (
    <div className={cn('inline-flex rounded-lg bg-gray-100 p-1', className)}>
      {filteredOptions.map((option) => {
        const Icon = option.icon
        const isActive = currentMode === option.mode
        
        return (
          <button
            key={option.mode}
            onClick={() => onModeChange(option.mode)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200',
              isActive
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            )}
            title={option.description}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Hook for managing view mode with localStorage persistence
export function useViewMode(defaultMode: ViewMode = 'list', storageKey = 'otis-view-mode') {
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    if (typeof window === 'undefined') return defaultMode
    
    try {
      const stored = localStorage.getItem(storageKey)
      return (stored as ViewMode) || defaultMode
    } catch {
      return defaultMode
    }
  })

  const setMode = React.useCallback((mode: ViewMode) => {
    setViewMode(mode)
    try {
      localStorage.setItem(storageKey, mode)
    } catch (error) {
      console.warn('Failed to save view mode to localStorage:', error)
    }
  }, [storageKey])

  return { viewMode, setMode }
}

// View mode stats component for showing density info
interface ViewModeStatsProps {
  mode: ViewMode
  totalRuns: number
  className?: string
}

export function ViewModeStats({ mode, totalRuns, className }: ViewModeStatsProps) {
  const getVisibilityInfo = (mode: ViewMode) => {
    switch (mode) {
      case 'cards':
        return {
          visible: Math.min(4, totalRuns),
          description: 'runs visible without scrolling'
        }
      case 'list':
        return {
          visible: Math.min(15, totalRuns),
          description: 'runs visible at once'
        }
      case 'table':
        return {
          visible: Math.min(25, totalRuns),
          description: 'runs in dense view'
        }
      default:
        return {
          visible: totalRuns,
          description: 'runs'
        }
    }
  }

  const info = getVisibilityInfo(mode)

  return (
    <div className={cn('text-xs text-gray-500', className)}>
      {info.visible} of {totalRuns} {info.description}
    </div>
  )
}
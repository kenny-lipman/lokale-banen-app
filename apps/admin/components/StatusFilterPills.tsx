'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { ProcessingStatusType } from './ProcessingStatus'
import { CheckCircle2, Clock, Circle, RotateCcw } from 'lucide-react'

export type StatusFilter = 'all' | ProcessingStatusType

interface StatusCount {
  all: number
  not_started: number
  in_progress: number
  completed: number
}

interface FilterOption {
  filter: StatusFilter
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  color: string
  bgColor: string
  textColor: string
}

const filterOptions: FilterOption[] = [
  {
    filter: 'all',
    label: 'All',
    icon: RotateCcw,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-800'
  },
  {
    filter: 'not_started',
    label: 'Not Started',
    icon: Circle,
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-800'
  },
  {
    filter: 'in_progress',
    label: 'In Progress',
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-800'
  },
  {
    filter: 'completed',
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    textColor: 'text-emerald-800'
  }
]

interface StatusFilterPillsProps {
  activeFilter: StatusFilter
  counts: StatusCount
  onFilterChange: (filter: StatusFilter) => void
  className?: string
}

export function StatusFilterPills({
  activeFilter,
  counts,
  onFilterChange,
  className
}: StatusFilterPillsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {filterOptions.map((option) => {
        const Icon = option.icon
        const count = counts[option.filter]
        const isActive = activeFilter === option.filter
        
        return (
          <button
            key={option.filter}
            onClick={() => onFilterChange(option.filter)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-all duration-200',
              'border border-transparent',
              isActive 
                ? cn(option.bgColor, option.textColor, 'shadow-sm')
                : 'text-gray-600 bg-white border-gray-200 hover:bg-gray-50',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1'
            )}
          >
            <Icon 
              size={14} 
              className={cn(
                isActive ? option.color : 'text-gray-400'
              )} 
            />
            <span>{option.label}</span>
            <span 
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-full',
                isActive 
                  ? 'bg-white/80 text-gray-600'
                  : 'bg-gray-100 text-gray-500'
              )}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Quick stats summary component
interface StatusStatsProps {
  counts: StatusCount
  className?: string
}

export function StatusStats({ counts, className }: StatusStatsProps) {
  const completionRate = counts.all > 0 ? (counts.completed / counts.all * 100) : 0

  return (
    <div className={cn('flex items-center gap-4 text-sm text-gray-600', className)}>
      <span>
        <span className="font-medium">{counts.all}</span> total runs
      </span>
      
      <div className="w-px h-4 bg-gray-300" />
      
      <span>
        <span className="font-medium text-emerald-600">{counts.completed}</span> completed
      </span>
      
      {counts.in_progress > 0 && (
        <>
          <span>
            <span className="font-medium text-amber-600">{counts.in_progress}</span> in progress
          </span>
        </>
      )}
      
      <div className="w-px h-4 bg-gray-300" />
      
      <span>
        <span className="font-medium">{completionRate.toFixed(0)}%</span> completion rate
      </span>
    </div>
  )
}

// Hook for managing filter state with URL persistence
export function useStatusFilter(defaultFilter: StatusFilter = 'all') {
  const [activeFilter, setActiveFilter] = React.useState<StatusFilter>(defaultFilter)

  // Update URL params when filter changes
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    if (activeFilter === 'all') {
      url.searchParams.delete('status')
    } else {
      url.searchParams.set('status', activeFilter)
    }
    
    // Update URL without page reload
    window.history.replaceState({}, '', url.toString())
  }, [activeFilter])

  // Initialize from URL on mount
  React.useEffect(() => {
    if (typeof window === 'undefined') return

    const urlParams = new URLSearchParams(window.location.search)
    const statusParam = urlParams.get('status') as StatusFilter
    
    if (statusParam && ['all', 'not_started', 'in_progress', 'completed'].includes(statusParam)) {
      setActiveFilter(statusParam)
    }
  }, [])

  return { activeFilter, setActiveFilter }
}

// Utility function to calculate status counts from runs data
export function calculateStatusCounts<T extends { processing_status: ProcessingStatusType }>(
  runs: T[]
): StatusCount {
  return runs.reduce(
    (counts, run) => {
      counts.all++
      counts[run.processing_status]++
      return counts
    },
    {
      all: 0,
      not_started: 0,
      in_progress: 0,
      completed: 0
    } as StatusCount
  )
}
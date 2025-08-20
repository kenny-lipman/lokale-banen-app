'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Clock } from 'lucide-react'

export type ProcessingStatusType = 'not_started' | 'in_progress' | 'completed'

interface ProcessingStatusProps {
  status: ProcessingStatusType
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  className?: string
}

const statusConfig = {
  not_started: {
    icon: Circle,
    label: 'Not Started',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    hoverColor: 'hover:bg-slate-200',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-700'
  },
  in_progress: {
    icon: Clock,
    label: 'In Progress',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    hoverColor: 'hover:bg-amber-100',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-800'
  },
  completed: {
    icon: CheckCircle2,
    label: 'Completed',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    hoverColor: 'hover:bg-emerald-100',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-800'
  }
}

const sizeConfig = {
  sm: {
    iconSize: 16,
    fontSize: 'text-xs',
    padding: 'px-2 py-1'
  },
  md: {
    iconSize: 20,
    fontSize: 'text-sm',
    padding: 'px-3 py-1.5'
  },
  lg: {
    iconSize: 24,
    fontSize: 'text-base',
    padding: 'px-4 py-2'
  }
}

export function ProcessingStatus({
  status,
  onClick,
  size = 'md',
  showLabel = true,
  className
}: ProcessingStatusProps) {
  const config = statusConfig[status]
  const sizeSettings = sizeConfig[size]
  const Icon = config.icon

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md transition-all duration-200 border',
        config.bgColor,
        config.textColor,
        config.borderColor,
        onClick && config.hoverColor,
        onClick && 'cursor-pointer shadow-sm hover:shadow-md',
        !onClick && 'cursor-default',
        sizeSettings.padding,
        sizeSettings.fontSize,
        className
      )}
      title={onClick ? `Click to change status (current: ${config.label})` : config.label}
    >
      <Icon size={sizeSettings.iconSize} className={cn("flex-shrink-0", config.color)} />
      {showLabel && <span className="font-semibold">{config.label}</span>}
    </button>
  )
}

// Hook for cycling through statuses
export function useProcessingStatus(initialStatus: ProcessingStatusType = 'not_started') {
  const [status, setStatus] = React.useState<ProcessingStatusType>(initialStatus)

  const cycleStatus = React.useCallback(() => {
    setStatus(current => {
      switch (current) {
        case 'not_started':
          return 'in_progress'
        case 'in_progress':
          return 'completed'
        case 'completed':
          return 'not_started'
        default:
          return 'not_started'
      }
    })
  }, [])

  return { status, setStatus, cycleStatus }
}
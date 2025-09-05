'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { ProcessingStatusType } from './ProcessingStatus'
import { 
  X, 
  CheckCircle2, 
  Clock, 
  Circle, 
  Trash2, 
  Download,
  ChevronDown,
  Loader2
} from 'lucide-react'

interface BulkActionBarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkStatusUpdate: (status: ProcessingStatusType) => Promise<void>
  onBulkExport?: () => void
  onBulkDelete?: () => void
  isLoading?: boolean
  className?: string
}

const statusActions = [
  {
    status: 'not_started' as ProcessingStatusType,
    label: 'Mark as Not Started',
    icon: Circle,
    color: 'text-gray-600'
  },
  {
    status: 'in_progress' as ProcessingStatusType,
    label: 'Mark as In Progress',
    icon: Clock,
    color: 'text-blue-600'
  },
  {
    status: 'completed' as ProcessingStatusType,
    label: 'Mark as Completed',
    icon: CheckCircle2,
    color: 'text-green-600'
  }
]

export function BulkActionBar({
  selectedCount,
  onClearSelection,
  onBulkStatusUpdate,
  onBulkExport,
  onBulkDelete,
  isLoading = false,
  className
}: BulkActionBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  if (selectedCount === 0) return null

  const handleStatusUpdate = async (status: ProcessingStatusType) => {
    setActionLoading(status)
    setIsDropdownOpen(false)
    
    try {
      await onBulkStatusUpdate(status)
    } catch (error) {
      console.error('Bulk status update failed:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleExport = async () => {
    if (!onBulkExport) return
    
    setActionLoading('export')
    try {
      await onBulkExport()
    } catch (error) {
      console.error('Bulk export failed:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!onBulkDelete) return

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedCount} run${selectedCount > 1 ? 's' : ''}? This action cannot be undone.`
    )
    
    if (!confirmed) return

    setActionLoading('delete')
    try {
      await onBulkDelete()
    } catch (error) {
      console.error('Bulk delete failed:', error)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className={cn(
      'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50',
      'bg-white border border-gray-200 rounded-lg shadow-lg',
      'flex items-center gap-4 px-4 py-3 min-w-[400px]',
      'animate-in slide-in-from-bottom-2 duration-200',
      className
    )}>
      {/* Selection info */}
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">
          {selectedCount} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Clear selection"
        >
          <X size={16} />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-gray-200" />

      {/* Status update dropdown */}
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={isLoading || actionLoading !== null}
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
            'bg-blue-500 text-white hover:bg-blue-600',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {actionLoading && statusActions.find(a => a.status === actionLoading) ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Updating...
            </>
          ) : (
            <>
              Update Status
              <ChevronDown size={14} />
            </>
          )}
        </button>

        {/* Dropdown menu */}
        {isDropdownOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10"
              onClick={() => setIsDropdownOpen(false)}
            />
            
            {/* Menu */}
            <div className="absolute bottom-full mb-2 left-0 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[180px]">
              {statusActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.status}
                    onClick={() => handleStatusUpdate(action.status)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors first:rounded-t-md last:rounded-b-md"
                  >
                    <Icon size={16} className={action.color} />
                    {action.label}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Additional actions */}
      <div className="flex items-center gap-2">
        {onBulkExport && (
          <button
            onClick={handleExport}
            disabled={isLoading || actionLoading !== null}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Export selected runs"
          >
            {actionLoading === 'export' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            Export
          </button>
        )}

        {onBulkDelete && (
          <button
            onClick={handleDelete}
            disabled={isLoading || actionLoading !== null}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Delete selected runs"
          >
            {actionLoading === 'delete' ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Trash2 size={12} />
            )}
            Delete
          </button>
        )}
      </div>

      {/* Loading overlay */}
      {(isLoading || actionLoading !== null) && (
        <div className="absolute inset-0 bg-white/50 rounded-lg" />
      )}
    </div>
  )
}

// Hook for managing bulk actions
export function useBulkActions(
  selectedRuns: string[],
  onBulkStatusUpdate: (runIds: string[], status: ProcessingStatusType) => Promise<void>
) {
  const [isLoading, setIsLoading] = useState(false)

  const handleBulkStatusUpdate = async (status: ProcessingStatusType) => {
    if (selectedRuns.length === 0) return

    setIsLoading(true)
    try {
      await onBulkStatusUpdate(selectedRuns, status)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBulkExport = async () => {
    if (selectedRuns.length === 0) return
    
    // Create CSV export of selected runs
    const exportData = selectedRuns.map(runId => ({
      runId,
      exportedAt: new Date().toISOString()
    }))
    
    const csv = [
      'Run ID,Exported At',
      ...exportData.map(row => `${row.runId},${row.exportedAt}`)
    ].join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `apify-runs-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    
    URL.revokeObjectURL(url)
  }

  return {
    isLoading,
    handleBulkStatusUpdate,
    handleBulkExport
  }
}
'use client'

import React, { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ProcessingStatus, ProcessingStatusType } from './ProcessingStatus'
import { ProcessingNotes } from './ProcessingNotes'
import { Calendar, MapPin, Building2 } from 'lucide-react'

export interface ApifyRun {
  id: string
  title: string
  platform: string
  location: string
  companyCount: number
  displayName: string
  createdAt: string
  processing_status: ProcessingStatusType
  processing_notes: string | null
  processed_at: string | null
}

interface RunListItemProps {
  run: ApifyRun
  isSelected: boolean
  onRunSelect: (runId: string) => void
  onStatusChange: (runId: string, status: ProcessingStatusType) => Promise<void>
  onNotesChange: (runId: string, notes: string) => Promise<void>
  className?: string
}

function RunListItem({
  run,
  isSelected,
  onRunSelect,
  onStatusChange,
  onNotesChange,
  className
}: RunListItemProps) {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  
  // Debug logging to see what data we're getting
  if (run.id && !run.companyCount) {
    console.log('Debug: Run data missing companyCount', { id: run.id, companyCount: run.companyCount })
  }

  const handleStatusClick = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row selection when clicking status
    if (isUpdatingStatus) return
    
    setIsUpdatingStatus(true)
    try {
      // Cycle to next status
      const nextStatus: ProcessingStatusType = 
        run.processing_status === 'not_started' ? 'in_progress' :
        run.processing_status === 'in_progress' ? 'completed' : 'not_started'
      
      await onStatusChange(run.id, nextStatus)
    } catch (error) {
      console.error('Failed to update status:', error)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleNotesChange = async (notes: string) => {
    await onNotesChange(run.id, notes)
  }

  const handleRowClick = () => {
    onRunSelect(run.id)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div 
      onClick={handleRowClick}
      className={cn(
        'group border-b border-gray-100 last:border-b-0 transition-colors cursor-pointer',
        isSelected && 'bg-blue-100 border-blue-300 shadow-sm',
        run.processing_status === 'completed' && !isSelected && 'bg-emerald-50 hover:bg-emerald-100',
        run.processing_status === 'in_progress' && !isSelected && 'bg-amber-50 hover:bg-amber-100',
        run.processing_status === 'not_started' && !isSelected && 'bg-slate-50 hover:bg-slate-100',
        className
      )}
    >
      {/* Main row - compact */}
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Processing status */}
        <ProcessingStatus
          status={run.processing_status}
          onClick={handleStatusClick}
          size="sm"
          showLabel={false}
          className={isUpdatingStatus ? 'opacity-50' : ''}
        />

        {/* Run details - single line compact */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate text-xs max-w-48">
              {run.title}
            </h3>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Building2 size={8} />
              {run.platform}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Calendar size={8} />
              {formatDate(run.createdAt)}
            </span>
            {run.processed_at && (
              <span className="text-xs text-emerald-600">
                ✓ {formatDate(run.processed_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notes row - compact */}
      <div className="px-3 pb-2 pl-8"> {/* Offset for checkbox and status */}
        <ProcessingNotes
          notes={run.processing_notes}
          onSave={handleNotesChange}
          placeholder="Add notes..."
          className="text-xs"
        />
      </div>
    </div>
  )
}

interface RunListViewProps {
  runs: ApifyRun[]
  selectedRun: string | null
  onRunSelect: (runId: string) => void
  onStatusChange: (runId: string, status: ProcessingStatusType) => Promise<void>
  onNotesChange: (runId: string, notes: string) => Promise<void>
  className?: string
}

export function RunListView({
  runs,
  selectedRun,
  onRunSelect,
  onStatusChange,
  onNotesChange,
  className
}: RunListViewProps) {

  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Header - compact */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">
            {runs.length} runs
          </span>
        </div>
      </div>

      {/* Run list */}
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        {runs.map((run) => (
          <RunListItem
            key={run.id}
            run={run}
            isSelected={selectedRun === run.id}
            onRunSelect={onRunSelect}
            onStatusChange={onStatusChange}
            onNotesChange={onNotesChange}
          />
        ))}
      </div>

      {/* Empty state */}
      {runs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-2">
            <Building2 size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No runs found</h3>
          <p className="text-gray-500">
            Try adjusting your filters or create a new scraping run.
          </p>
        </div>
      )}
    </div>
  )
}
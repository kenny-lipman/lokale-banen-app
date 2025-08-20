'use client'

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { ProcessingStatus, ProcessingStatusType } from './ProcessingStatus'
import { ProcessingNotes } from './ProcessingNotes'
import { ProcessingNotesModal } from './ProcessingNotesModal'
import { Calendar, MapPin, Building2, Briefcase } from 'lucide-react'
import { ApifyRun } from './RunListView'

// Fixed row height for virtualization (more dense - includes notes area)
const ROW_HEIGHT = 80

interface VirtualizedRunListProps {
  runs: ApifyRun[]
  selectedRun: string | null
  onRunSelect: (runId: string) => void
  onStatusChange: (runId: string, status: ProcessingStatusType) => Promise<void>
  onNotesChange: (runId: string, notes: string) => Promise<void>
  className?: string
  height?: number
}

interface RunRowProps {
  run: ApifyRun
  isSelected: boolean
  onRunSelect: (runId: string) => void
  onStatusChange: (runId: string, status: ProcessingStatusType) => Promise<void>
  onNotesChange: (runId: string, notes: string) => Promise<void>
  style?: React.CSSProperties
}

// Individual row component
const RunRow = React.memo(({ 
  run, 
  isSelected, 
  onRunSelect, 
  onStatusChange, 
  onNotesChange, 
  style 
}: RunRowProps) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false)

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
      style={style}
      onClick={handleRowClick}
      className={cn(
        'group border-b border-gray-100 last:border-b-0 transition-colors px-3 cursor-pointer',
        isSelected && 'bg-blue-100 border-blue-300 shadow-sm',
        run.processing_status === 'completed' && !isSelected && 'bg-emerald-50 hover:bg-emerald-100',
        run.processing_status === 'in_progress' && !isSelected && 'bg-amber-50 hover:bg-amber-100',
        run.processing_status === 'not_started' && !isSelected && 'bg-slate-50 hover:bg-slate-100'
      )}
    >
      {/* Main row - more compact */}
      <div className="flex items-center gap-3 py-2">
        {/* Processing status */}
        <ProcessingStatus
          status={run.processing_status}
          onClick={handleStatusClick}
          size="sm"
          showLabel={false}
          className={cn('flex-shrink-0', isUpdatingStatus && 'opacity-50')}
        />

        {/* Run details - single line layout */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-gray-900 truncate text-xs max-w-48">
              {run.title}
            </h3>
            <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
              <Building2 size={8} />
              {run.platform}
            </span>
            <span className="text-xs text-gray-500 flex items-center gap-1 flex-shrink-0">
              <Calendar size={8} />
              {formatDate(run.createdAt)}
            </span>
            {run.processed_at && (
              <span className="text-xs text-emerald-600 flex-shrink-0">
                ✓ {formatDate(run.processed_at)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notes row - compact */}
      <div className="pb-2 pl-8">
        <ProcessingNotes
          notes={run.processing_notes}
          onSave={handleNotesChange}
          onOpenModal={() => setIsNotesModalOpen(true)}
          showModalButton={true}
          placeholder="Add notes..."
          className="text-xs"
        />
      </div>

      {/* Notes Modal */}
      <ProcessingNotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        run={run}
        onSave={onNotesChange}
      />
    </div>
  )
})

RunRow.displayName = 'RunRow'

export function VirtualizedRunList({
  runs,
  selectedRun,
  onRunSelect,
  onStatusChange,
  onNotesChange,
  className,
  height = 600
}: VirtualizedRunListProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)


  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  // Calculate visible items
  const containerHeight = height - 60 // Subtract header height
  const startIndex = Math.floor(scrollTop / ROW_HEIGHT)
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / ROW_HEIGHT) + 2, // +2 for buffer
    runs.length
  )
  const visibleItems = runs.slice(startIndex, endIndex)


  return (
    <div className={cn('bg-white border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Header - compact */}
      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700">
            {runs.length} runs
          </span>
        </div>
      </div>

      {/* Virtualized list container */}
      {runs.length > 0 ? (
        <div
          ref={containerRef}
          className="relative overflow-auto"
          style={{ height: containerHeight }}
          onScroll={handleScroll}
        >
          {/* Total height spacer */}
          <div style={{ height: runs.length * ROW_HEIGHT, position: 'relative' }}>
            {/* Visible items */}
            <div
              style={{
                position: 'absolute',
                top: startIndex * ROW_HEIGHT,
                left: 0,
                right: 0,
              }}
            >
              {visibleItems.map((run, index) => (
                <RunRow
                  key={run.id}
                  run={run}
                  isSelected={selectedRun === run.id}
                  onRunSelect={onRunSelect}
                  onStatusChange={onStatusChange}
                  onNotesChange={onNotesChange}
                  style={{ height: ROW_HEIGHT }}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Empty state */
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

// Hook for managing virtual list interactions
export function useVirtualizedList(runs: ApifyRun[]) {
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToTop = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0
    }
  }, [])

  const scrollToRun = useCallback((runId: string) => {
    const index = runs.findIndex(run => run.id === runId)
    if (index >= 0 && containerRef.current) {
      const scrollPosition = index * ROW_HEIGHT
      containerRef.current.scrollTop = scrollPosition
    }
  }, [runs])

  const getVisibleRange = useCallback((scrollTop: number, containerHeight: number) => {
    const startIndex = Math.floor(scrollTop / ROW_HEIGHT)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / ROW_HEIGHT) + 2,
      runs.length
    )
    
    return {
      start: startIndex,
      end: endIndex
    }
  }, [runs.length])

  return {
    containerRef,
    scrollToTop,
    scrollToRun,
    getVisibleRange
  }
}
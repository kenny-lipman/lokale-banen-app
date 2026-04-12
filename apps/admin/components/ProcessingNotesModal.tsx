'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Save, X, FileText } from 'lucide-react'
import { ApifyRun } from './RunListView'

interface ProcessingNotesModalProps {
  isOpen: boolean
  onClose: () => void
  run: ApifyRun | null
  onSave: (runId: string, notes: string) => Promise<void>
}

export function ProcessingNotesModal({
  isOpen,
  onClose,
  run,
  onSave
}: ProcessingNotesModalProps) {
  const [currentNotes, setCurrentNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const maxLength = 500

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }

  useEffect(() => {
    if (isOpen && run) {
      setCurrentNotes(run.processing_notes || '')
      setHasUnsavedChanges(false)
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          adjustTextareaHeight()
        }
      }, 100)
    }
  }, [isOpen, run])

  const handleSave = async () => {
    if (!run || isSaving) return
    
    setIsSaving(true)
    try {
      await onSave(run.id, currentNotes.trim())
      setHasUnsavedChanges(false)
      onClose()
    } catch (error) {
      console.error('Failed to save notes:', error)
      // Keep modal open on error
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setCurrentNotes(run?.processing_notes || '')
    setHasUnsavedChanges(false)
    onClose()
  }

  const handleNotesChange = (value: string) => {
    setCurrentNotes(value)
    setHasUnsavedChanges(value.trim() !== (run?.processing_notes || '').trim())
    adjustTextareaHeight()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  const remainingChars = maxLength - currentNotes.length
  const isNearLimit = remainingChars < 50

  if (!run) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Edit Processing Notes
          </DialogTitle>
          <div className="text-sm text-gray-600">
            <span className="font-medium">{run.title}</span>
            {run.platform && (
              <span className="text-gray-400 ml-2">• {run.platform}</span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={currentNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add processing notes for this run..."
              maxLength={maxLength}
              disabled={isSaving}
              className={cn(
                'w-full px-3 py-3 text-sm border rounded-md resize-none overflow-hidden',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'min-h-[120px] max-h-[200px]'
              )}
            />
            
            {/* Character counter */}
            <div className={cn(
              'absolute bottom-2 right-2 text-xs px-2 py-1 bg-white rounded shadow-sm',
              isNearLimit ? 'text-red-500' : 'text-gray-400'
            )}>
              {remainingChars} chars left
            </div>
          </div>

          <div className="text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>Use Cmd+Enter to save quickly</span>
              <span>Last updated: {run.processed_at ? new Date(run.processed_at).toLocaleString() : 'Never'}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Notes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Edit3, Save, X, FileText } from 'lucide-react'

interface ProcessingNotesProps {
  notes: string | null
  onSave: (notes: string) => Promise<void>
  placeholder?: string
  maxLength?: number
  className?: string
  disabled?: boolean
}

export function ProcessingNotes({
  notes,
  onSave,
  placeholder = "Add processing notes...",
  maxLength = 500,
  className,
  disabled = false
}: ProcessingNotesProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [currentNotes, setCurrentNotes] = useState(notes || '')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${textarea.scrollHeight}px`
    }
  }

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      adjustTextareaHeight()
    }
  }, [isEditing])

  useEffect(() => {
    setCurrentNotes(notes || '')
    setHasUnsavedChanges(false)
  }, [notes])

  const handleEdit = () => {
    if (disabled) return
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (isSaving) return
    
    setIsSaving(true)
    try {
      await onSave(currentNotes.trim())
      setIsEditing(false)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save notes:', error)
      // Keep editing mode on error
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setCurrentNotes(notes || '')
    setIsEditing(false)
    setHasUnsavedChanges(false)
  }

  const handleNotesChange = (value: string) => {
    setCurrentNotes(value)
    setHasUnsavedChanges(value.trim() !== (notes || '').trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBlur = () => {
    // Auto-save on blur if there are changes
    if (hasUnsavedChanges && !isSaving) {
      handleSave()
    } else if (!hasUnsavedChanges) {
      setIsEditing(false)
    }
  }

  const remainingChars = maxLength - currentNotes.length
  const isNearLimit = remainingChars < 50

  if (!isEditing) {
    return (
      <div 
        className={cn(
          'group flex items-start gap-1 min-h-[16px] cursor-pointer',
          disabled && 'cursor-default opacity-50',
          className
        )}
        onClick={handleEdit}
      >
        <FileText size={12} className="text-gray-400 mt-0.5 flex-shrink-0" />
        {notes ? (
          <div className="flex-1">
            <p className="text-xs text-gray-700 leading-tight">
              {notes.length > 60 ? `${notes.slice(0, 60)}...` : notes}
            </p>
            {!disabled && (
              <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Click to edit
              </span>
            )}
          </div>
        ) : (
          <span 
            className={cn(
              "text-xs text-gray-400 italic",
              !disabled && "group-hover:text-gray-600 transition-colors"
            )}
          >
            {placeholder}
          </span>
        )}
        {!disabled && notes && (
          <Edit3 
            size={10} 
            className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" 
          />
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={currentNotes}
          onChange={(e) => {
            handleNotesChange(e.target.value)
            adjustTextareaHeight()
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={isSaving}
          className={cn(
            'w-full px-3 py-2 text-sm border rounded-md resize-none overflow-hidden',
            'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'min-h-[80px]'
          )}
        />
        
        {/* Character counter */}
        <div className={cn(
          'absolute bottom-2 right-2 text-xs',
          isNearLimit ? 'text-red-500' : 'text-gray-400'
        )}>
          {remainingChars}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          {isSaving ? (
            'Saving...'
          ) : (
            'Cmd+Enter to save • Esc to cancel'
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            <X size={12} />
            Cancel
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving || !hasUnsavedChanges}
            className={cn(
              'inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded transition-colors',
              'bg-blue-500 text-white hover:bg-blue-600',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Save size={12} />
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Hook for managing notes state with debounced auto-save
export function useProcessingNotes(
  initialNotes: string | null,
  onSave: (notes: string) => Promise<void>,
  debounceMs = 1000
) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [isSaving, setIsSaving] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedSave = React.useCallback((newNotes: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(async () => {
      if (newNotes.trim() !== (initialNotes || '').trim()) {
        setIsSaving(true)
        try {
          await onSave(newNotes)
          setNotes(newNotes)
        } catch (error) {
          console.error('Failed to save notes:', error)
        } finally {
          setIsSaving(false)
        }
      }
    }, debounceMs)
  }, [initialNotes, onSave, debounceMs])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return { notes, isSaving, debouncedSave }
}
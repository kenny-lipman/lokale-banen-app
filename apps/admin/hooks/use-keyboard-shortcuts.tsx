"use client"

import { useEffect } from 'react'
import { useWorkflow } from '@/contexts/otis-workflow-context'

interface KeyboardShortcutsProps {
  onStageChange: (stage: 'scraping' | 'enrichment' | 'campaigns' | 'results') => void
}

export function useKeyboardShortcuts({ onStageChange }: KeyboardShortcutsProps) {
  const { state, canNavigateToStage } = useWorkflow()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in input fields
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      // Ctrl/Cmd + number keys for stage navigation
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
        switch (event.key) {
          case '1':
            event.preventDefault()
            if (canNavigateToStage('scraping')) {
              onStageChange('scraping')
            }
            break
          case '2':
            event.preventDefault()
            if (canNavigateToStage('enrichment')) {
              onStageChange('enrichment')
            }
            break
          case '3':
            event.preventDefault()
            if (canNavigateToStage('campaigns')) {
              onStageChange('campaigns')
            }
            break
          case '4':
            event.preventDefault()
            if (canNavigateToStage('results')) {
              onStageChange('results')
            }
            break
        }
      }

      // Arrow keys for navigation (when not processing)
      if (!state.isProcessing) {
        switch (event.key) {
          case 'ArrowLeft':
            event.preventDefault()
            const prevStage = getPreviousStage(state.currentStage)
            if (prevStage && canNavigateToStage(prevStage)) {
              onStageChange(prevStage)
            }
            break
          case 'ArrowRight':
            event.preventDefault()
            const nextStage = getNextStage(state.currentStage)
            if (nextStage && canNavigateToStage(nextStage)) {
              onStageChange(nextStage)
            }
            break
        }
      }

      // Space bar to start processing (when on current stage)
      if (event.code === 'Space' && !state.isProcessing) {
        event.preventDefault()
        // This would trigger the current stage's start action
        // Implementation depends on the specific stage
      }

      // Escape to cancel processing
      if (event.key === 'Escape' && state.isProcessing) {
        event.preventDefault()
        // This would trigger a cancel action
        // Implementation depends on the specific stage
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.currentStage, state.isProcessing, canNavigateToStage, onStageChange])
}

function getPreviousStage(currentStage: string): 'scraping' | 'enrichment' | 'campaigns' | 'results' | null {
  const stages: ('scraping' | 'enrichment' | 'campaigns' | 'results')[] = ['scraping', 'enrichment', 'campaigns', 'results']
  const currentIndex = stages.indexOf(currentStage as any)
  return currentIndex > 0 ? stages[currentIndex - 1] : null
}

function getNextStage(currentStage: string): 'scraping' | 'enrichment' | 'campaigns' | 'results' | null {
  const stages: ('scraping' | 'enrichment' | 'campaigns' | 'results')[] = ['scraping', 'enrichment', 'campaigns', 'results']
  const currentIndex = stages.indexOf(currentStage as any)
  return currentIndex < stages.length - 1 ? stages[currentIndex + 1] : null
} 
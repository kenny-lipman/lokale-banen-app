"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface WorkflowContextType {
  sessionId: string | null
  currentStage: string
  isLoading: boolean
  error: string | null
  createSession: () => Promise<void>
  updateStage: (stage: string) => void
  setError: (error: string | null) => void
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined)

interface WorkflowProviderProps {
  children: ReactNode
  initialSessionId?: string | null
}

export function WorkflowProvider({ children, initialSessionId }: WorkflowProviderProps) {
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null)
  const [currentStage, setCurrentStage] = useState<string>('initial')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSession = async () => {
    if (sessionId) return // Already has session
    
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/otis/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_session',
          data: { stage: 'scraping' }
        })
      })

      if (response.ok) {
        const result = await response.json()
        setSessionId(result.sessionId)
        setCurrentStage('scraping')
      } else {
        throw new Error('Failed to create session')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  const updateStage = (stage: string) => {
    setCurrentStage(stage)
  }

  const value: WorkflowContextType = {
    sessionId,
    currentStage,
    isLoading,
    error,
    createSession,
    updateStage,
    setError
  }

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  )
}

export function useWorkflow() {
  const context = useContext(WorkflowContext)
  if (context === undefined) {
    throw new Error('useWorkflow must be used within a WorkflowProvider')
  }
  return context
} 
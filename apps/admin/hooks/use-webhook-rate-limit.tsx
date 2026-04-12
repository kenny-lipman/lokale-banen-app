"use client"

import { useState, useCallback, useRef } from 'react'

interface WebhookRateLimit {
  isLoading: (companyId: string) => boolean
  canCall: (companyId: string) => boolean
  markAsLoading: (companyId: string) => void
  markAsComplete: (companyId: string) => void
  getRemainingTime: (companyId: string) => number
}

const RATE_LIMIT_DURATION = 30000 // 30 seconds in milliseconds

/**
 * Hook to prevent webhook spamming by rate limiting calls per company
 * Prevents duplicate webhook calls within 30 seconds for the same company
 */
export function useWebhookRateLimit(): WebhookRateLimit {
  const [loadingCompanies, setLoadingCompanies] = useState<Set<string>>(new Set())
  const rateLimitMap = useRef<Map<string, number>>(new Map())

  const isLoading = useCallback((companyId: string): boolean => {
    return loadingCompanies.has(companyId)
  }, [loadingCompanies])

  const canCall = useCallback((companyId: string): boolean => {
    const now = Date.now()
    const lastCall = rateLimitMap.current.get(companyId)
    
    // If no previous call or rate limit expired, allow the call
    if (!lastCall || now - lastCall >= RATE_LIMIT_DURATION) {
      return !loadingCompanies.has(companyId)
    }
    
    return false
  }, [loadingCompanies])

  const markAsLoading = useCallback((companyId: string) => {
    const now = Date.now()
    rateLimitMap.current.set(companyId, now)
    setLoadingCompanies(prev => new Set(prev).add(companyId))
  }, [])

  const markAsComplete = useCallback((companyId: string) => {
    setLoadingCompanies(prev => {
      const newSet = new Set(prev)
      newSet.delete(companyId)
      return newSet
    })
    // Keep the timestamp in rateLimitMap for rate limiting
  }, [])

  const getRemainingTime = useCallback((companyId: string): number => {
    const now = Date.now()
    const lastCall = rateLimitMap.current.get(companyId)
    
    if (!lastCall) return 0
    
    const elapsed = now - lastCall
    const remaining = RATE_LIMIT_DURATION - elapsed
    
    return Math.max(0, Math.ceil(remaining / 1000)) // Return remaining seconds
  }, [])

  return {
    isLoading,
    canCall,
    markAsLoading,
    markAsComplete,
    getRemainingTime
  }
}
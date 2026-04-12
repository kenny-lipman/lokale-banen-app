"use client"

import { useState, useEffect, useCallback, useRef } from 'react'

interface UserActivity {
  isInteracting: boolean
  lastInteraction: number
  isTabActive: boolean
  isScrolling: boolean
  isTyping: boolean
  interactionTimeout: number
}

interface UserActivityActions {
  updateActivity: (activity: Partial<UserActivity>) => void
  resetActivity: () => void
  setInteractionTimeout: (timeout: number) => void
}

export function useUserActivity(initialTimeout: number = 2000): [UserActivity, UserActivityActions] {
  const [activity, setActivity] = useState<UserActivity>({
    isInteracting: false,
    lastInteraction: Date.now(),
    isTabActive: true,
    isScrolling: false,
    isTyping: false,
    interactionTimeout: initialTimeout
  })

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Reset interaction state after timeout
  const resetInteractionState = useCallback(() => {
    setActivity(prev => ({
      ...prev,
      isInteracting: false,
      isScrolling: false,
      isTyping: false
    }))
  }, [])

  // Handle user interaction
  const handleUserInteraction = useCallback((type: 'general' | 'scroll' | 'type' = 'general') => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set interaction state
    setActivity(prev => ({
      ...prev,
      isInteracting: true,
      lastInteraction: Date.now(),
      isScrolling: type === 'scroll' ? true : prev.isScrolling,
      isTyping: type === 'type' ? true : prev.isTyping
    }))

    // Set timeout to reset interaction state
    timeoutRef.current = setTimeout(() => {
      resetInteractionState()
    }, activity.interactionTimeout)
  }, [activity.interactionTimeout, resetInteractionState])

  // Handle scroll events with throttling
  const handleScroll = useCallback(() => {
    handleUserInteraction('scroll')
  }, [handleUserInteraction])

  // Handle typing events
  const handleTyping = useCallback(() => {
    handleUserInteraction('type')
  }, [handleUserInteraction])

  // Handle general interactions
  const handleGeneralInteraction = useCallback(() => {
    handleUserInteraction('general')
  }, [handleUserInteraction])

  // Handle tab visibility changes
  const handleVisibilityChange = useCallback(() => {
    setActivity(prev => ({
      ...prev,
      isTabActive: !document.hidden
    }))
  }, [])

  // Update activity manually
  const updateActivity = useCallback((newActivity: Partial<UserActivity>) => {
    setActivity(prev => ({ ...prev, ...newActivity }))
  }, [])

  // Reset activity state
  const resetActivity = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setActivity(prev => ({
      ...prev,
      isInteracting: false,
      isScrolling: false,
      isTyping: false
    }))
  }, [])

  // Set interaction timeout
  const setInteractionTimeout = useCallback((timeout: number) => {
    setActivity(prev => ({ ...prev, interactionTimeout: timeout }))
  }, [])

  // Set up event listeners
  useEffect(() => {
    // General interaction events
    document.addEventListener('mousedown', handleGeneralInteraction)
    document.addEventListener('mousemove', handleGeneralInteraction)
    document.addEventListener('keydown', handleGeneralInteraction)
    document.addEventListener('click', handleGeneralInteraction)
    document.addEventListener('touchstart', handleGeneralInteraction)

    // Scroll events (throttled)
    let scrollTimeout: NodeJS.Timeout
    const throttledScroll = () => {
      if (scrollTimeout) return
      scrollTimeout = setTimeout(() => {
        handleScroll()
        scrollTimeout = null
      }, 100) // Throttle to 100ms
    }
    document.addEventListener('scroll', throttledScroll, { passive: true })

    // Typing events
    document.addEventListener('keypress', handleTyping)
    document.addEventListener('input', handleTyping)

    // Tab visibility
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleGeneralInteraction)
      document.removeEventListener('mousemove', handleGeneralInteraction)
      document.removeEventListener('keydown', handleGeneralInteraction)
      document.removeEventListener('click', handleGeneralInteraction)
      document.removeEventListener('touchstart', handleGeneralInteraction)
      document.removeEventListener('scroll', throttledScroll)
      document.removeEventListener('keypress', handleTyping)
      document.removeEventListener('input', handleTyping)
      document.removeEventListener('visibilitychange', handleVisibilityChange)

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (scrollTimeout) {
        clearTimeout(scrollTimeout)
      }
    }
  }, [handleGeneralInteraction, handleScroll, handleTyping, handleVisibilityChange])

  const actions: UserActivityActions = {
    updateActivity,
    resetActivity,
    setInteractionTimeout
  }

  return [activity, actions]
} 
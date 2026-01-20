"use client"

import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { useWorkflow } from '@/contexts/otis-workflow-context'

// Debounce hook for expensive operations
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>()

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay)
    },
    [callback, delay]
  ) as T
}

// Throttle hook for frequent updates
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef(0)
  const lastCallTimer = useRef<NodeJS.Timeout>()

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCall.current >= delay) {
        callback(...args)
        lastCall.current = now
      } else {
        if (lastCallTimer.current) {
          clearTimeout(lastCallTimer.current)
        }
        lastCallTimer.current = setTimeout(() => {
          callback(...args)
          lastCall.current = Date.now()
        }, delay - (now - lastCall.current))
      }
    },
    [callback, delay]
  ) as T
}

// Memoization hook for expensive calculations
export function useMemoizedValue<T>(
  value: T,
  dependencies: any[],
  equalityFn?: (prev: T, next: T) => boolean
): T {
  const prevValue = useRef<T>(value)
  const prevDeps = useRef<any[]>(dependencies)

  const depsEqual = dependencies.every((dep, index) => dep === prevDeps.current[index])
  const valueEqual = equalityFn ? equalityFn(prevValue.current, value) : value === prevValue.current

  if (!depsEqual || !valueEqual) {
    prevValue.current = value
    prevDeps.current = dependencies
  }

  return prevValue.current
}

// Request deduplication to prevent duplicate API calls
const pendingRequests = new Map<string, Promise<any>>()

export function useRequestDeduplication() {
  const makeRequest = useCallback(async <T,>(
    key: string,
    requestFn: () => Promise<T>
  ): Promise<T> => {
    // If there's already a pending request with this key, return it
    if (pendingRequests.has(key)) {
      return pendingRequests.get(key)!
    }

    // Create new request
    const request = requestFn()
    pendingRequests.set(key, request)

    try {
      const result = await request
      return result
    } finally {
      // Clean up the pending request
      pendingRequests.delete(key)
    }
  }, [])

  return { makeRequest }
}

// Optimistic updates for better perceived performance
export function useOptimisticUpdate<T>(
  currentData: T,
  updateFn: (data: T) => T
) {
  const [optimisticData, setOptimisticData] = useState<T>(currentData)

  useEffect(() => {
    setOptimisticData(currentData)
  }, [currentData])

  const applyOptimisticUpdate = useCallback(() => {
    setOptimisticData(updateFn(optimisticData))
  }, [optimisticData, updateFn])

  const revertOptimisticUpdate = useCallback(() => {
    setOptimisticData(currentData)
  }, [currentData])

  return {
    optimisticData,
    applyOptimisticUpdate,
    revertOptimisticUpdate
  }
}

// Intersection Observer for lazy loading
export function useIntersectionObserver(
  callback: () => void,
  options: IntersectionObserverInit = {}
) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const elementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback()
        }
      })
    }, options)

    if (elementRef.current) {
      observerRef.current.observe(elementRef.current)
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [callback, options])

  return elementRef
}

// Virtual scrolling helper for large lists
export function useVirtualScrolling<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    )

    return items.slice(startIndex, endIndex).map((item, index) => ({
      item,
      index: startIndex + index,
      style: {
        position: 'absolute' as const,
        top: (startIndex + index) * itemHeight,
        height: itemHeight,
        width: '100%'
      }
    }))
  }, [items, itemHeight, containerHeight, scrollTop])

  const totalHeight = items.length * itemHeight

  return {
    visibleItems,
    totalHeight,
    setScrollTop
  }
}

// Memory management for large datasets
export function useMemoryManagement<T>(
  data: T[],
  maxItems: number = 1000
) {
  const [displayedData, setDisplayedData] = useState<T[]>([])

  useEffect(() => {
    if (data.length <= maxItems) {
      setDisplayedData(data)
    } else {
      // Only show the most recent items to prevent memory issues
      setDisplayedData(data.slice(-maxItems))
    }
  }, [data, maxItems])

  return displayedData
}

// Request batching for multiple API calls
export function useRequestBatching<T>(
  batchSize: number = 10,
  delay: number = 100
) {
  const batchRef = useRef<T[]>([])
  const timeoutRef = useRef<NodeJS.Timeout>()

  const addToBatch = useCallback((item: T, processBatch: (items: T[]) => void) => {
    batchRef.current.push(item)

    if (batchRef.current.length >= batchSize) {
      // Process immediately if batch is full
      processBatch([...batchRef.current])
      batchRef.current = []
    } else {
      // Process after delay if batch is not full
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      timeoutRef.current = setTimeout(() => {
        if (batchRef.current.length > 0) {
          processBatch([...batchRef.current])
          batchRef.current = []
        }
      }, delay)
    }
  }, [batchSize, delay])

  const flushBatch = useCallback((processBatch: (items: T[]) => void) => {
    if (batchRef.current.length > 0) {
      processBatch([...batchRef.current])
      batchRef.current = []
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  return { addToBatch, flushBatch }
}

// Cache invalidation strategy
export function useCacheInvalidation() {
  const cacheVersion = useRef(0)

  const invalidateCache = useCallback(() => {
    cacheVersion.current += 1
  }, [])

  const getCacheKey = useCallback((baseKey: string) => {
    return `${baseKey}_v${cacheVersion.current}`
  }, [])

  return { invalidateCache, getCacheKey }
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0)
  const lastRenderTime = useRef(performance.now())

  useEffect(() => {
    renderCount.current += 1
    const currentTime = performance.now()
    const timeSinceLastRender = currentTime - lastRenderTime.current
    lastRenderTime.current = currentTime

    // Log performance metrics in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`${componentName} render #${renderCount.current}`, {
        timeSinceLastRender: `${timeSinceLastRender.toFixed(2)}ms`,
        totalRenders: renderCount.current
      })
    }

    // Warn if renders are too frequent
    if (timeSinceLastRender < 16) { // Less than 60fps
      console.warn(`${componentName} is rendering too frequently: ${timeSinceLastRender.toFixed(2)}ms`)
    }
  })
}

// Workflow-specific performance optimizations
export function useWorkflowPerformance() {
  const { state } = useWorkflow()

  // Debounce stage changes to prevent excessive re-renders
  const debouncedStageChange = useDebounce((stage: string) => {
    // This would be used for expensive stage change operations
    console.log('Debounced stage change to:', stage)
  }, 300)

  // Throttle progress updates
  const throttledProgressUpdate = useThrottle((progress: any) => {
    // This would be used for frequent progress updates
    console.log('Throttled progress update:', progress)
  }, 100)

  // Memoize expensive calculations
  const memoizedProgress = useMemoizedValue(
    {
      percentage: state.isProcessing ? 50 : 0, // Example calculation
      stage: state.currentStage,
      completedStages: state.completedStages.length
    },
    [state.isProcessing, state.currentStage, state.completedStages]
  )

  return {
    debouncedStageChange,
    throttledProgressUpdate,
    memoizedProgress
  }
}

// Resource cleanup hook
export function useResourceCleanup() {
  const cleanupRefs = useRef<(() => void)[]>([])

  const addCleanup = useCallback((cleanup: () => void) => {
    cleanupRefs.current.push(cleanup)
  }, [])

  useEffect(() => {
    return () => {
      // Run all cleanup functions on unmount
      cleanupRefs.current.forEach(cleanup => cleanup())
      cleanupRefs.current = []
    }
  }, [])

  return { addCleanup }
} 
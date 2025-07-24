import { useEffect, useRef, useCallback } from 'react'

interface PerformanceMetrics {
  pageLoadTime: number
  apiResponseTime: number
  renderTime: number
  userInteractions: number
}

interface PerformanceEvent {
  type: 'page_load' | 'api_call' | 'render' | 'user_interaction'
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

export function usePerformanceMonitoring() {
  const metricsRef = useRef<PerformanceMetrics>({
    pageLoadTime: 0,
    apiResponseTime: 0,
    renderTime: 0,
    userInteractions: 0
  })
  
  const eventsRef = useRef<PerformanceEvent[]>([])
  const startTimeRef = useRef<number>(0)

  // Track page load time
  const trackPageLoad = useCallback(() => {
    const loadTime = performance.now() - startTimeRef.current
    metricsRef.current.pageLoadTime = loadTime
    
    eventsRef.current.push({
      type: 'page_load',
      duration: loadTime,
      timestamp: Date.now()
    })

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 Page loaded in ${loadTime.toFixed(2)}ms`)
    }
  }, [])

  // Track API call performance
  const trackApiCall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> => {
    const startTime = performance.now()
    
    try {
      const result = await apiCall()
      const duration = performance.now() - startTime
      
      metricsRef.current.apiResponseTime = duration
      eventsRef.current.push({
        type: 'api_call',
        duration,
        timestamp: Date.now(),
        metadata
      })

      if (process.env.NODE_ENV === 'development') {
        console.log(`📡 API call completed in ${duration.toFixed(2)}ms`, metadata)
      }

      return result
    } catch (error) {
      const duration = performance.now() - startTime
      eventsRef.current.push({
        type: 'api_call',
        duration,
        timestamp: Date.now(),
        metadata: { ...metadata, error: true }
      })

      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ API call failed after ${duration.toFixed(2)}ms`, error)
      }

      throw error
    }
  }, [])

  // Track render performance
  const trackRender = useCallback((componentName: string) => {
    const renderTime = performance.now() - startTimeRef.current
    metricsRef.current.renderTime = renderTime
    
    eventsRef.current.push({
      type: 'render',
      duration: renderTime,
      timestamp: Date.now(),
      metadata: { component: componentName }
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`🎨 ${componentName} rendered in ${renderTime.toFixed(2)}ms`)
    }
  }, [])

  // Track user interactions
  const trackUserInteraction = useCallback((interactionType: string) => {
    metricsRef.current.userInteractions++
    
    eventsRef.current.push({
      type: 'user_interaction',
      duration: 0,
      timestamp: Date.now(),
      metadata: { interaction: interactionType }
    })

    if (process.env.NODE_ENV === 'development') {
      console.log(`👆 User interaction: ${interactionType}`)
    }
  }, [])

  // Get performance summary
  const getPerformanceSummary = useCallback(() => {
    const events = eventsRef.current
    const apiCalls = events.filter(e => e.type === 'api_call')
    const renders = events.filter(e => e.type === 'render')
    const interactions = events.filter(e => e.type === 'user_interaction')

    return {
      totalEvents: events.length,
      averageApiResponseTime: apiCalls.length > 0 
        ? apiCalls.reduce((sum, e) => sum + e.duration, 0) / apiCalls.length 
        : 0,
      averageRenderTime: renders.length > 0 
        ? renders.reduce((sum, e) => sum + e.duration, 0) / renders.length 
        : 0,
      totalInteractions: interactions.length,
      slowestApiCall: apiCalls.length > 0 
        ? Math.max(...apiCalls.map(e => e.duration)) 
        : 0,
      slowestRender: renders.length > 0 
        ? Math.max(...renders.map(e => e.duration)) 
        : 0
    }
  }, [])

  // Clear performance data
  const clearPerformanceData = useCallback(() => {
    eventsRef.current = []
    metricsRef.current = {
      pageLoadTime: 0,
      apiResponseTime: 0,
      renderTime: 0,
      userInteractions: 0
    }
  }, [])

  // Initialize performance monitoring
  useEffect(() => {
    startTimeRef.current = performance.now()
    
    // Track initial page load
    const handleLoad = () => {
      trackPageLoad()
    }

    if (document.readyState === 'complete') {
      trackPageLoad()
    } else {
      window.addEventListener('load', handleLoad)
      return () => window.removeEventListener('load', handleLoad)
    }
  }, [trackPageLoad])

  return {
    trackPageLoad,
    trackApiCall,
    trackRender,
    trackUserInteraction,
    getPerformanceSummary,
    clearPerformanceData,
    metrics: metricsRef.current
  }
}

// Hook for tracking component render performance
export function useComponentPerformance(componentName: string) {
  const startTimeRef = useRef<number>(performance.now())
  const { trackRender } = usePerformanceMonitoring()

  useEffect(() => {
    trackRender(componentName)
  }, [componentName, trackRender])

  return { trackRender }
}

// Hook for tracking user interactions
export function useInteractionTracking() {
  const { trackUserInteraction } = usePerformanceMonitoring()

  const trackClick = useCallback((element: string) => {
    trackUserInteraction(`click_${element}`)
  }, [trackUserInteraction])

  const trackSearch = useCallback((query: string) => {
    trackUserInteraction(`search_${query.length > 20 ? query.substring(0, 20) + '...' : query}`)
  }, [trackUserInteraction])

  const trackFilter = useCallback((filterType: string, value: string) => {
    trackUserInteraction(`filter_${filterType}_${value}`)
  }, [trackUserInteraction])

  const trackNavigation = useCallback((from: string, to: string) => {
    trackUserInteraction(`navigation_${from}_to_${to}`)
  }, [trackUserInteraction])

  return {
    trackClick,
    trackSearch,
    trackFilter,
    trackNavigation
  }
} 
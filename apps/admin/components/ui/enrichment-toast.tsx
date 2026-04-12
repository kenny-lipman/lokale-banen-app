"use client"

import { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  X, 
  ExternalLink,
  TrendingUp,
  Users,
  Building2
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface EnrichmentToastData {
  id: string
  type: 'start' | 'progress' | 'success' | 'error' | 'partial'
  title: string
  message: string
  batchId?: string
  progress?: {
    completed: number
    total: number
    percentage: number
  }
  results?: {
    companies_enriched: number
    contacts_found: number
    failed_companies: number
  }
  actions?: Array<{
    label: string
    action: () => void
    variant?: 'default' | 'outline' | 'destructive'
  }>
  autoClose?: boolean
  duration?: number
  persistent?: boolean
}

interface EnrichmentToastProps {
  data: EnrichmentToastData
  onClose: (id: string) => void
  className?: string
}

export function EnrichmentToast({ data, onClose, className }: EnrichmentToastProps) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Auto-close timer
  useEffect(() => {
    if (!data.autoClose || data.persistent || isHovered) return

    const duration = data.duration || getDefaultDuration(data.type)
    setTimeLeft(duration)

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1000) {
          onClose(data.id)
          return null
        }
        return prev - 1000
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [data, onClose, isHovered])

  const getDefaultDuration = (type: string) => {
    switch (type) {
      case 'start': return 3000
      case 'progress': return 0 // Don't auto-close progress toasts
      case 'success': return 8000
      case 'error': return 12000
      case 'partial': return 10000
      default: return 5000
    }
  }

  const getToastConfig = () => {
    switch (data.type) {
      case 'start':
        return {
          icon: <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />,
          className: "border-blue-200 bg-blue-50",
          titleClassName: "text-blue-900",
          messageClassName: "text-blue-700"
        }
      case 'progress':
        return {
          icon: <Clock className="w-5 h-5 text-orange-600 animate-pulse" />,
          className: "border-orange-200 bg-orange-50",
          titleClassName: "text-orange-900",
          messageClassName: "text-orange-700"
        }
      case 'success':
        return {
          icon: <CheckCircle className="w-5 h-5 text-green-600" />,
          className: "border-green-200 bg-green-50",
          titleClassName: "text-green-900",
          messageClassName: "text-green-700"
        }
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-red-600" />,
          className: "border-red-200 bg-red-50",
          titleClassName: "text-red-900",
          messageClassName: "text-red-700"
        }
      case 'partial':
        return {
          icon: <AlertCircle className="w-5 h-5 text-yellow-600" />,
          className: "border-yellow-200 bg-yellow-50",
          titleClassName: "text-yellow-900",
          messageClassName: "text-yellow-700"
        }
      default:
        return {
          icon: <Clock className="w-5 h-5 text-gray-600" />,
          className: "border-gray-200 bg-gray-50",
          titleClassName: "text-gray-900",
          messageClassName: "text-gray-700"
        }
    }
  }

  const config = getToastConfig()

  return (
    <div
      className={cn(
        "relative p-4 rounded-lg border shadow-lg transition-all duration-300 hover:shadow-xl",
        "animate-in slide-in-from-right-full",
        config.className,
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Auto-close timer indicator */}
      {timeLeft !== null && !data.persistent && (
        <div className="absolute top-0 left-0 h-1 bg-gray-300 w-full rounded-t-lg overflow-hidden">
          <div 
            className="h-full bg-gray-600 transition-all duration-1000 ease-linear"
            style={{ 
              width: `${((data.duration || getDefaultDuration(data.type)) - timeLeft) / (data.duration || getDefaultDuration(data.type)) * 100}%` 
            }}
          />
        </div>
      )}

      {/* Close button */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-black/10"
        onClick={() => onClose(data.id)}
      >
        <X className="w-4 h-4" />
      </Button>

      <div className="flex items-start space-x-3 pr-8">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2">
          {/* Title */}
          <h4 className={cn("font-semibold text-sm", config.titleClassName)}>
            {data.title}
          </h4>

          {/* Message */}
          <p className={cn("text-sm", config.messageClassName)}>
            {data.message}
          </p>

          {/* Progress bar for progress type */}
          {data.type === 'progress' && data.progress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600">
                  Progress: {data.progress.completed} of {data.progress.total}
                </span>
                <span className="font-medium">
                  {data.progress.percentage}%
                </span>
              </div>
              <Progress 
                value={data.progress.percentage} 
                className="h-2"
              />
            </div>
          )}

          {/* Results summary for success/partial types */}
          {(data.type === 'success' || data.type === 'partial') && data.results && (
            <div className="flex flex-wrap gap-2 mt-2">
              {data.results.companies_enriched > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Building2 className="w-3 h-3 mr-1" />
                  {data.results.companies_enriched} companies
                </Badge>
              )}
              {data.results.contacts_found > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {data.results.contacts_found} contacts
                </Badge>
              )}
              {data.results.failed_companies > 0 && (
                <Badge variant="destructive" className="text-xs">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {data.results.failed_companies} failed
                </Badge>
              )}
            </div>
          )}

          {/* Actions */}
          {data.actions && data.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {data.actions.map((action, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={action.variant || 'outline'}
                  onClick={action.action}
                  className="text-xs h-7"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {/* Batch ID for reference */}
          {data.batchId && (
            <div className="text-xs text-gray-500 mt-2 font-mono">
              Batch: {data.batchId}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Enhanced toast manager hook
export function useEnrichmentToasts() {
  const [toasts, setToasts] = useState<EnrichmentToastData[]>([])

  const addToast = (toast: Omit<EnrichmentToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newToast: EnrichmentToastData = {
      ...toast,
      id,
      autoClose: toast.autoClose !== false, // Default to true
    }

    setToasts(prev => [...prev, newToast])
    return id
  }

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const clearAllToasts = () => {
    setToasts([])
  }

  const updateToast = (id: string, updates: Partial<EnrichmentToastData>) => {
    setToasts(prev => 
      prev.map(toast => 
        toast.id === id ? { ...toast, ...updates } : toast
      )
    )
  }

  // Predefined toast creators
  const showEnrichmentStart = (batchId: string, companyCount: number) => {
    return addToast({
      type: 'start',
      title: 'Enrichment Started',
      message: `Apollo is enriching ${companyCount} ${companyCount === 1 ? 'company' : 'companies'}. This may take 1-2 minutes.`,
      batchId,
      duration: 3000
    })
  }

  const showEnrichmentProgress = (batchId: string, progress: any) => {
    return addToast({
      type: 'progress',
      title: 'Enrichment in Progress',
      message: 'Apollo is analyzing company data...',
      batchId,
      progress,
      persistent: true,
      autoClose: false
    })
  }

  const showEnrichmentSuccess = (batchId: string, results: any) => {
    return addToast({
      type: 'success',
      title: 'Enrichment Complete!',
      message: `Successfully enriched ${results.companies_enriched} companies with ${results.contacts_found} contacts.`,
      batchId,
      results,
      duration: 8000,
      actions: [
        {
          label: 'View Results',
          action: () => {
            // Navigate to results or refresh data
            window.location.reload()
          }
        }
      ]
    })
  }

  const showEnrichmentError = (batchId: string, error: string) => {
    return addToast({
      type: 'error',
      title: 'Enrichment Failed',
      message: error,
      batchId,
      duration: 12000,
      actions: [
        {
          label: 'Retry',
          action: () => {
            // Retry logic would go here
            console.log('Retry enrichment')
          },
          variant: 'destructive'
        },
        {
          label: 'Contact Support',
          action: () => {
            // Open support channel
            window.open('mailto:support@example.com', '_blank')
          },
          variant: 'outline'
        }
      ]
    })
  }

  const showPartialSuccess = (batchId: string, results: any) => {
    return addToast({
      type: 'partial',
      title: 'Partial Success',
      message: `Enriched ${results.companies_enriched} companies, but ${results.failed_companies} failed.`,
      batchId,
      results,
      duration: 10000,
      actions: [
        {
          label: 'View Details',
          action: () => {
            // Show detailed results
            console.log('Show partial results details')
          }
        }
      ]
    })
  }

  return {
    toasts,
    addToast,
    removeToast,
    clearAllToasts,
    updateToast,
    showEnrichmentStart,
    showEnrichmentProgress,
    showEnrichmentSuccess,
    showEnrichmentError,
    showPartialSuccess
  }
}

// Toast container component
export function EnrichmentToastContainer() {
  const { toasts, removeToast } = useEnrichmentToasts()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-96">
      {toasts.map(toast => (
        <EnrichmentToast
          key={toast.id}
          data={toast}
          onClose={removeToast}
        />
      ))}
    </div>
  )
}
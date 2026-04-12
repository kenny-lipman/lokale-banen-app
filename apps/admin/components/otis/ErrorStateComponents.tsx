"use client"

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCw, AlertTriangle, XCircle, Info, HelpCircle } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message?: string
  error?: Error | string
  severity?: 'info' | 'warning' | 'error' | 'critical'
  showRetry?: boolean
  showDetails?: boolean
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}

export function ErrorState({
  title,
  message,
  error,
  severity = 'error',
  showRetry = true,
  showDetails = false,
  onRetry,
  onDismiss,
  className = ''
}: ErrorStateProps) {
  const [showErrorDetails, setShowErrorDetails] = useState(false)

  const getSeverityConfig = () => {
    switch (severity) {
      case 'info':
        return {
          icon: Info,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-800',
          iconColor: 'text-blue-600'
        }
      case 'warning':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          textColor: 'text-yellow-800',
          iconColor: 'text-yellow-600'
        }
      case 'error':
        return {
          icon: AlertCircle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600'
        }
      case 'critical':
        return {
          icon: XCircle,
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300',
          textColor: 'text-red-900',
          iconColor: 'text-red-700'
        }
      default:
        return {
          icon: AlertCircle,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          textColor: 'text-red-800',
          iconColor: 'text-red-600'
        }
    }
  }

  const severityConfig = getSeverityConfig()
  const IconComponent = severityConfig.icon

  const errorMessage = error instanceof Error ? error.message : error || message
  const errorStack = error instanceof Error ? error.stack : undefined

  return (
    <div className={cn(
      'rounded-lg border p-4',
      severityConfig.bgColor,
      severityConfig.borderColor,
      className
    )}>
      <div className="flex items-start space-x-3">
        <IconComponent className={cn('w-5 h-5 mt-0.5', severityConfig.iconColor)} />
        
        <div className="flex-1 space-y-2">
          {title && (
            <h3 className={cn('text-sm font-medium', severityConfig.textColor)}>
              {title}
            </h3>
          )}
          
          {errorMessage && (
            <p className={cn('text-sm', severityConfig.textColor)}>
              {errorMessage}
            </p>
          )}

          {/* Error details */}
          {showDetails && errorStack && (
            <div className="space-y-2">
              <button
                onClick={() => setShowErrorDetails(!showErrorDetails)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {showErrorDetails ? 'Hide' : 'Show'} technical details
              </button>
              
              {showErrorDetails && (
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                  {errorStack}
                </pre>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center space-x-2 pt-2">
            {showRetry && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Try Again
              </Button>
            )}
            
            {onDismiss && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDismiss}
                className="text-xs"
              >
                Dismiss
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Specialized error states for common scenarios
export function ConnectionErrorState({
  onRetry,
  className = ''
}: {
  onRetry?: () => void
  className?: string
}) {
  return (
    <ErrorState
      title="Connection Lost"
      message="Unable to connect to the server. Please check your internet connection and try again."
      severity="warning"
      showRetry={true}
      onRetry={onRetry}
      className={className}
    />
  )
}

export function DataLoadErrorState({
  onRetry,
  className = ''
}: {
  onRetry?: () => void
  className?: string
}) {
  return (
    <ErrorState
      title="Failed to Load Data"
      message="We couldn't load the requested data. This might be a temporary issue."
      severity="error"
      showRetry={true}
      onRetry={onRetry}
      className={className}
    />
  )
}

export function EnrichmentErrorState({
  error,
  onRetry,
  className = ''
}: {
  error?: Error | string
  onRetry?: () => void
  className?: string
}) {
  return (
    <ErrorState
      title="Enrichment Failed"
      message="The company enrichment process encountered an error. Some data may be incomplete."
      error={error}
      severity="error"
      showRetry={true}
      showDetails={true}
      onRetry={onRetry}
      className={className}
    />
  )
}

export function ScrapingErrorState({
  error,
  onRetry,
  className = ''
}: {
  error?: Error | string
  onRetry?: () => void
  className?: string
}) {
  return (
    <ErrorState
      title="Scraping Failed"
      message="We couldn't scrape the job data. This might be due to website changes or temporary issues."
      error={error}
      severity="warning"
      showRetry={true}
      showDetails={true}
      onRetry={onRetry}
      className={className}
    />
  )
}

// Error boundary fallback component
export function ErrorBoundaryFallback({
  error,
  resetErrorBoundary,
  className = ''
}: {
  error: Error
  resetErrorBoundary: () => void
  className?: string
}) {
  return (
    <div className={cn('p-6 text-center', className)}>
      <div className="max-w-md mx-auto space-y-4">
        <XCircle className="w-12 h-12 text-red-500 mx-auto" />
        
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-600">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
        </div>

        <div className="space-y-2">
          <Button onClick={resetErrorBoundary} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Page
          </Button>
          
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Hard Refresh
          </Button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="text-left">
            <summary className="text-xs text-gray-500 cursor-pointer">
              Error Details (Development)
            </summary>
            <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

// Graceful degradation component
export function GracefulDegradation({
  children,
  fallback,
  error,
  className = ''
}: {
  children: React.ReactNode
  fallback: React.ReactNode
  error?: Error | null
  className?: string
}) {
  if (error) {
    return <div className={className}>{fallback}</div>
  }

  return <div className={className}>{children}</div>
}

// Error recovery component
export function ErrorRecovery({
  error,
  onRetry,
  onFallback,
  retryCount = 0,
  maxRetries = 3,
  className = ''
}: {
  error: Error
  onRetry: () => void
  onFallback?: () => void
  retryCount?: number
  maxRetries?: number
  className?: string
}) {
  const canRetry = retryCount < maxRetries

  return (
    <div className={cn('space-y-4', className)}>
      <ErrorState
        title="Operation Failed"
        message={error.message}
        error={error}
        severity="error"
        showRetry={canRetry}
        onRetry={canRetry ? onRetry : undefined}
      />

      {canRetry && (
        <div className="text-xs text-gray-500">
          Retry attempt {retryCount + 1} of {maxRetries}
        </div>
      )}

      {!canRetry && onFallback && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            Maximum retry attempts reached. You can try an alternative approach:
          </p>
          <Button variant="outline" onClick={onFallback} size="sm">
            <HelpCircle className="w-4 h-4 mr-2" />
            Try Alternative Method
          </Button>
        </div>
      )}
    </div>
  )
}

// Network error detection and recovery
export function NetworkErrorHandler({
  error,
  onRetry,
  className = ''
}: {
  error: Error
  onRetry: () => void
  className?: string
}) {
  const isNetworkError = error.message.includes('fetch') || 
                        error.message.includes('network') ||
                        error.message.includes('connection')

  if (isNetworkError) {
    return (
      <div className={cn('space-y-3', className)}>
        <ErrorState
          title="Network Error"
          message="Please check your internet connection and try again."
          severity="warning"
          showRetry={true}
          onRetry={onRetry}
        />
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Check your internet connection</p>
          <p>• Try refreshing the page</p>
          <p>• Contact support if the problem persists</p>
        </div>
      </div>
    )
  }

  return (
    <ErrorState
      title="Unexpected Error"
      message={error.message}
      error={error}
      severity="error"
      showRetry={true}
      onRetry={onRetry}
      className={className}
    />
  )
} 
"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorType?: 'websocket' | 'session' | 'component' | 'network' | 'unknown'
}

export class OtisErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    // Categorize the error type
    let errorType: 'websocket' | 'session' | 'component' | 'network' | 'unknown' = 'unknown'
    
    if (error.message.includes('WebSocket') || error.message.includes('EventSource')) {
      errorType = 'websocket'
    } else if (error.message.includes('session') || error.message.includes('Session')) {
      errorType = 'session'
    } else if (error.message.includes('fetch') || error.message.includes('network')) {
      errorType = 'network'
    } else if (error.message.includes('component') || error.message.includes('React')) {
      errorType = 'component'
    }
    
    return { hasError: true, error, errorType }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('OtisErrorBoundary caught an error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorType: this.state.errorType
      })
    }
    
    this.setState({ error, errorInfo })
    
    // Log to console with more details (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.group('OTIS Error Details')
      console.error('Error Message:', error.message)
      console.error('Error Stack:', error.stack)
      console.error('Component Stack:', errorInfo.componentStack)
      console.error('Error Type:', this.state.errorType)
      console.error('Timestamp:', new Date().toISOString())
      console.error('URL:', window.location.href)
      console.error('User Agent:', navigator.userAgent)
      console.groupEnd()
    }
  }

  handleRetry = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Retrying after error...')
    }
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleReload = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Reloading page...')
    }
    window.location.reload()
  }

  handleGoHome = () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Navigating to OTIS home...')
    }
    window.location.href = '/agents/otis'
  }

  getErrorMessage = () => {
    const { error, errorType } = this.state
    
    if (!error) return 'An unknown error occurred'
    
    switch (errorType) {
      case 'websocket':
        return 'Connection error: Unable to establish real-time connection'
      case 'session':
        return 'Session error: Unable to create or load session data'
      case 'network':
        return 'Network error: Unable to communicate with the server'
      case 'component':
        return 'Component error: A UI component failed to load'
      default:
        return error.message || 'An unexpected error occurred'
    }
  }

  getErrorDescription = () => {
    const { errorType } = this.state
    
    switch (errorType) {
      case 'websocket':
        return 'The real-time connection to the server failed. This might be due to network issues or server problems.'
      case 'session':
        return 'Unable to create or load your session. This could be due to database issues or authentication problems.'
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection and try again.'
      case 'component':
        return 'A UI component failed to load properly. This might be due to missing dependencies or configuration issues.'
      default:
        return 'The OTIS dashboard encountered an unexpected error. This might be due to a connection issue or a temporary problem.'
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-12 w-12 text-red-500" />
              </div>
              
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {this.getErrorMessage()}
              </h2>
              
              <p className="text-gray-600 mb-6">
                {this.getErrorDescription()}
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-6 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Error Details (Development)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono text-gray-800 overflow-auto max-h-48">
                    <div className="mb-2">
                      <strong>Error Type:</strong> {this.state.errorType}
                    </div>
                    <div className="mb-2">
                      <strong>Message:</strong> {this.state.error.message}
                    </div>
                    <div className="mb-2">
                      <strong>Stack:</strong>
                      <pre className="whitespace-pre-wrap text-xs">
                        {this.state.error.stack}
                      </pre>
                    </div>
                    {this.state.errorInfo && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className="whitespace-pre-wrap text-xs">
                          {this.state.errorInfo.componentStack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                
                <Button
                  onClick={this.handleReload}
                  className="flex items-center gap-2"
                >
                  Reload Page
                </Button>
                
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                If this problem persists, please contact support with the error details above.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook for functional components to handle errors
export function useErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(`Error in ${context || 'component'}:`, error)
    }
    
    // You could send this to an error reporting service
    // reportError(error, context)
    
    // For now, just log it
    return error
  }

  return { handleError }
} 
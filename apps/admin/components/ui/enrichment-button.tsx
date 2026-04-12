"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Sparkles, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Zap,
  Info
} from "lucide-react"
import { cn } from "@/lib/utils"

interface EnrichmentButtonProps {
  status: 'idle' | 'processing' | 'completed' | 'failed'
  isLoading?: boolean
  disabled?: boolean
  contactsCount?: number
  lastEnrichedAt?: string
  onClick: () => void
  className?: string
  size?: 'sm' | 'default' | 'lg'
  showTooltip?: boolean
}

interface StatusConfig {
  label: string
  icon: React.ReactNode
  className: string
  pulseAnimation?: boolean
  tooltip: string
}

const statusConfigs: Record<string, StatusConfig> = {
  idle: {
    label: "Enrich",
    icon: <Sparkles className="w-4 h-4" />,
    className: "bg-blue-600 hover:bg-blue-700 text-white",
    tooltip: "Start Apollo enrichment to find contacts and company data"
  },
  processing: {
    label: "Enriching...",
    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
    className: "bg-blue-500 text-white cursor-not-allowed",
    pulseAnimation: true,
    tooltip: "Apollo is currently enriching this company. This may take 1-2 minutes."
  },
  completed: {
    label: "Enriched",
    icon: <CheckCircle className="w-4 h-4" />,
    className: "bg-green-600 hover:bg-green-700 text-white",
    tooltip: "Company has been enriched. Click to re-enrich with latest data."
  },
  failed: {
    label: "Retry",
    icon: <AlertCircle className="w-4 h-4" />,
    className: "bg-red-600 hover:bg-red-700 text-white",
    tooltip: "Enrichment failed. Click to try again."
  }
}

export function EnrichmentButton({
  status,
  isLoading = false,
  disabled = false,
  contactsCount,
  lastEnrichedAt,
  onClick,
  className,
  size = 'default',
  showTooltip = true
}: EnrichmentButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const currentStatus = isLoading ? 'processing' : status
  const config = statusConfigs[currentStatus] || statusConfigs.idle
  const isDisabled = disabled || currentStatus === 'processing'

  // Show success animation when transitioning to completed
  useEffect(() => {
    if (status === 'completed' && !isLoading) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [status, isLoading])

  const handleClick = () => {
    if (isDisabled) return
    
    setIsPressed(true)
    setTimeout(() => setIsPressed(false), 150)
    onClick()
  }

  const formatLastEnriched = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffHours < 1) return "Just now"
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  const getTooltipContent = () => {
    let content = config.tooltip
    
    if (status === 'completed' && contactsCount !== undefined) {
      content += ` Found ${contactsCount} contacts.`
    }
    
    if (lastEnrichedAt) {
      content += ` Last enriched: ${formatLastEnriched(lastEnrichedAt)}.`
    }
    
    return content
  }

  const buttonContent = (
    <Button
      onClick={handleClick}
      disabled={isDisabled}
      size={size}
      className={cn(
        "relative overflow-hidden transition-all duration-200 font-medium",
        config.className,
        {
          "animate-pulse": config.pulseAnimation,
          "scale-95": isPressed,
          "scale-110 shadow-lg": showSuccess,
          "opacity-50 cursor-not-allowed": isDisabled,
        },
        className
      )}
    >
      {/* Background animation for processing state */}
      {currentStatus === 'processing' && (
        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 animate-gradient-x opacity-75" />
      )}
      
      {/* Success celebration overlay */}
      {showSuccess && (
        <div className="absolute inset-0 bg-green-400 animate-ping opacity-25" />
      )}
      
      <div className="relative flex items-center space-x-2">
        <div className={cn(
          "transition-transform duration-200",
          showSuccess && "animate-bounce"
        )}>
          {config.icon}
        </div>
        
        <span className="transition-all duration-200">
          {config.label}
        </span>
        
        {/* Contact count badge for completed state */}
        {status === 'completed' && contactsCount !== undefined && contactsCount > 0 && (
          <Badge 
            variant="secondary" 
            className="ml-2 bg-white/20 text-white border-white/30"
          >
            {contactsCount}
          </Badge>
        )}
      </div>
      
      {/* Processing progress indicator */}
      {currentStatus === 'processing' && (
        <div className="absolute bottom-0 left-0 h-1 bg-white/30 w-full">
          <div className="h-full bg-white animate-pulse" style={{ 
            animation: 'loading-bar 3s ease-in-out infinite' 
          }} />
        </div>
      )}
    </Button>
  )

  if (showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent 
            side="top" 
            className="max-w-xs text-center"
            sideOffset={8}
          >
            <div className="space-y-1">
              <p className="font-medium">{getTooltipContent()}</p>
              {currentStatus === 'processing' && (
                <p className="text-xs text-gray-400">
                  Large companies may take 2-5 minutes
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return buttonContent
}

// Additional status badge component for table views
export function EnrichmentStatusBadge({ 
  status, 
  contactsCount, 
  className 
}: { 
  status: string
  contactsCount?: number
  className?: string 
}) {
  const getStatusConfig = () => {
    switch (status) {
      case 'completed':
        return {
          label: `✓ Enriched${contactsCount ? ` (${contactsCount})` : ''}`,
          className: "bg-green-100 text-green-800 border-green-200"
        }
      case 'processing':
        return {
          label: "⏳ Enriching",
          className: "bg-blue-100 text-blue-800 border-blue-200 animate-pulse"
        }
      case 'failed':
        return {
          label: "❌ Failed",
          className: "bg-red-100 text-red-800 border-red-200"
        }
      default:
        return {
          label: "⏳ Pending",
          className: "bg-gray-100 text-gray-800 border-gray-200"
        }
    }
  }

  const config = getStatusConfig()
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "transition-all duration-200 font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </Badge>
  )
}

// CSS for custom animations - add to global styles
const styles = `
@keyframes loading-bar {
  0% { width: 0%; }
  50% { width: 70%; }
  100% { width: 100%; }
}

@keyframes gradient-x {
  0%, 100% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
}

.animate-gradient-x {
  animation: gradient-x 2s ease-in-out infinite;
}
`
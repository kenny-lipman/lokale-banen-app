"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { 
  Info, 
  HelpCircle, 
  Clock, 
  Zap, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Users,
  Building2,
  ChevronDown,
  ChevronUp,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ContextualHelpProps {
  phase: 'idle' | 'processing' | 'manual' | 'completed' | 'failed'
  elapsedTime?: number
  progress?: {
    completed: number
    total: number
    percentage: number
  }
  showExpanded?: boolean
  className?: string
}

interface HelpContent {
  title: string
  message: string
  icon: React.ReactNode
  expandedContent?: string
  tips?: string[]
  troubleshooting?: string[]
  estimatedTime?: string
  severity: 'info' | 'warning' | 'success' | 'error'
}

const helpConfigs: Record<string, HelpContent> = {
  idle: {
    title: "Ready to Enrich",
    message: "Apollo enrichment will find contacts and additional company data",
    icon: <Zap className="w-4 h-4" />,
    expandedContent: "Apollo enrichment uses advanced algorithms to find verified contact information, company details, and professional insights. This typically includes email addresses, phone numbers, LinkedIn profiles, and organizational data.",
    tips: [
      "Companies with websites provide better enrichment results",
      "Large companies may take longer to process (2-5 minutes)",
      "Enrichment includes email verification and social profiles"
    ],
    estimatedTime: "1-2 minutes",
    severity: 'info'
  },
  processing: {
    title: "Enrichment in Progress",
    message: "Apollo is analyzing company data and finding contacts",
    icon: <RefreshCw className="w-4 h-4 animate-spin" />,
    expandedContent: "The enrichment process involves multiple steps: data verification, contact discovery, email validation, and social profile matching. We're checking for updates every 3 seconds to provide real-time progress.",
    tips: [
      "Most enrichments complete within 30 seconds",
      "Large companies with multiple locations may take longer",
      "You can safely navigate away - we'll notify you when complete"
    ],
    troubleshooting: [
      "If stuck, check your internet connection",
      "Some companies have limited public data available",
      "Rate limits may cause temporary delays"
    ],
    estimatedTime: "30 seconds - 2 minutes",
    severity: 'info'
  },
  manual: {
    title: "Extended Processing",
    message: "Enrichment is taking longer than usual. Check manually for updates.",
    icon: <Clock className="w-4 h-4" />,
    expandedContent: "Some companies require additional processing time, especially large organizations with complex structures or limited public data. We've switched to manual checking to reduce server load.",
    tips: [
      "Click 'Check Status' to get the latest update",
      "Complex companies can take 2-5 minutes",
      "You'll be notified as soon as results are available"
    ],
    troubleshooting: [
      "Try refreshing status every 30-60 seconds",
      "Large enterprises often require extended processing",
      "Contact support if stuck for more than 10 minutes"
    ],
    estimatedTime: "2-5 minutes",
    severity: 'warning'
  },
  completed: {
    title: "Enrichment Complete",
    message: "Successfully found contacts and company data",
    icon: <CheckCircle className="w-4 h-4" />,
    expandedContent: "Apollo has successfully enriched this company with verified contact information and additional business intelligence. All contacts have been validated and are ready for outreach.",
    tips: [
      "Contact data includes verified email addresses",
      "LinkedIn profiles are available when found",
      "You can re-enrich to get updated information"
    ],
    severity: 'success'
  },
  failed: {
    title: "Enrichment Failed",
    message: "Unable to complete enrichment for this company",
    icon: <AlertTriangle className="w-4 h-4" />,
    expandedContent: "The enrichment process encountered an issue and couldn't complete successfully. This could be due to limited public data, network issues, or company privacy settings.",
    tips: [
      "Try again in a few minutes",
      "Ensure the company website is accessible",
      "Some companies have limited public information"
    ],
    troubleshooting: [
      "Check if the company website is valid and accessible",
      "Verify the company name and location are accurate",
      "Some companies block automated data collection",
      "Contact support if the issue persists"
    ],
    severity: 'error'
  }
}

export function ContextualHelp({ 
  phase, 
  elapsedTime = 0, 
  progress, 
  showExpanded = false,
  className 
}: ContextualHelpProps) {
  const [isExpanded, setIsExpanded] = useState(showExpanded)
  const [isDismissed, setIsDismissed] = useState(false)
  
  const config = helpConfigs[phase] || helpConfigs.idle

  // Auto-expand for warning and error states
  useEffect(() => {
    if (config.severity === 'warning' || config.severity === 'error') {
      setIsExpanded(true)
    }
  }, [config.severity])

  if (isDismissed) return null

  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  const getSeverityStyles = () => {
    switch (config.severity) {
      case 'success':
        return {
          cardClass: "border-green-200 bg-green-50",
          iconClass: "text-green-600",
          titleClass: "text-green-900",
          messageClass: "text-green-700"
        }
      case 'warning':
        return {
          cardClass: "border-yellow-200 bg-yellow-50",
          iconClass: "text-yellow-600",
          titleClass: "text-yellow-900",
          messageClass: "text-yellow-700"
        }
      case 'error':
        return {
          cardClass: "border-red-200 bg-red-50",
          iconClass: "text-red-600",
          titleClass: "text-red-900",
          messageClass: "text-red-700"
        }
      default:
        return {
          cardClass: "border-blue-200 bg-blue-50",
          iconClass: "text-blue-600",
          titleClass: "text-blue-900",
          messageClass: "text-blue-700"
        }
    }
  }

  const styles = getSeverityStyles()

  return (
    <Card className={cn("transition-all duration-300", styles.cardClass, className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className={cn("mt-0.5", styles.iconClass)}>
              {config.icon}
            </div>
            
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className={cn("font-medium text-sm", styles.titleClass)}>
                  {config.title}
                  {phase === 'processing' && elapsedTime > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {formatElapsedTime(elapsedTime)}
                    </Badge>
                  )}
                </h4>
                
                <div className="flex items-center space-x-1">
                  {config.estimatedTime && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            {config.estimatedTime}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Estimated completion time</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setIsDismissed(true)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              <p className={cn("text-sm", styles.messageClass)}>
                {config.message}
              </p>

              {/* Progress information for processing phase */}
              {phase === 'processing' && progress && (
                <div className="flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <Building2 className="w-3 h-3" />
                    <span>{progress.completed}/{progress.total} companies</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="w-3 h-3" />
                    <span>{progress.percentage}% complete</span>
                  </div>
                </div>
              )}

              {/* Expandable detailed content */}
              {(config.expandedContent || config.tips || config.troubleshooting) && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="h-6 p-0 text-xs hover:bg-transparent"
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-3 h-3 mr-1" />
                    ) : (
                      <ChevronDown className="w-3 h-3 mr-1" />
                    )}
                    {isExpanded ? 'Show less' : 'Show more details'}
                  </Button>

                  {isExpanded && (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      {config.expandedContent && (
                        <p className="text-sm text-gray-600 leading-relaxed">
                          {config.expandedContent}
                        </p>
                      )}

                      {config.tips && config.tips.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-800 mb-1 flex items-center">
                            <Info className="w-3 h-3 mr-1" />
                            Tips
                          </h5>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {config.tips.map((tip, index) => (
                              <li key={index} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {config.troubleshooting && config.troubleshooting.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-gray-800 mb-1 flex items-center">
                            <HelpCircle className="w-3 h-3 mr-1" />
                            Troubleshooting
                          </h5>
                          <ul className="text-xs text-gray-600 space-y-1">
                            {config.troubleshooting.map((item, index) => (
                              <li key={index} className="flex items-start">
                                <span className="mr-2">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Quick help tooltip component for inline help
export function QuickHelpTooltip({ 
  content, 
  children, 
  side = "top" 
}: { 
  content: string
  children: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Progressive help messaging component
export function ProgressiveHelp({ phase, elapsedTime = 0 }: { phase: string, elapsedTime?: number }) {
  const getMessage = () => {
    if (phase === 'processing') {
      if (elapsedTime < 15000) {
        return "Enriching company data..."
      } else if (elapsedTime < 45000) {
        return "Still processing... Large companies take longer"
      } else {
        return "This may take a few minutes. Check back shortly."
      }
    }
    
    return helpConfigs[phase]?.message || "Processing..."
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-gray-600">
      <Clock className="w-4 h-4" />
      <span>{getMessage()}</span>
    </div>
  )
}
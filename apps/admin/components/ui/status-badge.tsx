import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Check, Clock, X, Loader2 } from 'lucide-react'

interface StatusBadgeProps {
  status: string
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const variants = {
    scraped: "bg-green-100 text-green-800 border-green-200",
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    inProgress: "bg-blue-100 text-blue-800 border-blue-200",
    enriched: "bg-green-100 text-green-800 border-green-200",
    processing: "bg-blue-100 text-blue-800 border-blue-200",
    completed: "bg-green-100 text-green-800 border-green-200"
  }
  
  const icons = {
    scraped: <Check className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3" />,
    failed: <X className="w-3 h-3" />,
    inProgress: <Loader2 className="w-3 h-3 animate-spin" />,
    enriched: <Check className="w-3 h-3" />,
    processing: <Loader2 className="w-3 h-3 animate-spin" />,
    completed: <Check className="w-3 h-3" />
  }
  
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'scraped':
      case 'enriched':
      case 'completed':
        return 'Completed'
      case 'pending':
        return 'Pending'
      case 'failed':
        return 'Failed'
      case 'inProgress':
      case 'processing':
        return 'Processing'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }
  
  return (
    <Badge 
      variant="outline" 
      className={`text-xs flex items-center gap-1 ${variants[status as keyof typeof variants] || variants.pending} ${className}`}
    >
      {icons[status as keyof typeof icons] || icons.pending}
      {getStatusDisplay(status)}
    </Badge>
  )
} 
"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, XCircle, Clock } from "lucide-react"
import { useState } from "react"

interface CompanyQualificationActionsProps {
  company: {
    id: string
    name: string
    qualification_status?: string | null
  }
  isQualifying?: boolean
  onQualify: (companyId: string, status: 'qualified' | 'disqualified' | 'review') => Promise<void>
  showBadge?: boolean
  size?: 'sm' | 'default'
  className?: string
}

export function CompanyQualificationActions({
  company,
  isQualifying = false,
  onQualify,
  showBadge = true,
  size = 'default',
  className = ""
}: CompanyQualificationActionsProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  
  const handleQualify = async (status: 'qualified' | 'disqualified' | 'review') => {
    if (isUpdating || isQualifying) return
    
    setIsUpdating(true)
    try {
      await onQualify(company.id, status)
    } finally {
      setIsUpdating(false)
    }
  }

  // Get qualification status badge
  const getQualificationBadge = () => {
    if (!showBadge) return null
    
    switch (company.qualification_status) {
      case 'qualified':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            Qualified
          </Badge>
        )
      case 'review':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 text-xs">
            <AlertCircle className="w-3 h-3 mr-1" />
            Review
          </Badge>
        )
      case 'disqualified':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
            <XCircle className="w-3 h-3 mr-1" />
            Disqualified
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-gray-400 text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Awaiting Qualification
          </Badge>
        )
    }
  }

  // Get contextual actions based on current qualification status
  const getActions = () => {
    const isLoading = isUpdating || isQualifying
    const buttonSize = size === 'sm' ? 'sm' : 'default'
    
    switch (company.qualification_status) {
      case 'qualified':
        // Already qualified - minimal actions
        return (
          <div className="flex gap-1">
            <Button
              variant="outline" 
              size={buttonSize}
              disabled={isLoading}
              onClick={() => handleQualify('review')}
              className="text-yellow-600 hover:text-yellow-700"
            >
              {isLoading ? 'Updating...' : 'Move to Review'}
            </Button>
          </div>
        )
      
      case 'review':
        // In review - show qualify or disqualify
        return (
          <div className="flex gap-1">
            <Button
              variant="outline" 
              size={buttonSize}
              disabled={isLoading}
              onClick={() => handleQualify('qualified')}
              className="text-green-600 hover:text-green-700"
            >
              {isLoading ? 'Updating...' : '✅ Qualify'}
            </Button>
            <Button
              variant="outline" 
              size={buttonSize}
              disabled={isLoading}
              onClick={() => handleQualify('disqualified')}
              className="text-red-600 hover:text-red-700"
            >
              {isLoading ? 'Updating...' : '❌ Disqualify'}
            </Button>
          </div>
        )
      
      case 'disqualified':
        // Disqualified - minimal recovery option
        return (
          <div className="flex gap-1">
            <Button
              variant="outline" 
              size={buttonSize}
              disabled={isLoading}
              onClick={() => handleQualify('review')}
              className="text-yellow-600 hover:text-yellow-700"
            >
              {isLoading ? 'Updating...' : 'Move to Review'}
            </Button>
          </div>
        )
      
      default:
        // Unqualified - show all options
        return (
          <div className="flex gap-1">
            <Button
              variant="outline" 
              size={buttonSize}
              disabled={isLoading}
              onClick={() => handleQualify('qualified')}
              className="text-green-600 hover:text-green-700"
            >
              {isLoading ? 'Updating...' : 'Qualify'}
            </Button>
            <Button
              variant="outline" 
              size={buttonSize}
              disabled={isLoading}
              onClick={() => handleQualify('disqualified')}
              className="text-red-600 hover:text-red-700"
            >
              {isLoading ? 'Updating...' : 'Disqualify'}
            </Button>
            <Button
              variant="outline" 
              size={buttonSize}
              disabled={isLoading}
              onClick={() => handleQualify('review')}
              className="text-yellow-600 hover:text-yellow-700"
            >
              {isLoading ? 'Updating...' : 'Review'}
            </Button>
          </div>
        )
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {showBadge && (
        <div className="flex justify-start">
          {getQualificationBadge()}
        </div>
      )}
      <div className="flex justify-start">
        {getActions()}
      </div>
    </div>
  )
}
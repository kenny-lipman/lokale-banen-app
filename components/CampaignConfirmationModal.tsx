"use client"

import React, { useEffect, useRef, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Building2, 
  User, 
  Mail, 
  Briefcase,
  ChevronDown,
  ChevronUp,
  Loader2,
  Target,
  RefreshCw,
  Shield,
  ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CampaignValidation } from '@/components/blocklist/campaign-validation'

// TypeScript interfaces
export interface Contact {
  id: string
  name: string
  first_name?: string
  last_name?: string
  email: string
  title?: string
  companyName?: string
  qualificationStatus?: string
  isKeyContact?: boolean
}

export interface Campaign {
  id: string
  name: string
  description?: string
  status?: string
  metadata?: {
    total_leads?: number
    active_leads?: number
  }
}

export interface CampaignConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (validatedContacts?: Contact[]) => void
  selectedContacts: Contact[]
  selectedCampaign: Campaign | null
  isLoading?: boolean
  error?: string | null
  onRetry?: () => void
  onSuccess?: () => void
  onError?: (error: string) => void
  // New props for enhanced progress tracking
  progress?: {
    percentage: number
    completedSteps: number
    totalSteps: number
    currentStep: 'creation' | 'movement' | 'completed'
  } | undefined
  steps?: {
    step1: {
      name: string
      completed: boolean
      created: number
      total: number
      status: 'success' | 'failed' | 'pending'
    }
    step2: {
      name: string
      completed: boolean
      moved: number
      total: number
      status: 'success' | 'failed' | 'skipped' | 'pending'
    }
  } | undefined
  retryRecommendations?: string[]
  severity?: 'success' | 'warning' | 'error'
}

export function CampaignConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  selectedContacts,
  selectedCampaign,
  isLoading = false,
  error,
  onRetry,
  onSuccess,
  onError,
  // New props with defaults
  progress,
  steps,
  retryRecommendations = [],
  severity
}: CampaignConfirmationModalProps) {
  const [expandedContacts, setExpandedContacts] = useState(false)
  const [expandedCompanies, setExpandedCompanies] = useState(false)
  const [validatedContacts, setValidatedContacts] = useState<Contact[]>(selectedContacts)
  const [blockedCount, setBlockedCount] = useState(0)
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Group contacts by company
  const contactsByCompany = selectedContacts.reduce((acc, contact) => {
    const companyName = contact.companyName || 'Unknown Company'
    if (!acc[companyName]) {
      acc[companyName] = {
        name: companyName,
        contacts: []
      }
    }
    acc[companyName].contacts.push(contact)
    return acc
  }, {} as Record<string, { name: string; contacts: Contact[] }>)

  const companyGroups = Object.values(contactsByCompany)
  const totalContacts = selectedContacts.length
  const totalCompanies = companyGroups.length
  const validContacts = validatedContacts.length



  // Calculate qualification statistics
  const qualifiedContacts = selectedContacts.filter(c => c.qualificationStatus === 'qualified').length
  const reviewContacts = selectedContacts.filter(c => c.qualificationStatus === 'review').length
  const pendingContacts = selectedContacts.filter(c => c.qualificationStatus === 'pending').length
  const disqualifiedContacts = selectedContacts.filter(c => c.qualificationStatus === 'disqualified').length

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'Enter' && !isLoading) {
        event.preventDefault()
        onConfirm()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onConfirm, isLoading])

  // Focus management
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        confirmButtonRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Handle click outside
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const getQualificationIcon = (status?: string) => {
    switch (status) {
      case 'qualified':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'review':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'disqualified':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-400" />
    }
  }

  const getQualificationBadge = (status?: string) => {
    switch (status) {
      case 'qualified':
        return <Badge variant="default" className="bg-green-100 text-green-800">Qualified</Badge>
      case 'review':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Review</Badge>
      case 'disqualified':
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Disqualified</Badge>
      default:
        return <Badge variant="outline" className="bg-gray-100 text-gray-600">Pending</Badge>
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        ref={modalRef}
        className="max-w-2xl max-h-[90vh] overflow-hidden"
        onPointerDownOutside={handleOverlayClick}
      >
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Confirm Campaign Addition
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600 mt-2">
                Review the details below before adding contacts to the campaign. This action cannot be undone.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Campaign Information */}
          {selectedCampaign && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Target className="h-5 w-5 text-orange-600" />
                  <div className="flex-1">
                    <h3 className="font-medium text-orange-900">{selectedCampaign.name}</h3>
                    {selectedCampaign.description && (
                      <p className="text-sm text-orange-700 mt-1">{selectedCampaign.description}</p>
                    )}
                    {selectedCampaign.metadata && (
                      <div className="flex gap-4 mt-2 text-xs text-orange-600">
                        <span>Total Leads: {selectedCampaign.metadata.total_leads || 0}</span>
                        <span>Active Leads: {selectedCampaign.metadata.active_leads || 0}</span>
                      </div>
                    )}
                  </div>
                  {selectedCampaign.status && (
                    <Badge variant="outline" className="text-xs">
                      {selectedCampaign.status}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Processing Progress */}
          {progress && steps && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-blue-900">Processing Progress</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-700">{progress.percentage}%</span>
                      <span className="text-xs text-blue-600">({progress.completedSteps} of {progress.totalSteps} steps)</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${progress.percentage}%` }} 
                    />
                  </div>

                  {/* Step-by-Step Progress */}
                  <div className="space-y-3">
                    {/* Step 1: Lead Creation */}
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                        steps.step1?.status === 'success' && "bg-green-100 text-green-700",
                        steps.step1?.status === 'failed' && "bg-red-100 text-red-700",
                        steps.step1?.status === 'pending' && "bg-blue-100 text-blue-700"
                      )}>
                        {steps.step1?.status === 'success' && <CheckCircle className="h-3 w-3" />}
                        {steps.step1?.status === 'failed' && <XCircle className="h-3 w-3" />}
                        {steps.step1?.status === 'pending' && <Loader2 className="h-3 w-3 animate-spin" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-blue-900">{steps.step1?.name || 'Lead Creation & Campaign Assignment'}</span>
                          <span className="text-xs text-blue-600">
                            {steps.step1 ? `${steps.step1.created} of ${steps.step1.total}` : '0 of 0'}
                          </span>
                        </div>
                        {steps.step1?.status === 'pending' && (
                          <div className="w-full bg-blue-200 rounded-full h-1 mt-1">
                            <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '60%' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Blocklist Validation */}
          <div className="space-y-4">
            <CampaignValidation
              contacts={selectedContacts}
              onValidationComplete={(result) => {
                setValidatedContacts(result.validContacts)
                setBlockedCount(result.blockedContacts.length)
                setValidationWarnings(result.warnings)
              }}
              showBlockedDetails={true}
              autoValidate={true}
            />
          </div>

          {/* Contact Summary */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Contact Summary</h3>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-sm">
                  {validContacts} toegestaan
                </Badge>
                {blockedCount > 0 && (
                  <Badge variant="destructive" className="text-sm">
                    <ShieldAlert className="h-3 w-3 mr-1" />
                    {blockedCount} geblokkeerd
                  </Badge>
                )}
                <Badge variant="outline" className="text-sm">
                  {totalCompanies} compan{totalCompanies !== 1 ? 'ies' : 'y'}
                </Badge>
              </div>
            </div>

            {/* Qualification Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {qualifiedContacts > 0 && (
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-800">{qualifiedContacts} Qualified</span>
                </div>
              )}
              {reviewContacts > 0 && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded-md">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">{reviewContacts} Review</span>
                </div>
              )}
              {pendingContacts > 0 && (
                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-md">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600">{pendingContacts} Pending</span>
                </div>
              )}
              {disqualifiedContacts > 0 && (
                <div className="flex items-center gap-2 p-2 bg-red-50 rounded-md">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">{disqualifiedContacts} Disqualified</span>
                </div>
              )}
            </div>
          </div>

          {/* Company Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Companies</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedCompanies(!expandedCompanies)}
                className="text-xs"
              >
                {expandedCompanies ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Expand
                  </>
                )}
              </Button>
            </div>

            <div className="space-y-2">
              {companyGroups.slice(0, expandedCompanies ? undefined : 3).map((company, index) => (
                <div key={company.name} className="flex items-center justify-between p-2 bg-gray-50 rounded-md">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium">{company.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {company.contacts.length} contact{company.contacts.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              ))}
              
              {!expandedCompanies && companyGroups.length > 3 && (
                <div className="text-center py-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedCompanies(true)}
                    className="text-xs text-gray-500"
                  >
                    +{companyGroups.length - 3} more companies
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Contact Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedContacts(!expandedContacts)}
                className="text-xs"
              >
                {expandedContacts ? (
                  <>
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Expand
                  </>
                )}
              </Button>
            </div>

            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {selectedContacts.slice(0, expandedContacts ? undefined : 10).map((contact, index) => (
                  <div key={contact.id} className="flex items-center justify-between p-3 border rounded-md">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex items-center gap-2">
                        {getQualificationIcon(contact.qualificationStatus)}
                        <User className="h-4 w-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{contact.name}</span>
                          {contact.isKeyContact && (
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                              Key
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                          {contact.title && (
                            <div className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              <span className="truncate">{contact.title}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{contact.email}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getQualificationBadge(contact.qualificationStatus)}
                    </div>
                  </div>
                ))}
                
                {!expandedContacts && selectedContacts.length > 10 && (
                  <div className="text-center py-3 border rounded-md bg-gray-50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedContacts(true)}
                      className="text-sm text-gray-600"
                    >
                      Show {selectedContacts.length - 10} more contacts
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Error State */}
          {error && (
            <div className={cn(
              "border rounded-lg p-4",
              severity === 'success' && "bg-green-50 border-green-200",
              severity === 'warning' && "bg-yellow-50 border-yellow-200", 
              severity === 'error' && "bg-red-50 border-red-200",
              !severity && "bg-red-50 border-red-200"
            )}>
              <div className="flex items-start gap-3">
                {severity === 'success' && <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />}
                {severity === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />}
                {(severity === 'error' || !severity) && <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />}
                <div className="flex-1">
                  <h4 className={cn(
                    "font-medium",
                    severity === 'success' && "text-green-900",
                    severity === 'warning' && "text-yellow-900",
                    severity === 'error' && "text-red-900",
                    !severity && "text-red-900"
                  )}>
                    {severity === 'success' && 'Success'}
                    {severity === 'warning' && 'Warning'}
                    {(severity === 'error' || !severity) && 'Error'}
                  </h4>
                  <p className={cn(
                    "text-sm mt-1",
                    severity === 'success' && "text-green-700",
                    severity === 'warning' && "text-yellow-700",
                    severity === 'error' && "text-red-700",
                    !severity && "text-red-700"
                  )}>
                    {error}
                  </p>
                  
                  {/* Retry Recommendations */}
                  {retryRecommendations && retryRecommendations.length > 0 && (
                    <div className="mt-3">
                      <h5 className={cn(
                        "text-xs font-medium mb-2",
                        severity === 'success' && "text-green-800",
                        severity === 'warning' && "text-yellow-800",
                        severity === 'error' && "text-red-800",
                        !severity && "text-red-800"
                      )}>
                        Recommendations:
                      </h5>
                      <ul className="space-y-1">
                        {retryRecommendations.map((recommendation, index) => (
                          <li key={index} className={cn(
                            "text-xs flex items-start gap-2",
                            severity === 'success' && "text-green-700",
                            severity === 'warning' && "text-yellow-700",
                            severity === 'error' && "text-red-700",
                            !severity && "text-red-700"
                          )}>
                            <span className="mt-1">•</span>
                            <span>{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {onRetry && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onRetry}
                      disabled={isLoading}
                      className={cn(
                        "mt-3",
                        severity === 'success' && "text-green-700 border-green-300 hover:bg-green-100",
                        severity === 'warning' && "text-yellow-700 border-yellow-300 hover:bg-yellow-100",
                        severity === 'error' && "text-red-700 border-red-300 hover:bg-red-100",
                        !severity && "text-red-700 border-red-300 hover:bg-red-100"
                      )}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Warning Message */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-red-900">Important</h4>
                <p className="text-sm text-red-700 mt-1">
                  Adding contacts to a campaign is irreversible. Please review all details carefully before confirming.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            ref={confirmButtonRef}
            onClick={() => onConfirm(validatedContacts)}
            disabled={isLoading || validatedContacts.length === 0}
            className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding to Campaign...
              </>
            ) : (
              <>
                {blockedCount > 0 && (
                  <Shield className="h-4 w-4 mr-2" />
                )}
                Add {validContacts} Valid Contact{validContacts !== 1 ? 's' : ''} to Campaign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 
"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  Users, 
  Building2, 
  Crown, 
  CheckCircle, 
  X,
  Mail,
  Target
} from 'lucide-react'

interface CampaignConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  selectedContacts: SelectedContact[]
  campaignDetails: CampaignDetails
  isLoading?: boolean
}

interface SelectedContact {
  id: string
  name: string
  email: string
  title: string
  companyName: string
  isKeyContact: boolean
  emailVerified: boolean
}

interface CampaignDetails {
  id: string
  name: string
  template: string
  currentContactCount: number
  maxContacts: number
}

export function CampaignConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  selectedContacts, 
  campaignDetails,
  isLoading = false 
}: CampaignConfirmationModalProps) {
  const [isConfirming, setIsConfirming] = useState(false)

  // Calculate summary statistics
  const totalContacts = selectedContacts.length
  const keyContacts = selectedContacts.filter(c => c.isKeyContact).length
  const verifiedEmails = selectedContacts.filter(c => c.emailVerified).length
  const companies = [...new Set(selectedContacts.map(c => c.companyName))].length

  // Group contacts by company
  const contactsByCompany = selectedContacts.reduce((acc, contact) => {
    if (!acc[contact.companyName]) {
      acc[contact.companyName] = []
    }
    acc[contact.companyName].push(contact)
    return acc
  }, {} as Record<string, SelectedContact[]>)

  // Validation checks
  const unverifiedCount = totalContacts - verifiedEmails
  const newTotalContacts = campaignDetails.currentContactCount + totalContacts
  const exceedsLimit = newTotalContacts > campaignDetails.maxContacts

  const handleConfirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
    } finally {
      setIsConfirming(false)
    }
  }

  const hasIssues = unverifiedCount > 0 || exceedsLimit

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Confirm Campaign Addition
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{totalContacts}</div>
              <div className="text-sm text-gray-600">Contacts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{companies}</div>
              <div className="text-sm text-gray-600">Companies</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{keyContacts}</div>
              <div className="text-sm text-gray-600">Key Contacts</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{verifiedEmails}</div>
              <div className="text-sm text-gray-600">Verified Emails</div>
            </div>
          </div>

          {/* Validation Warnings */}
          {hasIssues && (
            <div className="space-y-3">
              {unverifiedCount > 0 && (
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{unverifiedCount} contacts</strong> have unverified email addresses. 
                    They may not be accepted by the campaign platform.
                  </AlertDescription>
                </Alert>
              )}
              
              {exceedsLimit && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This would exceed the campaign limit! 
                    New total: <strong>{newTotalContacts}</strong> / {campaignDetails.maxContacts} contacts.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Contacts Breakdown */}
          <div>
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contacts to Add
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-4 border rounded-lg p-4">
              {Object.entries(contactsByCompany).map(([companyName, contacts]) => (
                <div key={companyName} className="space-y-2">
                  <div className="flex items-center gap-2 font-medium text-gray-700">
                    <Building2 className="w-4 h-4" />
                    {companyName}
                    <Badge variant="outline">{contacts.length} contacts</Badge>
                  </div>
                  <div className="ml-6 space-y-1">
                    {contacts.map(contact => (
                      <div key={contact.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {contact.isKeyContact && (
                            <Crown className="w-3 h-3 text-yellow-500" />
                          )}
                          <span>{contact.name}</span>
                          <span className="text-gray-500">({contact.title})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {contact.emailVerified ? (
                            <CheckCircle className="w-3 h-3 text-green-500" />
                          ) : (
                            <AlertTriangle className="w-3 h-3 text-yellow-500" />
                          )}
                          <span className={contact.emailVerified ? 'text-green-600' : 'text-yellow-600'}>
                            {contact.emailVerified ? 'Verified' : 'Unverified'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Campaign Details */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Campaign Details
            </h3>
            <div className="space-y-1 text-sm">
              <div><strong>Campaign:</strong> {campaignDetails.name}</div>
              <div><strong>Template:</strong> {campaignDetails.template}</div>
              <div><strong>Current Contacts:</strong> {campaignDetails.currentContactCount}</div>
              <div><strong>After Addition:</strong> {newTotalContacts} / {campaignDetails.maxContacts}</div>
            </div>
          </div>

          {/* Warning */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>This action cannot be undone.</strong> Contacts will be immediately added to the campaign 
              and may start receiving emails according to the campaign schedule.
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isConfirming}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirm} 
              disabled={exceedsLimit || isConfirming}
              className="min-w-32"
            >
              {isConfirming ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Yes, Add to Campaign
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
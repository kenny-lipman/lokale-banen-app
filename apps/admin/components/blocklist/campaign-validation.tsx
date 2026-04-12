'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle2, XCircle, Users, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { authFetch } from '@/lib/authenticated-fetch';

interface CampaignValidationProps {
  contacts: any[];
  onValidationComplete?: (result: {
    validContacts: any[];
    blockedContacts: any[];
    warnings: string[];
  }) => void;
  showBlockedDetails?: boolean;
  autoValidate?: boolean;
}

export function CampaignValidation({
  contacts,
  onValidationComplete,
  showBlockedDetails = false,
  autoValidate = true
}: CampaignValidationProps) {
  const [validationResult, setValidationResult] = useState<{
    validContacts: any[];
    blockedContacts: Array<{ contact: any; reason: string }>;
    warnings: string[];
    loading: boolean;
    progress: number;
    totalContacts: number;
  }>({
    validContacts: [],
    blockedContacts: [],
    warnings: [],
    loading: false,
    progress: 0,
    totalContacts: 0
  });

  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (autoValidate && contacts.length > 0) {
      validateContacts();
    }
  }, [contacts, autoValidate]);

  const validateContacts = async () => {
    if (contacts.length === 0) {
      return;
    }

    setValidationResult(prev => ({
      ...prev,
      loading: true,
      progress: 0,
      totalContacts: contacts.length
    }));

    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setValidationResult(prev => ({
          ...prev,
          progress: Math.min(prev.progress + Math.random() * 20, 90)
        }));
      }, 200);

      const response = await authFetch('/api/blocklist/validate-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contacts })
      })

      if (!response.ok) {
        throw new Error('Failed to validate contacts')
      }

      const result = await response.json()

      clearInterval(progressInterval);

      const finalResult = {
        validContacts: result.valid_contacts,
        blockedContacts: result.blocked_contacts,
        warnings: result.warnings,
        loading: false,
        progress: 100,
        totalContacts: contacts.length
      };

      setValidationResult(finalResult);

      // Notify parent component
      if (onValidationComplete) {
        onValidationComplete({
          validContacts: result.valid_contacts,
          blockedContacts: result.blocked_contacts,
          warnings: result.warnings
        });
      }
    } catch (error) {
      console.error('Campaign validation failed:', error);
      setValidationResult(prev => ({
        ...prev,
        loading: false,
        progress: 0,
        warnings: ['Fout bij validatie van contacten. Probeer opnieuw.']
      }));
    }
  };

  const getValidationSummary = () => {
    const { validContacts, blockedContacts, totalContacts } = validationResult;

    if (totalContacts === 0) {
      return {
        status: 'empty',
        message: 'Geen contacten om te valideren',
        icon: Users,
        color: 'text-gray-500'
      };
    }

    if (blockedContacts.length === 0) {
      return {
        status: 'valid',
        message: `Alle ${validContacts.length} contacten zijn toegestaan`,
        icon: CheckCircle2,
        color: 'text-green-600'
      };
    }

    if (validContacts.length === 0) {
      return {
        status: 'blocked',
        message: `Alle ${blockedContacts.length} contacten zijn geblokkeerd`,
        icon: XCircle,
        color: 'text-red-600'
      };
    }

    return {
      status: 'mixed',
      message: `${validContacts.length} toegestaan, ${blockedContacts.length} geblokkeerd`,
      icon: AlertTriangle,
      color: 'text-yellow-600'
    };
  };

  const extractEmailFromContact = (contact: any): string => {
    if (typeof contact === 'string') {
      return contact;
    }

    const emailFields = ['email', 'email_address', 'emailAddress', 'primaryEmail'];
    for (const field of emailFields) {
      if (contact[field]) {
        return contact[field];
      }
    }

    if (Array.isArray(contact.emails) && contact.emails.length > 0) {
      const primaryEmail = contact.emails.find((e: any) => e.primary);
      if (primaryEmail) {
        return primaryEmail.value || primaryEmail.email;
      }
      return contact.emails[0].value || contact.emails[0].email || contact.emails[0];
    }

    return contact.name || 'Onbekend contact';
  };

  if (contacts.length === 0) {
    return (
      <Alert>
        <Users className="h-4 w-4" />
        <AlertDescription>
          Geen contacten gevonden om te valideren voor deze campaign.
        </AlertDescription>
      </Alert>
    );
  }

  const summary = getValidationSummary();

  return (
    <div className="space-y-4">
      {/* Validation Progress */}
      {validationResult.loading && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-gray-600">
              Contacten valideren tegen blocklist...
            </span>
          </div>
          <Progress value={validationResult.progress} className="h-2" />
          <p className="text-xs text-gray-500">
            {Math.round(validationResult.progress)}% - {validationResult.totalContacts} contacten
          </p>
        </div>
      )}

      {/* Validation Summary */}
      {!validationResult.loading && (
        <Alert className={`border-l-4 ${
          summary.status === 'valid' ? 'border-l-green-500 bg-green-50' :
          summary.status === 'blocked' ? 'border-l-red-500 bg-red-50' :
          summary.status === 'mixed' ? 'border-l-yellow-500 bg-yellow-50' :
          'border-l-gray-500 bg-gray-50'
        }`}>
          <summary.icon className={`h-4 w-4 ${summary.color}`} />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{summary.message}</p>
                {validationResult.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {validationResult.warnings.map((warning, index) => (
                      <p key={index} className="text-sm text-yellow-700">
                        • {warning}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {validationResult.blockedContacts.length > 0 && showBlockedDetails && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDetails(!showDetails)}
                  className="ml-4"
                >
                  {showDetails ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" />
                      Verbergen
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" />
                      Details
                    </>
                  )}
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics */}
      {!validationResult.loading && validationResult.totalContacts > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-3 rounded-lg border">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium">Totaal</p>
                <p className="text-xl font-bold text-gray-900">
                  {validationResult.totalContacts}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-700">Toegestaan</p>
                <p className="text-xl font-bold text-green-900">
                  {validationResult.validContacts.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="flex items-center space-x-2">
              <Shield className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700">Geblokkeerd</p>
                <p className="text-xl font-bold text-red-900">
                  {validationResult.blockedContacts.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Blocked Contacts Details */}
      {showDetails && validationResult.blockedContacts.length > 0 && (
        <div className="space-y-3">
          <Separator />
          <div>
            <h4 className="font-medium text-sm text-gray-900 mb-3 flex items-center">
              <Shield className="h-4 w-4 mr-2 text-red-500" />
              Geblokkeerde Contacten ({validationResult.blockedContacts.length})
            </h4>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {validationResult.blockedContacts.map((blocked, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-200"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm text-red-900">
                      {extractEmailFromContact(blocked.contact)}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {blocked.reason}
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    Geblokkeerd
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Validation Button */}
      {!autoValidate && !validationResult.loading && (
        <Button
          onClick={validateContacts}
          className="w-full"
          disabled={contacts.length === 0}
        >
          <Shield className="h-4 w-4 mr-2" />
          Contacten Valideren
        </Button>
      )}
    </div>
  );
}
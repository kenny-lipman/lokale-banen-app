'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, Loader2 } from 'lucide-react';
import { contactFilteringService } from '@/lib/services/contact-filtering.service';
import { useBlocklist } from '@/hooks/use-blocklist';

interface ContactBlocklistIntegrationProps {
  contact: any;
  showQuickActions?: boolean;
  onContactUpdated?: (contact: any) => void;
}

export function ContactBlocklistIntegration({
  contact,
  showQuickActions = true,
  onContactUpdated
}: ContactBlocklistIntegrationProps) {
  const [blocklistStatus, setBlocklistStatus] = useState<{
    is_blocked: boolean;
    reason?: string;
    entry?: any;
    loading: boolean;
    error?: string;
  }>({
    is_blocked: false,
    loading: true
  });

  const { addEntry } = useBlocklist();

  useEffect(() => {
    checkBlocklistStatus();
  }, [contact]);

  const checkBlocklistStatus = async () => {
    if (!contact) return;

    const email = extractEmailFromContact(contact);
    if (!email) {
      setBlocklistStatus({
        is_blocked: false,
        loading: false,
        error: 'Geen email gevonden'
      });
      return;
    }

    try {
      setBlocklistStatus(prev => ({ ...prev, loading: true }));

      const result = await contactFilteringService.checkContactByEmail(email);

      setBlocklistStatus({
        is_blocked: result.is_blocked,
        reason: result.reason,
        entry: result.entry,
        loading: false,
        error: result.is_blocked ? undefined : undefined
      });
    } catch (error) {
      console.error('Failed to check blocklist status:', error);
      setBlocklistStatus({
        is_blocked: false,
        loading: false,
        error: 'Fout bij controleren blocklist status'
      });
    }
  };

  const handleQuickBlock = async () => {
    const email = extractEmailFromContact(contact);
    if (!email) {
      toast({
        title: 'Fout',
        description: 'Geen email adres gevonden voor dit contact',
        variant: 'destructive'
      });
      return;
    }

    try {
      const reason = `Geblokkeerd via contact: ${contact.name || email}`;

      const result = await addEntry({
        type: 'email' as const,
        value: email,
        reason
      });

      if (result.success) {
        toast({
          title: 'Contact geblokkeerd',
          description: `${email} is toegevoegd aan de blocklist`
        });

        // Update local status
        setBlocklistStatus(prev => ({
          ...prev,
          is_blocked: true,
          reason,
          entry: result.data
        }));

        // Notify parent component
        if (onContactUpdated) {
          const updatedContact = {
            ...contact,
            blocklist_status: {
              is_blocked: true,
              reason,
              entry_id: result.data?.id,
              checked: true,
              checked_at: new Date().toISOString()
            }
          };
          onContactUpdated(updatedContact);
        }
      } else {
        toast({
          title: 'Fout bij blokkeren',
          description: result.error || 'Onbekende fout opgetreden',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to block contact:', error);
      toast({
        title: 'Fout bij blokkeren',
        description: 'Er is een fout opgetreden bij het blokkeren van dit contact',
        variant: 'destructive'
      });
    }
  };

  const extractEmailFromContact = (contact: any): string | null => {
    if (typeof contact === 'string') {
      return isValidEmail(contact) ? contact : null;
    }

    if (typeof contact === 'object' && contact !== null) {
      // Try common email field names
      const emailFields = ['email', 'email_address', 'emailAddress', 'primaryEmail', 'primary_email'];

      for (const field of emailFields) {
        const value = contact[field];
        if (value && typeof value === 'string' && isValidEmail(value)) {
          return value.toLowerCase().trim();
        }
      }

      // Handle arrays of emails
      if (Array.isArray(contact.emails) && contact.emails.length > 0) {
        const primaryEmail = contact.emails.find((e: any) => e.primary || e.is_primary);
        if (primaryEmail && isValidEmail(primaryEmail.value || primaryEmail.email)) {
          return (primaryEmail.value || primaryEmail.email).toLowerCase().trim();
        }

        const firstEmail = contact.emails[0];
        if (firstEmail && isValidEmail(firstEmail.value || firstEmail.email || firstEmail)) {
          const email = firstEmail.value || firstEmail.email || firstEmail;
          return typeof email === 'string' ? email.toLowerCase().trim() : null;
        }
      }
    }

    return null;
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getStatusIcon = () => {
    if (blocklistStatus.loading) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }

    if (blocklistStatus.error) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }

    if (blocklistStatus.is_blocked) {
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    }

    return <ShieldCheck className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (blocklistStatus.loading) {
      return 'Controleren...';
    }

    if (blocklistStatus.error) {
      return 'Fout bij controle';
    }

    if (blocklistStatus.is_blocked) {
      return 'Geblokkeerd';
    }

    return 'Toegestaan';
  };

  const getStatusColor = (): 'default' | 'destructive' | 'secondary' | 'outline' => {
    if (blocklistStatus.loading || blocklistStatus.error) {
      return 'secondary';
    }

    if (blocklistStatus.is_blocked) {
      return 'destructive';
    }

    return 'outline';
  };

  if (blocklistStatus.error && !extractEmailFromContact(contact)) {
    return null; // Don't show anything if no email is available
  }

  return (
    <div className="space-y-2">
      {/* Status Badge */}
      <div className="flex items-center space-x-2">
        <Badge variant={getStatusColor()} className="flex items-center space-x-1">
          {getStatusIcon()}
          <span className="text-xs">{getStatusText()}</span>
        </Badge>

        {showQuickActions && !blocklistStatus.is_blocked && !blocklistStatus.loading && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleQuickBlock}
            className="h-6 px-2 text-xs"
          >
            <Shield className="h-3 w-3 mr-1" />
            Blokkeren
          </Button>
        )}
      </div>

      {/* Blocked Alert */}
      {blocklistStatus.is_blocked && (
        <Alert className="border-red-200 bg-red-50">
          <ShieldAlert className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm">
            <div className="space-y-1">
              <p className="font-medium text-red-700">Dit contact staat op de blocklist</p>
              {blocklistStatus.reason && (
                <p className="text-red-600 text-xs">{blocklistStatus.reason}</p>
              )}
              {blocklistStatus.entry?.created_at && (
                <p className="text-red-500 text-xs">
                  Geblokkeerd op: {new Date(blocklistStatus.entry.created_at).toLocaleDateString('nl-NL')}
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {blocklistStatus.error && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertDescription className="text-sm text-yellow-700">
            {blocklistStatus.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
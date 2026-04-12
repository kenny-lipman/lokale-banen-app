'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Shield, ShieldCheck, AlertTriangle, Loader2, Users } from 'lucide-react';
import { useBlocklist } from '@/hooks/use-blocklist';
import { contactFilteringService } from '@/lib/services/contact-filtering.service';

interface BulkContactActionsProps {
  selectedContacts: any[];
  onActionComplete?: () => void;
  trigger?: React.ReactNode;
}

export function BulkContactActions({
  selectedContacts,
  onActionComplete,
  trigger
}: BulkContactActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [action, setAction] = useState<'block' | 'check' | ''>('');
  const [blockType, setBlockType] = useState<'email' | 'domain'>('email');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{
    successful: number;
    failed: number;
    skipped: number;
    details: Array<{
      contact: any;
      email: string;
      status: 'success' | 'error' | 'skipped';
      message: string;
    }>;
  } | null>(null);

  const { addEntry } = useBlocklist();

  const extractEmailFromContact = (contact: any): string | null => {
    if (typeof contact === 'string' && isValidEmail(contact)) {
      return contact.toLowerCase().trim();
    }

    if (typeof contact === 'object' && contact !== null) {
      const emailFields = ['email', 'email_address', 'emailAddress', 'primaryEmail', 'primary_email'];

      for (const field of emailFields) {
        const value = contact[field];
        if (value && typeof value === 'string' && isValidEmail(value)) {
          return value.toLowerCase().trim();
        }
      }

      if (Array.isArray(contact.emails) && contact.emails.length > 0) {
        const primaryEmail = contact.emails.find((e: any) => e.primary);
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

  const getDomainFromEmail = (email: string): string => {
    return email.split('@')[1] || '';
  };

  const handleBulkCheck = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      const contactsWithEmails = selectedContacts
        .map(contact => ({
          contact,
          email: extractEmailFromContact(contact)
        }))
        .filter(item => item.email);

      if (contactsWithEmails.length === 0) {
        toast({
          title: 'Geen emails gevonden',
          description: 'Er zijn geen geldige email adressen gevonden in de geselecteerde contacten',
          variant: 'destructive'
        });
        return;
      }

      const filterResult = await contactFilteringService.filterContacts(
        selectedContacts,
        {
          check_domains: true,
          return_blocked_details: true
        }
      );

      const details = contactsWithEmails.map(item => {
        const isBlocked = filterResult.blocked_details.some(
          blocked => extractEmailFromContact(blocked.contact) === item.email
        );
        const blockedDetail = filterResult.blocked_details.find(
          blocked => extractEmailFromContact(blocked.contact) === item.email
        );

        return {
          contact: item.contact,
          email: item.email!,
          status: 'success' as const,
          message: isBlocked
            ? `Geblokkeerd: ${blockedDetail?.reason || 'Op blocklist'}`
            : 'Toegestaan'
        };
      });

      setResults({
        successful: details.length,
        failed: 0,
        skipped: selectedContacts.length - contactsWithEmails.length,
        details
      });

      setProgress(100);

      toast({
        title: 'Controle voltooid',
        description: `${filterResult.blocked_contacts} van de ${contactsWithEmails.length} contacten zijn geblokkeerd`
      });

    } catch (error) {
      console.error('Bulk check failed:', error);
      toast({
        title: 'Fout bij controle',
        description: 'Er is een fout opgetreden bij het controleren van de contacten',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkBlock = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Reden vereist',
        description: 'Geef een reden op voor het blokkeren',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const contactsWithEmails = selectedContacts
        .map(contact => ({
          contact,
          email: extractEmailFromContact(contact)
        }))
        .filter(item => item.email);

      if (contactsWithEmails.length === 0) {
        toast({
          title: 'Geen emails gevonden',
          description: 'Er zijn geen geldige email adressen gevonden in de geselecteerde contacten',
          variant: 'destructive'
        });
        return;
      }

      const results: Array<{
        contact: any;
        email: string;
        status: 'success' | 'error' | 'skipped';
        message: string;
      }> = [];

      let processed = 0;
      const total = contactsWithEmails.length;

      // Group by domain if blocking domains
      const itemsToProcess = new Map<string, Array<{ contact: any; email: string }>>();

      if (blockType === 'domain') {
        // Group by domain
        for (const item of contactsWithEmails) {
          const domain = getDomainFromEmail(item.email);
          if (!itemsToProcess.has(domain)) {
            itemsToProcess.set(domain, []);
          }
          itemsToProcess.get(domain)!.push(item);
        }

        // Block each domain once
        for (const [domain, contacts] of itemsToProcess.entries()) {
          try {
            const result = await addEntry({
              type: 'domain',
              value: domain,
              reason: reason.trim()
            });

            if (result.success) {
              for (const contact of contacts) {
                results.push({
                  contact: contact.contact,
                  email: contact.email,
                  status: 'success',
                  message: `Domein ${domain} geblokkeerd`
                });
              }
            } else {
              for (const contact of contacts) {
                results.push({
                  contact: contact.contact,
                  email: contact.email,
                  status: 'error',
                  message: result.error || 'Fout bij blokkeren domein'
                });
              }
            }

            processed += contacts.length;
            setProgress((processed / total) * 100);

            // Small delay to prevent rate limiting
            if (itemsToProcess.size > 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }

          } catch (error) {
            for (const contact of contacts) {
              results.push({
                contact: contact.contact,
                email: contact.email,
                status: 'error',
                message: 'Onverwachte fout bij blokkeren'
              });
            }
            processed += contacts.length;
            setProgress((processed / total) * 100);
          }
        }
      } else {
        // Block individual emails
        for (const item of contactsWithEmails) {
          try {
            const result = await addEntry({
              type: 'email',
              value: item.email,
              reason: reason.trim()
            });

            if (result.success) {
              results.push({
                contact: item.contact,
                email: item.email,
                status: 'success',
                message: 'Succesvol geblokkeerd'
              });
            } else {
              results.push({
                contact: item.contact,
                email: item.email,
                status: 'error',
                message: result.error || 'Fout bij blokkeren'
              });
            }

            processed++;
            setProgress((processed / total) * 100);

            // Small delay to prevent overwhelming the system
            if (processed < total) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }

          } catch (error) {
            results.push({
              contact: item.contact,
              email: item.email,
              status: 'error',
              message: 'Onverwachte fout bij blokkeren'
            });
            processed++;
            setProgress((processed / total) * 100);
          }
        }
      }

      const successful = results.filter(r => r.status === 'success').length;
      const failed = results.filter(r => r.status === 'error').length;

      setResults({
        successful,
        failed,
        skipped: selectedContacts.length - contactsWithEmails.length,
        details: results
      });

      if (successful > 0) {
        toast({
          title: 'Blokkering voltooid',
          description: `${successful} contact(en) succesvol geblokkeerd${failed > 0 ? `, ${failed} gefaald` : ''}`
        });

        if (onActionComplete) {
          onActionComplete();
        }
      } else {
        toast({
          title: 'Blokkering gefaald',
          description: 'Geen contacten konden worden geblokkeerd',
          variant: 'destructive'
        });
      }

    } catch (error) {
      console.error('Bulk block failed:', error);
      toast({
        title: 'Fout bij blokkeren',
        description: 'Er is een onverwachte fout opgetreden',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDialog = () => {
    setAction('');
    setBlockType('email');
    setReason('');
    setIsProcessing(false);
    setProgress(0);
    setResults(null);
  };

  const handleClose = () => {
    if (!isProcessing) {
      setIsOpen(false);
      resetDialog();
    }
  };

  const getActionButton = () => {
    if (!action) return null;

    if (action === 'check') {
      return (
        <Button
          onClick={handleBulkCheck}
          disabled={isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Contacten Controleren
        </Button>
      );
    }

    if (action === 'block') {
      return (
        <Button
          onClick={handleBulkBlock}
          disabled={isProcessing || !reason.trim()}
          variant="destructive"
          className="w-full"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Shield className="h-4 w-4 mr-2" />
          )}
          Contacten Blokkeren
        </Button>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="outline"
            disabled={selectedContacts.length === 0}
            onClick={() => setIsOpen(true)}
          >
            <Shield className="h-4 w-4 mr-2" />
            Bulk Acties ({selectedContacts.length})
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Bulk Contacten Acties</span>
            <Badge variant="secondary">{selectedContacts.length} geselecteerd</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Action Selection */}
          {!isProcessing && !results && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Kies actie:</label>
                <Select value={action} onValueChange={(value) => setAction(value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een actie..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="check">Controleer tegen blocklist</SelectItem>
                    <SelectItem value="block">Voeg toe aan blocklist</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {action === 'block' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Type blokkering:</label>
                    <Select value={blockType} onValueChange={(value) => setBlockType(value as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Individuele emails</SelectItem>
                        <SelectItem value="domain">Hele domeinen</SelectItem>
                      </SelectContent>
                    </Select>
                    {blockType === 'domain' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Let op: Dit blokkeert alle email adressen van de betreffende domeinen
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Reden voor blokkering:</label>
                    <Textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Geef een reden op waarom deze contacten geblokkeerd worden..."
                      rows={3}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {action === 'check' ? 'Contacten controleren...' : 'Contacten blokkeren...'}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-gray-500">
                {Math.round(progress)}% voltooid
              </p>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">
                      Actie voltooid: {results.successful} succesvol, {results.failed} gefaald
                      {results.skipped > 0 && `, ${results.skipped} overgeslagen (geen email)`}
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Results Summary */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{results.successful}</div>
                  <div className="text-xs text-green-700">Succesvol</div>
                </div>
                <div className="bg-red-50 p-3 rounded border border-red-200">
                  <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                  <div className="text-xs text-red-700">Gefaald</div>
                </div>
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="text-2xl font-bold text-gray-600">{results.skipped}</div>
                  <div className="text-xs text-gray-700">Overgeslagen</div>
                </div>
              </div>

              {/* Detailed Results */}
              {results.details.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {results.details.map((detail, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-sm border ${
                        detail.status === 'success'
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium">{detail.email}</p>
                          <p className="text-xs opacity-75">{detail.message}</p>
                        </div>
                        <Badge
                          variant={detail.status === 'success' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {detail.status === 'success' ? 'Success' : 'Error'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => {
                  handleClose();
                }}
                className="w-full"
              >
                Sluiten
              </Button>
            </div>
          )}

          {/* Action Button */}
          {!results && getActionButton()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
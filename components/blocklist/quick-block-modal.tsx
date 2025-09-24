'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Shield, ShieldAlert, Mail, Globe, AlertTriangle, Loader2 } from 'lucide-react';
import { useBlocklist } from '@/hooks/use-blocklist';
import { syncOrchestrator } from '@/lib/services/blocklist-sync-orchestrator.service';

interface QuickBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact?: {
    email?: string;
    name?: string;
    company?: string;
  };
  prefilledEmail?: string;
  prefilledType?: 'email' | 'domain';
  onSuccess?: () => void;
}

export function QuickBlockModal({
  isOpen,
  onClose,
  contact,
  prefilledEmail,
  prefilledType = 'email',
  onSuccess
}: QuickBlockModalProps) {
  const [type, setType] = useState<'email' | 'domain'>(prefilledType);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [syncToExternal, setSyncToExternal] = useState(true);

  const { addEntry } = useBlocklist();

  // Extract email and domain from contact or prefilled email
  const extractedEmail = contact?.email || prefilledEmail || '';
  const extractedDomain = extractedEmail ? extractedEmail.split('@')[1] : '';

  // Set initial value based on contact or prefilled email
  useState(() => {
    if (type === 'email' && extractedEmail) {
      setValue(extractedEmail);
    } else if (type === 'domain' && extractedDomain) {
      setValue(extractedDomain);
    }
  });

  const handleSubmit = async () => {
    if (!value.trim()) {
      toast({
        title: 'Waarde vereist',
        description: 'Voer een email adres of domein in om te blokkeren',
        variant: 'destructive'
      });
      return;
    }

    if (!reason.trim()) {
      toast({
        title: 'Reden vereist',
        description: 'Geef een reden op voor het blokkeren',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      // Add to blocklist
      const result = await addEntry({
        type,
        value: value.trim().toLowerCase(),
        reason: reason.trim()
      });

      if (result.success && result.data) {
        // Trigger sync to external platforms if enabled
        if (syncToExternal) {
          try {
            await syncOrchestrator.syncEntry(result.data.id, 'create');

            toast({
              title: 'Succesvol geblokkeerd en gesynchroniseerd',
              description: (
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4" />
                  <span>
                    {type === 'email' ? 'Email' : 'Domein'} {value} is toegevoegd aan de blocklist en wordt gesynchroniseerd
                  </span>
                </div>
              )
            });
          } catch (syncError) {
            console.error('Sync failed:', syncError);
            toast({
              title: 'Geblokkeerd (sync gefaald)',
              description: 'Entry toegevoegd aan blocklist maar synchronisatie mislukt',
              variant: 'destructive'
            });
          }
        } else {
          toast({
            title: 'Succesvol geblokkeerd',
            description: `${type === 'email' ? 'Email' : 'Domein'} ${value} is toegevoegd aan de blocklist`
          });
        }

        // Reset form
        setValue('');
        setReason('');

        // Call success callback if provided
        if (onSuccess) {
          onSuccess();
        }

        // Close modal
        onClose();
      } else {
        toast({
          title: 'Fout bij blokkeren',
          description: result.error || 'Er is een fout opgetreden',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Failed to block:', error);
      toast({
        title: 'Fout bij blokkeren',
        description: 'Er is een onverwachte fout opgetreden',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (newType: 'email' | 'domain') => {
    setType(newType);

    // Update value based on new type
    if (newType === 'email' && extractedEmail) {
      setValue(extractedEmail);
    } else if (newType === 'domain' && extractedDomain) {
      setValue(extractedDomain);
    } else {
      setValue('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-orange-600" />
            Snel Blokkeren
          </DialogTitle>
          <DialogDescription>
            Voeg een email adres of domein toe aan de blocklist om verdere communicatie te voorkomen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contact Info (if provided) */}
          {contact && (
            <Alert className="bg-blue-50 border-blue-200">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium text-blue-900">Contact Details:</p>
                  {contact.name && (
                    <p className="text-sm text-blue-700">Naam: {contact.name}</p>
                  )}
                  {contact.email && (
                    <p className="text-sm text-blue-700">Email: {contact.email}</p>
                  )}
                  {contact.company && (
                    <p className="text-sm text-blue-700">Bedrijf: {contact.company}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Block Type Selection */}
          <div className="space-y-2">
            <Label>Type blokkering</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>Specifiek email adres</span>
                  </div>
                </SelectItem>
                <SelectItem value="domain">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <span>Volledig domein</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {type === 'domain' && (
              <p className="text-xs text-yellow-600">
                Let op: Dit blokkeert ALLE email adressen van dit domein
              </p>
            )}
          </div>

          {/* Value Input */}
          <div className="space-y-2">
            <Label>{type === 'email' ? 'Email Adres' : 'Domein'}</Label>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={type === 'email' ? 'voorbeeld@bedrijf.nl' : 'bedrijf.nl'}
              disabled={isLoading}
              className="font-mono"
            />
            {value && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {type === 'email' ? (
                    <>
                      <Mail className="h-3 w-3 mr-1" />
                      Email
                    </>
                  ) : (
                    <>
                      <Globe className="h-3 w-3 mr-1" />
                      Domein
                    </>
                  )}
                </Badge>
                <span className="text-xs text-gray-500">
                  {value.toLowerCase()}
                </span>
              </div>
            )}
          </div>

          {/* Reason Input */}
          <div className="space-y-2">
            <Label>Reden voor blokkering *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Bijv. Niet geïnteresseerd, Concurrent, Spam, Klacht ontvangen..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Sync Options */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="syncExternal"
              checked={syncToExternal}
              onChange={(e) => setSyncToExternal(e.target.checked)}
              disabled={isLoading}
              className="rounded border-gray-300"
            />
            <Label htmlFor="syncExternal" className="text-sm font-normal cursor-pointer">
              Direct synchroniseren naar Instantly & Pipedrive
            </Label>
          </div>

          {/* Warning for domain blocking */}
          {type === 'domain' && value && (
            <Alert className="bg-red-50 border-red-200">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              <AlertDescription>
                <p className="text-sm text-red-700">
                  <strong>Let op:</strong> Alle email adressen eindigend op @{value} worden geblokkeerd.
                  Dit kan niet ongedaan gemaakt worden zonder de entry te verwijderen.
                </p>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Annuleren
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !value.trim() || !reason.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Blokkeren...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Blokkeren
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
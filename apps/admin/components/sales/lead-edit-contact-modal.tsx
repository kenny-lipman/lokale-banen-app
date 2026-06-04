'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { NormalizedContact } from '@/lib/services/sales-leads/types'

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  contact: NormalizedContact | null
  runId: string
  onSaved?: () => void | Promise<void>
}

/**
 * Edit-modal voor een bestaand contact. Splitst de huidige `name` (single
 * string) bij eerste spatie naar first/last als die nog niet gezet zijn,
 * zodat user de fallback "Afdeling Personeelszaken" met één bewerking kan
 * vervangen door een echte naam.
 */
export function LeadEditContactModal({ open, onOpenChange, contact, runId, onSaved }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phoneMobile, setPhoneMobile] = useState('')
  const [phoneOther, setPhoneOther] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!contact) return
    const { fn, ln } = splitName(contact)
    setFirstName(fn)
    setLastName(ln)
    setTitle(contact.title ?? '')
    setEmail(contact.email ?? '')
    setPhoneMobile(contact.phone_mobile ?? '')
    setPhoneOther(contact.phone_other ?? '')
  }, [contact])

  async function submit() {
    if (!contact) return
    const fn = firstName.trim()
    if (!fn) {
      toast.error('Voornaam is verplicht')
      return
    }
    setSaving(true)
    try {
      const updates: Record<string, string | null> = {
        first_name: fn,
        last_name: lastName.trim(),
        title: title.trim(),
        email: email.trim() === '' ? null : email.trim(),
        phone_mobile: phoneMobile.trim() === '' ? null : phoneMobile.trim(),
        phone_other: phoneOther.trim() === '' ? null : phoneOther.trim(),
      }
      const res = await fetch(`/api/sales-leads/${runId}/edit-contact`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchKey: { name: contact.name, email: contact.email ?? null },
          updates,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      toast.success('Contact bijgewerkt')
      await onSaved?.()
      onOpenChange(false)
    } catch (e) {
      toast.error('Bijwerken mislukt', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact bewerken</DialogTitle>
          <DialogDescription>
            Wijzigingen worden opgeslagen op de run en zijn beschikbaar bij Pipedrive-sync.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-contact-fn">Voornaam *</Label>
                <Input
                  id="edit-contact-fn"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="edit-contact-ln">Achternaam</Label>
                <Input
                  id="edit-contact-ln"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-contact-title">Functie</Label>
              <Input
                id="edit-contact-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="edit-contact-email">E-mail</Label>
              <Input
                id="edit-contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-contact-mobile">Telefoon mobiel</Label>
                <Input
                  id="edit-contact-mobile"
                  value={phoneMobile}
                  onChange={(e) => setPhoneMobile(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-contact-other">Telefoon vast</Label>
                <Input
                  id="edit-contact-other"
                  value={phoneOther}
                  onChange={(e) => setPhoneOther(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuleren
            </Button>
            <Button type="submit" disabled={saving || !firstName.trim()}>
              {saving ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : null}
              Opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Split bestaande `name` in voor/achternaam wanneer first_name/last_name
 * nog niet expliciet zijn gezet. Voor "Afdeling Personeelszaken"-fallback
 * is first_name al gezet door de orchestrator, dus die wint.
 */
function splitName(c: NormalizedContact): { fn: string; ln: string } {
  if (c.first_name !== undefined || c.last_name !== undefined) {
    return { fn: c.first_name ?? '', ln: c.last_name ?? '' }
  }
  const parts = c.name.trim().split(/\s+/)
  if (parts.length === 0) return { fn: '', ln: '' }
  if (parts.length === 1) return { fn: parts[0], ln: '' }
  return { fn: parts[0], ln: parts.slice(1).join(' ') }
}

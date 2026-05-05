'use client'

import { useState } from 'react'
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
import type { NormalizedContact } from '@/lib/services/sales-leads/types'

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  onAdd: (c: NormalizedContact) => void
}

export function LeadAddContactModal({ open, onOpenChange, onAdd }: Props) {
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [linkedin, setLinkedin] = useState('')

  function reset() {
    setName('')
    setTitle('')
    setEmail('')
    setPhone('')
    setLinkedin('')
  }

  function submit() {
    if (!name.trim()) return
    onAdd({
      name: name.trim(),
      title: title.trim() || undefined,
      email: email.trim() || undefined,
      phone_mobile: phone.trim() || undefined,
      linkedin_url: linkedin.trim() || undefined,
      source_origin: ['manual'],
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Handmatig contact toevoegen</DialogTitle>
          <DialogDescription>Gebruik dit voor contacten die niet uit Apollo of website komen.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); submit() }}>
          <div className="space-y-3">
            <div>
              <Label htmlFor="lead-contact-name">Naam *</Label>
              <Input
                id="lead-contact-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lead-contact-title">Functie</Label>
              <Input
                id="lead-contact-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lead-contact-email">E-mail</Label>
              <Input
                id="lead-contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lead-contact-phone">Telefoon</Label>
              <Input
                id="lead-contact-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lead-contact-linkedin">LinkedIn URL</Label>
              <Input
                id="lead-contact-linkedin"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Toevoegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

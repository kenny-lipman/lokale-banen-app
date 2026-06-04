'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { VacatureForm, type VacatureFormInitial } from '@/components/vacatures/vacature-form'
import type { VacaturePayload } from '@/lib/services/sales-leads/manual-vacancy'

type LeadCompanyContext = {
  companyName?: string | null
  domain?: string | null
  kvk?: string | null
  city?: string | null
}

type CompanyOption = { value: string; label: string }

type Props = {
  open: boolean
  onOpenChange: (o: boolean) => void
  lead: LeadCompanyContext
  // Geeft de aangemaakte vacature-payload terug zodat de pagina hem aan de
  // lead-pool toevoegt en selecteert.
  onCreated: (payload: VacaturePayload) => void
}

export function LeadAddVacancyModal({ open, onOpenChange, lead, onCreated }: Props) {
  const [saving, setSaving] = useState(false)
  const [matchedCompany, setMatchedCompany] = useState<CompanyOption | null>(null)
  const [initial, setInitial] = useState<VacatureFormInitial>({})
  const [ready, setReady] = useState(false)

  // Bij openen: probeer het bedrijf te matchen. Match -> combobox voorgevuld.
  // Geen match -> nieuw-bedrijf voorgevuld met lead-data.
  useEffect(() => {
    if (!open) return
    setReady(false)
    setMatchedCompany(null)
    const params = new URLSearchParams()
    if (lead.kvk) params.set('kvk', lead.kvk)
    if (lead.domain) params.set('domain', lead.domain)
    if (lead.companyName) params.set('name', lead.companyName)

    fetch(`/api/companies/match?${params}`)
      .then((r) => r.json())
      .then((j: { match: { id: string; name: string } | null }) => {
        if (j.match) {
          setMatchedCompany({ value: j.match.id, label: j.match.name })
          setInitial({ companyId: j.match.id, city: lead.city ?? undefined })
        } else {
          setInitial({
            newCompanyName: lead.companyName ?? undefined,
            newCompanyWebsite: lead.domain ?? undefined,
            newCompanyCity: lead.city ?? undefined,
            city: lead.city ?? undefined,
          })
        }
      })
      .catch(() => {
        setInitial({
          newCompanyName: lead.companyName ?? undefined,
          newCompanyWebsite: lead.domain ?? undefined,
          newCompanyCity: lead.city ?? undefined,
          city: lead.city ?? undefined,
        })
      })
      .finally(() => setReady(true))
  }, [open, lead.kvk, lead.domain, lead.companyName, lead.city])

  async function handleSubmit(payload: VacaturePayload) {
    if (!payload.title) {
      toast.error('Titel is verplicht')
      return
    }
    if (!payload.company_id && !payload.new_company_name) {
      toast.error('Selecteer een bedrijf of maak een nieuw bedrijf aan')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/vacatures', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || 'Fout bij aanmaken vacature')
        return
      }
      toast.success('Vacature aangemaakt')
      onCreated(payload)
      onOpenChange(false)
    } catch {
      toast.error('Fout bij aanmaken vacature')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vacature toevoegen</DialogTitle>
          <DialogDescription>
            Maakt een echte vacature aan (review-status: in afwachting) en koppelt hem aan deze lead.
          </DialogDescription>
        </DialogHeader>
        {ready && (
          <VacatureForm
            key={open ? 'open' : 'closed'}
            initialValues={initial}
            initialCompanyOption={matchedCompany}
            defaultNewCompanyOpen={!matchedCompany}
            submitting={saving}
            submitLabel="Vacature toevoegen"
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

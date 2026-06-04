'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Briefcase } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { VacatureForm } from '@/components/vacatures/vacature-form'
import type { VacaturePayload } from '@/lib/services/sales-leads/manual-vacancy'

export default function NieuweVacaturePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

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
      router.push('/job-postings')
    } catch {
      toast.error('Fout bij aanmaken vacature')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/job-postings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Terug
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="size-8" />
            Nieuwe vacature
          </h1>
          <p className="text-muted-foreground mt-1">Maak een nieuwe vacature aan</p>
        </div>
      </div>
      <VacatureForm
        submitting={saving}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/job-postings')}
      />
    </div>
  )
}

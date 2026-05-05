'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { X } from 'lucide-react'
import { stap1FormSchema, type Stap1FormValues } from '@/lib/sales-leads/api-schemas'
import { useToast } from '@/hooks/use-toast'

type OwnerOption = {
  id: string
  label: string
  is_active: boolean
}

export function LeadFormStap1() {
  const router = useRouter()
  const { toast } = useToast()
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [loadingOwners, setLoadingOwners] = useState(true)
  const [vacancyTitle, setVacancyTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<Stap1FormValues>({
    resolver: zodResolver(stap1FormSchema),
    defaultValues: {
      input_url: '',
      owner_config_id: '',
      scrape_vacancies: true,
      manual_vacancies: [],
    },
  })

  useEffect(() => {
    fetch('/api/sales-leads/owner-config')
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ configs?: OwnerOption[] }>
      })
      .then((j) => {
        setOwners((j.configs ?? []).filter((c) => c.is_active))
      })
      .catch((e) => {
        toast({
          title: 'Kon dealeigenaren niet laden',
          description: (e as Error).message,
          variant: 'destructive',
        })
      })
      .finally(() => setLoadingOwners(false))
  }, [toast])

  function addVacancy() {
    const t = vacancyTitle.trim()
    if (!t) return
    const current = form.getValues('manual_vacancies')
    form.setValue('manual_vacancies', [...current, { title: t }], { shouldDirty: true })
    setVacancyTitle('')
  }

  function removeVacancy(idx: number) {
    const current = form.getValues('manual_vacancies')
    form.setValue(
      'manual_vacancies',
      current.filter((_, i) => i !== idx),
      { shouldDirty: true },
    )
  }

  async function onSubmit(values: Stap1FormValues) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/sales-leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const body = (await res.json()) as { run_id?: string; error?: string; recent_run_id?: string }
      if (res.status === 409 && body.recent_run_id) {
        toast({
          title: 'Recent voltooide run gevonden',
          description:
            'We sturen je naar de bestaande run. Wacht 24u of overleg met admin om dit domein opnieuw te verrijken.',
          variant: 'default',
        })
        router.push(`/sales/lead-verrijking/${body.recent_run_id}`)
        return
      }
      if (!res.ok || !body.run_id) {
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      router.push(`/sales/lead-verrijking/${body.run_id}`)
    } catch (e) {
      toast({
        title: 'Aanmaken mislukt',
        description: (e as Error).message,
        variant: 'destructive',
      })
      setSubmitting(false)
    }
  }

  const vacancies = form.watch('manual_vacancies')

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Nieuwe lead</CardTitle>
        <CardDescription>
          Voer een bedrijfsdomein in. We verrijken via KvK · Google Maps · Apollo · Website-scrape.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="input_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website URL</FormLabel>
                  <FormControl>
                    <Input placeholder="bv. wetarget.nl of https://wetarget.nl" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="owner_config_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dealeigenaar</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={loadingOwners}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingOwners ? 'Laden…' : 'Kies een dealeigenaar'} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scrape_vacancies"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel className="text-sm">Auto-detect vacatures via /werkenbij</FormLabel>
                    <p className="text-xs text-gray-500">Wanneer aan, scrapt de career-page-discovery vacatures.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Vacatures (optioneel — handmatige toevoegingen)</FormLabel>
              <div className="flex gap-2">
                <Input
                  value={vacancyTitle}
                  placeholder="bv. Senior Recruiter"
                  onChange={(e) => setVacancyTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addVacancy()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addVacancy}>
                  Toevoegen
                </Button>
              </div>
              {vacancies.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {vacancies.map((v, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1">
                      {v.title}
                      <button
                        type="button"
                        onClick={() => removeVacancy(idx)}
                        className="ml-1 rounded hover:bg-gray-200"
                        aria-label={`Verwijder ${v.title}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => router.push('/sales/lead-verrijking')}>
                Annuleren
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Aanmaken…' : 'Verrijken'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

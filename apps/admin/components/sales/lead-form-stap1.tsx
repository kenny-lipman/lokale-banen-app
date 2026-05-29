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
import { X, AlertTriangle } from 'lucide-react'
import { stap1FormSchema, type Stap1FormValues, MAX_URLS_PER_BATCH } from '@/lib/sales-leads/api-schemas'
import { ContactmomentPickerControl } from '@/components/sales/lead-contactmoment-picker'
import { toast } from 'sonner'

type OwnerOption = {
  id: string
  label: string
  is_active: boolean
  contactmoment_offset_workdays?: number
}

type BulkResponse = {
  run_ids?: string[]
  skipped?: Array<{ input: string; reason: string; message: string; recent_run_id?: string }>
  requested?: number
  error?: string
}

export function LeadFormStap1() {
  const router = useRouter()
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [loadingOwners, setLoadingOwners] = useState(true)
  const [urlInput, setUrlInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<Stap1FormValues>({
    resolver: zodResolver(stap1FormSchema),
    defaultValues: {
      input_urls: [],
      owner_config_id: '',
      scrape_vacancies: true,
      manual_vacancies: [],
      contactmoment_override: null,
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
        toast.error('Kon dealeigenaren niet laden', { description: (e as Error).message })
      })
      .finally(() => setLoadingOwners(false))
  }, [])

  function addUrls(input: string) {
    if (!input.trim()) return
    // Splits op newline, komma of spatie zodat plakken van een lijst werkt.
    const parts = input
      .split(/[\s,;\n]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
    const current = form.getValues('input_urls')
    const dedup = new Set([...current, ...parts])
    const next = Array.from(dedup).slice(0, MAX_URLS_PER_BATCH)
    form.setValue('input_urls', next, { shouldDirty: true, shouldValidate: true })
    setUrlInput('')
    if (Array.from(dedup).length > MAX_URLS_PER_BATCH) {
      toast.error('Limiet bereikt', {
        description: `Maximum ${MAX_URLS_PER_BATCH} URLs per batch. Extra URLs zijn genegeerd.`,
      })
    }
  }

  function removeUrl(idx: number) {
    const current = form.getValues('input_urls')
    form.setValue(
      'input_urls',
      current.filter((_, i) => i !== idx),
      { shouldDirty: true, shouldValidate: true },
    )
  }

  async function onSubmit(values: Stap1FormValues) {
    setSubmitting(true)
    try {
      const res = await fetch('/api/sales-leads/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_urls: values.input_urls,
          owner_config_id: values.owner_config_id,
          scrape_vacancies: values.scrape_vacancies,
          contactmoment_override: values.contactmoment_override ?? null,
        }),
      })
      const body = (await res.json()) as BulkResponse
      if (!res.ok || !body.run_ids) {
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const createdCount = body.run_ids.length
      const skippedCount = body.skipped?.length ?? 0
      const totalCount = body.requested ?? values.input_urls.length

      if (createdCount === 0) {
        toast.error('Geen runs aangemaakt', {
          description: skippedCount > 0
            ? `Alle ${totalCount} URLs werden overgeslagen: ${body.skipped?.[0]?.message ?? ''}`
            : 'Onbekende fout',
        })
        setSubmitting(false)
        return
      }
      // Toast toont eerste 3 skipped URLs met reason, rest naar console.
      // Voorkomt dat sales-team "X overgeslagen" ziet zonder te weten welke.
      let description = 'Verrijking draait op de achtergrond. Refresh de lijst voor live status.'
      if (skippedCount > 0) {
        const preview = (body.skipped ?? []).slice(0, 3)
          .map((s) => `${s.input}: ${s.message}`)
          .join('\n')
        const more = skippedCount > 3 ? `\n+ ${skippedCount - 3} meer (zie console)` : ''
        description = `${createdCount} van ${totalCount} aangemaakt. Overgeslagen:\n${preview}${more}`
        console.warn('[sales-leads/create] skipped:', body.skipped)
      }
      toast.success(`${createdCount} run${createdCount === 1 ? '' : 's'} aangemaakt`, {
        description,
      })
      router.push('/sales/lead-verrijking')
    } catch (e) {
      toast.error('Aanmaken mislukt', { description: (e as Error).message })
      setSubmitting(false)
    }
  }

  const urls = form.watch('input_urls')

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Nieuwe leads</CardTitle>
        <CardDescription>
          Voer één of meerdere bedrijfsdomeinen in (max {MAX_URLS_PER_BATCH}). We verrijken parallel via KvK · Google Maps · Apollo · Website-scrape.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="input_urls"
              render={() => (
                <FormItem>
                  <FormLabel>Website URLs</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        value={urlInput}
                        placeholder="bv. wetarget.nl (Enter, komma of plak een lijst)"
                        onChange={(e) => setUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addUrls(urlInput)
                          }
                        }}
                        onPaste={(e) => {
                          // Bij plakken van multi-line lijst: direct splitsen.
                          const pasted = e.clipboardData.getData('text')
                          if (/[\s,;\n]/.test(pasted)) {
                            e.preventDefault()
                            addUrls(urlInput + pasted)
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={() => addUrls(urlInput)}>
                        Toevoegen
                      </Button>
                    </div>
                  </FormControl>
                  {urls.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {urls.map((u, idx) => (
                        <Badge key={u + idx} variant="secondary" className="gap-1">
                          {u}
                          <button
                            type="button"
                            onClick={() => removeUrl(idx)}
                            className="ml-1 rounded hover:bg-gray-200"
                            aria-label={`Verwijder ${u}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500">
                    {urls.length}/{MAX_URLS_PER_BATCH} URLs · alle gebruiken dezelfde dealeigenaar
                  </p>
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
              name="contactmoment_override"
              render={({ field }) => {
                const selectedOwner = owners.find((o) => o.id === form.watch('owner_config_id'))
                const offset = selectedOwner?.contactmoment_offset_workdays ?? 1
                return (
                  <FormItem>
                    <FormLabel>Contactmoment (optioneel)</FormLabel>
                    <FormControl>
                      <ContactmomentPickerControl
                        value={field.value ?? null}
                        offsetWorkdays={offset}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <p className="text-[11px] text-gray-500">
                      Laat leeg voor de standaard werkdag van de gekozen dealeigenaar
                      ({offset} werkdag{offset === 1 ? '' : 'en'}).
                      {urls.length > 1 && ' Override geldt voor alle URLs in deze batch.'}
                    </p>
                    <FormMessage />
                  </FormItem>
                )
              }}
            />

            <FormField
              control={form.control}
              name="scrape_vacancies"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <FormLabel className="text-sm">Auto-detect vacatures via /werkenbij</FormLabel>
                    <p className="text-xs text-gray-500">Wanneer aan, scrapt de career-page-discovery vacatures voor elke URL.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {urls.length > 5 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Grote batches kunnen Apollo/Mistral rate-limits raken; bij overflow wordt de run gemarkeerd als
                  &lsquo;failed&rsquo; en is een replay vanuit de detailpagina mogelijk.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => router.push('/sales/lead-verrijking')}>
                Annuleren
              </Button>
              <Button type="submit" disabled={submitting || urls.length === 0}>
                {submitting
                  ? 'Aanmaken…'
                  : urls.length === 1
                    ? 'Verrijken'
                    : `Verrijken (${urls.length})`}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DescriptionEditor } from "@/components/vacature/description-editor"
import { htmlToMarkdown } from "@/lib/services/html-to-markdown"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Combobox } from "@/components/ui/combobox"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Trash2, Briefcase, ImageIcon, Sparkles } from "lucide-react"
import Link from "next/link"
import { HeaderImageField } from "@/components/vacature/header-image-field"

const PROVINCES = [
  "Noord-Holland",
  "Zuid-Holland",
  "Utrecht",
  "Noord-Brabant",
  "Gelderland",
  "Overijssel",
  "Limburg",
  "Flevoland",
  "Groningen",
  "Friesland",
  "Drenthe",
  "Zeeland",
]

const EMPLOYMENT_TYPES = [
  { value: "Vast", label: "Vast" },
  { value: "Tijdelijk", label: "Tijdelijk" },
  { value: "Parttime", label: "Parttime" },
  { value: "Stage", label: "Stage" },
  { value: "Bijbaan", label: "Bijbaan" },
  { value: "Freelance", label: "Freelance" },
  { value: "Vrijwilliger", label: "Vrijwilliger" },
]

const EDUCATION_LEVELS = [
  { value: "VMBO/MAVO", label: "VMBO/MAVO" },
  { value: "HAVO", label: "HAVO" },
  { value: "VWO", label: "VWO" },
  { value: "MBO", label: "MBO" },
  { value: "HBO", label: "HBO" },
  { value: "WO", label: "WO" },
]

const REVIEW_STATUSES = [
  { value: "pending", label: "In afwachting" },
  { value: "approved", label: "Goedgekeurd" },
  { value: "rejected", label: "Afgekeurd" },
]

interface CompanyOption {
  value: string
  label: string
}

interface Platform {
  id: string
  regio_platform: string
}

export default function BewerkVacaturePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])

  // Form state
  const [title, setTitle] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [city, setCity] = useState("")
  const [zipcode, setZipcode] = useState("")
  const [street, setStreet] = useState("")
  const [state, setState] = useState("")
  const [description, setDescription] = useState("")
  const [salary, setSalary] = useState("")
  const [employment, setEmployment] = useState("")
  const [workingHoursMin, setWorkingHoursMin] = useState("")
  const [workingHoursMax, setWorkingHoursMax] = useState("")
  const [educationLevel, setEducationLevel] = useState("")
  const [categories, setCategories] = useState("")
  const [url, setUrl] = useState("")
  const [endDate, setEndDate] = useState("")
  const [platformId, setPlatformId] = useState("")
  const [reviewStatus, setReviewStatus] = useState("pending")
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null)
  const [contentMd, setContentMd] = useState("")
  const [contentEnrichedAt, setContentEnrichedAt] = useState<string | null>(null)
  const [aiRewriting, setAiRewriting] = useState(false)

  // Load companies for combobox
  const searchCompanies = useCallback(async (search: string) => {
    try {
      const params = new URLSearchParams({ search, limit: '50' })
      const res = await authFetch(`/api/companies/search?${params}`)
      const result = await res.json()
      if (result.success && result.companies) {
        setCompanies((prev) => {
          const searched = result.companies.map((c: { id: string; name: string }) => ({
            value: c.id,
            label: c.name,
          }))
          // Preserve the currently selected company in options if not in search results
          // (otherwise Combobox can't render its label)
          const current = prev.find((c) => c.value === companyId)
          if (current && !searched.find((c: CompanyOption) => c.value === current.value)) {
            return [current, ...searched]
          }
          return searched
        })
      }
    } catch {
      // Silently fail
    }
  }, [companyId])

  // Load initial companies
  useEffect(() => {
    searchCompanies("")
  }, [searchCompanies])


  // Load platforms via authenticated API
  useEffect(() => {
    async function fetchPlatforms() {
      try {
        const res = await authFetch("/api/review/platforms")
        const { data } = await res.json()
        if (data) {
          setPlatforms(data.map((p: { id: string; regio_platform: string }) => ({
            id: p.id,
            regio_platform: p.regio_platform,
          })))
        }
      } catch {
        // Silently fail
      }
    }
    fetchPlatforms()
  }, [])

  // Load vacancy data
  useEffect(() => {
    async function fetchVacature() {
      if (!id) return
      setLoading(true)
      try {
        const res = await authFetch(`/api/vacatures/${id}`)
        const result = await res.json()

        if (!result.success || !result.data) {
          toast.error("Vacature niet gevonden")
          router.push("/job-postings")
          return
        }

        const data = result.data
        setTitle(data.title || "")
        setCompanyId(data.company_id || "")
        // Seed company option with the one attached to this vacancy, so the
        // Combobox can render its label immediately (avoids empty selection
        // when the current company is outside the top-50 search results).
        if (data.company_id && (data.company_name || data.companies?.name)) {
          const label = data.company_name || data.companies?.name
          setCompanies((prev) => {
            if (prev.find((c) => c.value === data.company_id)) return prev
            return [{ value: data.company_id, label }, ...prev]
          })
        }
        setCity(data.city || "")
        setZipcode(data.zipcode || "")
        setStreet(data.street || "")
        // Use state field directly, fallback to extracting from location
        if (data.state) {
          setState(data.state)
        } else if (data.location) {
          const parts = data.location.split(", ")
          if (parts.length > 1 && PROVINCES.includes(parts[parts.length - 1])) {
            setState(parts[parts.length - 1])
          }
        }
        // Legacy scraped descriptions zijn vaak HTML. Lazy converteren zodat
        // het markdown-veld geen tags toont en een save markdown terugschrijft.
        setDescription(htmlToMarkdown(data.description))
        setSalary(data.salary || "")
        setEmployment(data.employment || "")
        setWorkingHoursMin(data.working_hours_min?.toString() || "")
        setWorkingHoursMax(data.working_hours_max?.toString() || "")
        setEducationLevel(data.education_level || "")
        setCategories(data.categories || "")
        setUrl(data.url || "")
        setEndDate(data.end_date ? data.end_date.split("T")[0] : "")
        setPlatformId(data.platform_id || "")
        setReviewStatus(data.review_status || "pending")
        setHeaderImageUrl(data.header_image_url ?? null)
        setContentMd(data.content_md || "")
        setContentEnrichedAt(data.content_enriched_at || null)
      } catch {
        toast.error("Fout bij laden vacature")
      } finally {
        setLoading(false)
      }
    }
    fetchVacature()
  }, [id, router])

  const handleAIRewrite = async () => {
    if (aiRewriting) return
    if (!description.trim()) {
      toast.error("Ruwe vacaturetekst is leeg — niks om te herschrijven")
      return
    }
    setAiRewriting(true)
    try {
      const res = await authFetch(`/api/vacatures/${id}/ai-rewrite`, {
        method: "POST",
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        toast.error(result.error || "AI herschrijving mislukt")
        return
      }
      setContentMd(result.data.content_md)
      // Prefill missing metadata from AI extraction
      const ex = result.data.extracted
      if (ex.employment && !employment) setEmployment(ex.employment)
      if (ex.education_level && !educationLevel) setEducationLevel(ex.education_level)
      if (ex.categories && !categories) setCategories(ex.categories)
      if (ex.salary && !salary) setSalary(ex.salary)
      if (ex.working_hours_min != null && !workingHoursMin)
        setWorkingHoursMin(String(ex.working_hours_min))
      if (ex.working_hours_max != null && !workingHoursMax)
        setWorkingHoursMax(String(ex.working_hours_max))
      toast.success("AI herschrijving gegenereerd — controleer en sla op")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI herschrijving mislukt")
    } finally {
      setAiRewriting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Titel is verplicht")
      return
    }

    setSaving(true)
    try {
      const res = await authFetch(`/api/vacatures/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          company_id: companyId || undefined,
          city: city.trim() || undefined,
          zipcode: zipcode.trim() || undefined,
          street: street.trim() || undefined,
          state: state || undefined,
          description: description.trim() || undefined,
          salary: salary.trim() || undefined,
          employment: employment || undefined,
          working_hours_min: workingHoursMin || undefined,
          working_hours_max: workingHoursMax || undefined,
          education_level: educationLevel || undefined,
          categories: categories.trim() || undefined,
          url: url.trim() || undefined,
          end_date: endDate || undefined,
          platform_id: platformId || undefined,
          review_status: reviewStatus,
          header_image_url: headerImageUrl,
          content_md: contentMd.trim() || null,
        }),
      })

      const result = await res.json()

      if (!result.success) {
        toast.error(result.error || "Fout bij bijwerken vacature")
        return
      }

      toast.success("Vacature bijgewerkt")
      router.push("/job-postings")
    } catch {
      toast.error("Fout bij bijwerken vacature")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await authFetch(`/api/vacatures/${id}`, {
        method: "DELETE",
      })
      const result = await res.json()

      if (!result.success) {
        toast.error(result.error || "Fout bij archiveren vacature")
        return
      }

      toast.success("Vacature gearchiveerd")
      router.push("/job-postings")
    } catch {
      toast.error("Fout bij archiveren vacature")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-4xl flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Vacature laden...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/job-postings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-8 w-8" />
            Vacature bewerken
          </h1>
          <p className="text-muted-foreground mt-1">
            Bewerk de gegevens van deze vacature
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header image */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Header afbeelding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <HeaderImageField
              vacatureId={id}
              currentUrl={headerImageUrl}
              onUpload={(url) => setHeaderImageUrl(url)}
              onRemove={() => setHeaderImageUrl(null)}
            />
          </CardContent>
        </Card>

        {/* Basic info */}
        <Card>
          <CardHeader>
            <CardTitle>Basisgegevens</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="bijv. Senior Software Engineer"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Bedrijf *</Label>
              <Combobox
                options={companies}
                value={companyId}
                onValueChange={setCompanyId}
                placeholder="Zoek een bedrijf..."
                searchPlaceholder="Typ om te zoeken..."
                emptyText="Geen bedrijven gevonden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="review-status">Review status</Label>
                <Select value={reviewStatus} onValueChange={setReviewStatus}>
                  <SelectTrigger id="review-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REVIEW_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={platformId || "auto"} onValueChange={(val) => setPlatformId(val === "auto" ? "" : val)}>
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="Automatisch via postcode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatisch via postcode</SelectItem>
                    {platforms.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.regio_platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle>Locatie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Stad</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Amsterdam"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipcode">Postcode</Label>
                <Input
                  id="zipcode"
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value)}
                  placeholder="1012 AB"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="street">Straat (optioneel)</Label>
                <Input
                  id="street"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Keizersgracht 1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">Provincie</Label>
                <Select value={state || "none"} onValueChange={(val) => setState(val === "none" ? "" : val)}>
                  <SelectTrigger id="state">
                    <SelectValue placeholder="Selecteer provincie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen provincie</SelectItem>
                    {PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Herschrijving — publicatie-tekst (content_md) */}
        <Card className="border-purple-200 bg-purple-50/20">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI Herschrijving (publicatietekst)
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Deze tekst wordt getoond op de publieke site. Laat AI de ruwe bron
                  herschrijven naar een gestructureerd markdown format met 3 secties.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleAIRewrite}
                disabled={aiRewriting || !description.trim()}
                className="border-purple-300 text-purple-700 hover:bg-purple-100"
              >
                {aiRewriting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                {aiRewriting
                  ? "Herschrijven..."
                  : contentMd
                    ? "Opnieuw herschrijven"
                    : "AI Herschrijf"}
              </Button>
            </div>
            {contentEnrichedAt && (
              <p className="text-xs text-purple-700 mt-1">
                Laatst herschreven op{" "}
                {new Date(contentEnrichedAt).toLocaleString("nl-NL", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="content_md" className="sr-only">
              Publicatietekst (markdown)
            </Label>
            <textarea
              id="content_md"
              value={contentMd}
              onChange={(e) => setContentMd(e.target.value)}
              placeholder={
                "## Wat ga je doen?\n- ...\n\n## Wie zoeken we?\n- ...\n\n## Wat bieden we?\n- ..."
              }
              rows={18}
              className="w-full rounded-md border border-purple-200 bg-white px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-300 focus:border-purple-400"
            />
            <p className="text-xs text-muted-foreground">
              Markdown-formaat. Gebruik{" "}
              <code className="bg-muted px-1 rounded">## Wat ga je doen?</code>,{" "}
              <code className="bg-muted px-1 rounded">## Wie zoeken we?</code>,{" "}
              <code className="bg-muted px-1 rounded">## Wat bieden we?</code> voor
              secties.
            </p>
          </CardContent>
        </Card>

        {/* Ruwe beschrijving (bron) */}
        <Card>
          <CardHeader>
            <CardTitle>Ruwe vacaturetekst (bron)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Gescrapete tekst van de originele bron. Niet zichtbaar op de publieke
              site — dient als referentie voor de AI herschrijving en handmatige
              controle.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Bron-tekst</Label>
              <DescriptionEditor
                value={description}
                onChange={setDescription}
                minHeight={300}
              />
            </div>
          </CardContent>
        </Card>

        {/* Details */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salary">Salaris</Label>
                <Input
                  id="salary"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  placeholder="bijv. 2800 - 3500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employment">Dienstverband</Label>
                <Select value={employment || "none"} onValueChange={(val) => setEmployment(val === "none" ? "" : val)}>
                  <SelectTrigger id="employment">
                    <SelectValue placeholder="Selecteer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen type</SelectItem>
                    {EMPLOYMENT_TYPES.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Uren per week</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={workingHoursMin}
                    onChange={(e) => setWorkingHoursMin(e.target.value)}
                    placeholder="Min"
                    min={0}
                    max={60}
                  />
                  <span className="text-muted-foreground">-</span>
                  <Input
                    type="number"
                    value={workingHoursMax}
                    onChange={(e) => setWorkingHoursMax(e.target.value)}
                    placeholder="Max"
                    min={0}
                    max={60}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="education">Opleidingsniveau</Label>
                <Select value={educationLevel || "none"} onValueChange={(val) => setEducationLevel(val === "none" ? "" : val)}>
                  <SelectTrigger id="education">
                    <SelectValue placeholder="Selecteer niveau" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Geen niveau</SelectItem>
                    {EDUCATION_LEVELS.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categories">Categorie / Branche</Label>
                <Input
                  id="categories"
                  value={categories}
                  onChange={(e) => setCategories(e.target.value)}
                  placeholder="bijv. IT, Zorg, Techniek"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">Einddatum</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Externe URL (optioneel)</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://werkgever.nl/vacature"
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" type="button" disabled={deleting}>
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Verwijderen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Vacature archiveren?</AlertDialogTitle>
                <AlertDialogDescription>
                  Deze vacature wordt gearchiveerd en is niet meer zichtbaar op de publieke sites.
                  Dit kan niet ongedaan worden gemaakt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuleren</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Archiveren
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex items-center gap-4">
            <Link href="/job-postings">
              <Button variant="outline" type="button">
                Annuleren
              </Button>
            </Link>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Opslaan
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

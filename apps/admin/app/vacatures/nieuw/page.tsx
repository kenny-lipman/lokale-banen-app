"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Combobox } from "@/components/ui/combobox"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Plus, Briefcase } from "lucide-react"
import Link from "next/link"

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

export default function NieuweVacaturePage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [companySearch, setCompanySearch] = useState("")

  // Form state
  const [title, setTitle] = useState("")
  const [companyId, setCompanyId] = useState("")
  const [newCompanyName, setNewCompanyName] = useState("")
  const [newCompanyWebsite, setNewCompanyWebsite] = useState("")
  const [newCompanyCity, setNewCompanyCity] = useState("")
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

  // Load companies for combobox
  const searchCompanies = useCallback(async (search: string) => {
    try {
      const params = new URLSearchParams({ search, limit: '50' })
      const res = await authFetch(`/api/companies/search?${params}`)
      const result = await res.json()
      if (result.success && result.companies) {
        setCompanies(
          result.companies.map((c: { id: string; name: string }) => ({
            value: c.id,
            label: c.name,
          }))
        )
      }
    } catch {
      // Silently fail
    }
  }, [])

  // Debounced company search
  useEffect(() => {
    const timer = setTimeout(() => {
      searchCompanies(companySearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [companySearch, searchCompanies])

  // Load initial companies
  useEffect(() => {
    searchCompanies("")
  }, [searchCompanies])

  // Load platforms
  useEffect(() => {
    async function fetchPlatforms() {
      try {
        const { createClient } = await import("@/lib/supabase")
        const supabase = createClient()
        const { data } = await supabase
          .from("platforms")
          .select("id, regio_platform")
          .order("regio_platform")
        if (data) setPlatforms(data)
      } catch {
        // Silently fail
      }
    }
    fetchPlatforms()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Titel is verplicht")
      return
    }

    if (!companyId && !newCompanyName.trim()) {
      toast.error("Selecteer een bedrijf of maak een nieuw bedrijf aan")
      return
    }

    setSaving(true)
    try {
      const res = await authFetch("/api/vacatures", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          company_id: companyId || undefined,
          new_company_name: !companyId ? newCompanyName.trim() : undefined,
          new_company_website: !companyId ? newCompanyWebsite.trim() : undefined,
          new_company_city: !companyId ? newCompanyCity.trim() : undefined,
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
        }),
      })

      const result = await res.json()

      if (!result.success) {
        toast.error(result.error || "Fout bij aanmaken vacature")
        return
      }

      toast.success("Vacature aangemaakt")
      router.push("/job-postings")
    } catch {
      toast.error("Fout bij aanmaken vacature")
    } finally {
      setSaving(false)
    }
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
            Nieuwe vacature
          </h1>
          <p className="text-muted-foreground mt-1">
            Maak een nieuwe vacature aan
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                onValueChange={(val) => {
                  setCompanyId(val)
                  if (val) {
                    setNewCompanyName("")
                    setNewCompanyWebsite("")
                    setNewCompanyCity("")
                  }
                }}
                placeholder="Zoek een bedrijf..."
                searchPlaceholder="Typ om te zoeken..."
                emptyText="Geen bedrijven gevonden"
              />
            </div>

            <Accordion type="single" collapsible>
              <AccordionItem value="new-company" className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm">
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Of: nieuw bedrijf aanmaken
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-company-name">Bedrijfsnaam</Label>
                    <Input
                      id="new-company-name"
                      value={newCompanyName}
                      onChange={(e) => {
                        setNewCompanyName(e.target.value)
                        if (e.target.value) setCompanyId("")
                      }}
                      placeholder="Naam van het bedrijf"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-company-website">Website</Label>
                    <Input
                      id="new-company-website"
                      type="url"
                      value={newCompanyWebsite}
                      onChange={(e) => setNewCompanyWebsite(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-company-city">Stad</Label>
                    <Input
                      id="new-company-city"
                      value={newCompanyCity}
                      onChange={(e) => setNewCompanyCity(e.target.value)}
                      placeholder="Amsterdam"
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

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

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Beschrijving</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Vacature beschrijving</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Beschrijf de vacature..."
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Markdown wordt ondersteund</p>
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
        <div className="flex items-center justify-end gap-4">
          <Link href="/job-postings">
            <Button variant="outline" type="button">
              Annuleren
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Vacature aanmaken
          </Button>
        </div>
      </form>
    </div>
  )
}

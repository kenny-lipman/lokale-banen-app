"use client"

import { useReducer, useState } from "react"
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
import { toast } from "sonner"
import { ArrowLeft, Loader2, Trash2, Building2, Globe, Sparkles, Download } from "lucide-react"
import Link from "next/link"
import { ImageUpload } from "@/components/ui/image-upload"
import type { CompanyEditData } from "@/lib/companies/get-company-for-edit"

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

const composeSource = (data: {
  websiteText: string | null
  vacancyTitles?: string[]
}): string => {
  const parts: string[] = []
  if (data.websiteText) parts.push(data.websiteText)
  if (data.vacancyTitles && data.vacancyTitles.length > 0) {
    parts.push("Vacatures bij dit bedrijf:\n" + data.vacancyTitles.map((t) => `- ${t}`).join("\n"))
  }
  return parts.join("\n\n")
}

interface FormState {
  name: string
  website: string
  description: string
  logoUrl: string
  linkedinUrl: string
  kvkNumber: string
  street: string
  city: string
  zipcode: string
  state: string
  country: string
  phone: string
  industry: string
  sizeMin: string
  sizeMax: string
  sourceText: string
  sourceUrl: string
  sourceNote: string
}

type FormAction = {
  type: "set"
  field: keyof FormState
  value: string
}

function formReducer(state: FormState, action: FormAction): FormState {
  return { ...state, [action.field]: action.value }
}

function initForm(initialData: CompanyEditData): FormState {
  return {
    name: initialData.name ?? "",
    website: initialData.website ?? "",
    description: initialData.description ?? "",
    logoUrl: initialData.logo_url ?? "",
    linkedinUrl: initialData.linkedin_url ?? "",
    kvkNumber: initialData.kvk_number ?? "",
    street: initialData.street ?? "",
    city: initialData.city ?? "",
    zipcode: initialData.zipcode ?? "",
    state: initialData.state ?? "",
    country: initialData.country ?? "NL",
    phone: initialData.phone ?? "",
    industry: initialData.industry ?? "",
    sizeMin: initialData.size_min?.toString() ?? "",
    sizeMax: initialData.size_max?.toString() ?? "",
    sourceText: "",
    sourceUrl: "",
    sourceNote: "",
  }
}

export function BewerkBedrijfForm({ id, initialData }: { id: string; initialData: CompanyEditData }) {
  const router = useRouter()

  const [form, dispatch] = useReducer(formReducer, initialData, initForm)
  const [pending, setPending] = useState({
    saving: false,
    deleting: false,
    logoFetching: false,
    sourceLoading: false,
    rewriting: false,
  })

  const handleFetchLogo = async () => {
    setPending((p) => ({ ...p, logoFetching: true }))
    try {
      const res = await fetch(`/api/bedrijven/${id}/logo-suggest`, { method: "POST" })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || "Logo ophalen mislukt")
        return
      }
      dispatch({ type: "set", field: "logoUrl", value: result.data.logoUrl })
      toast.success("Logo opgehaald, controleer en sla op")
    } catch {
      toast.error("Logo ophalen mislukt")
    } finally {
      setPending((p) => ({ ...p, logoFetching: false }))
    }
  }

  const handleFetchSource = async () => {
    setPending((p) => ({ ...p, sourceLoading: true }))
    try {
      const res = await fetch(`/api/bedrijven/${id}/ai-source`, { method: "POST" })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || "Bron ophalen mislukt")
        return
      }
      const data = result.data
      dispatch({ type: "set", field: "sourceText", value: composeSource(data) })
      dispatch({ type: "set", field: "sourceUrl", value: data.websiteUrl || "" })
      dispatch({
        type: "set",
        field: "sourceNote",
        value: data.websiteText ? "" : "Website niet bereikbaar, alleen vacatures gebruikt",
      })
    } catch {
      toast.error("Bron ophalen mislukt")
    } finally {
      setPending((p) => ({ ...p, sourceLoading: false }))
    }
  }

  const handleRewrite = async () => {
    if (!form.sourceText.trim()) {
      toast.error("Haal eerst de bron op")
      return
    }
    setPending((p) => ({ ...p, rewriting: true }))
    try {
      const res = await fetch(`/api/bedrijven/${id}/ai-rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceText: form.sourceText }),
      })
      const result = await res.json()
      if (!result.success) {
        toast.error(result.error || "AI herschrijving mislukt")
        return
      }
      dispatch({ type: "set", field: "description", value: result.data.description })
      toast.success("Omschrijving gegenereerd, controleer en sla op")
    } catch {
      toast.error("AI herschrijving mislukt")
    } finally {
      setPending((p) => ({ ...p, rewriting: false }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("Naam is verplicht")
      return
    }

    setPending((p) => ({ ...p, saving: true }))
    try {
      const res = await fetch(`/api/bedrijven/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          website: form.website.trim() || undefined,
          description: form.description.trim() || undefined,
          logo_url: form.logoUrl.trim() || undefined,
          linkedin_url: form.linkedinUrl.trim() || undefined,
          kvk_number: form.kvkNumber.trim() || undefined,
          street: form.street.trim() || undefined,
          city: form.city.trim() || undefined,
          zipcode: form.zipcode.trim() || undefined,
          state: form.state || undefined,
          country: form.country || "NL",
          phone: form.phone.trim() || undefined,
          industry: form.industry.trim() || undefined,
          size_min: form.sizeMin || undefined,
          size_max: form.sizeMax || undefined,
        }),
      })

      const result = await res.json()

      if (!result.success) {
        toast.error(result.error || "Fout bij bijwerken bedrijf")
        return
      }

      toast.success("Bedrijf bijgewerkt")
      router.push("/companies")
    } catch {
      toast.error("Fout bij bijwerken bedrijf")
    } finally {
      setPending((p) => ({ ...p, saving: false }))
    }
  }

  const handleDelete = async () => {
    setPending((p) => ({ ...p, deleting: true }))
    try {
      const res = await fetch(`/api/bedrijven/${id}`, {
        method: "DELETE",
      })
      const result = await res.json()

      if (!result.success) {
        toast.error(result.error || "Fout bij archiveren bedrijf")
        return
      }

      toast.success("Bedrijf gearchiveerd")
      router.push("/companies")
    } catch {
      toast.error("Fout bij archiveren bedrijf")
    } finally {
      setPending((p) => ({ ...p, deleting: false }))
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/companies">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-2" />
            Terug
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="size-8" />
            Bedrijf bewerken
          </h1>
          <p className="text-muted-foreground mt-1">
            Bewerk de gegevens van dit bedrijf
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
              <Label htmlFor="name">Bedrijfsnaam *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => dispatch({ type: "set", field: "name", value: e.target.value })}
                placeholder="bijv. Acme B.V."
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={form.website}
                  onChange={(e) => dispatch({ type: "set", field: "website", value: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn URL</Label>
                <Input
                  id="linkedin"
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(e) => dispatch({ type: "set", field: "linkedinUrl", value: e.target.value })}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kvk">KvK nummer</Label>
                <Input
                  id="kvk"
                  value={form.kvkNumber}
                  onChange={(e) => dispatch({ type: "set", field: "kvkNumber", value: e.target.value })}
                  placeholder="12345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefoon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => dispatch({ type: "set", field: "phone", value: e.target.value })}
                  placeholder="+31 20 1234567"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Logo</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="w-48 max-w-[200px]">
                  <ImageUpload
                    bucket="company-logos"
                    path={`${id}/logo`}
                    currentUrl={form.logoUrl}
                    aspectRatio="1:1"
                    label="Logo"
                    onUpload={(url) => dispatch({ type: "set", field: "logoUrl", value: url })}
                    onRemove={() => dispatch({ type: "set", field: "logoUrl", value: "" })}
                  />
                </div>
                <div className="space-y-3 flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleFetchLogo}
                    disabled={!form.website.trim() || pending.logoFetching}
                  >
                    {pending.logoFetching ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="size-4 mr-2" />
                    )}
                    Logo ophalen van website
                  </Button>
                  <div className="space-y-2">
                    <Label htmlFor="logo">Of plak een logo-URL</Label>
                    <Input
                      id="logo"
                      type="url"
                      value={form.logoUrl}
                      onChange={(e) => dispatch({ type: "set", field: "logoUrl", value: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => dispatch({ type: "set", field: "description", value: e.target.value })}
                placeholder="Korte beschrijving van het bedrijf..."
                rows={5}
              />
            </div>
          </CardContent>
        </Card>

        {/* AI-omschrijving */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI-omschrijving
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Haal de bron op (bedrijfswebsite en vacatures) en laat AI er een korte,
              feitelijke bedrijfsomschrijving van maken. Het resultaat komt in het
              Beschrijving-veld hierboven, je kunt het daarna nog aanpassen voor je opslaat.
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleFetchSource}
                disabled={pending.sourceLoading || pending.rewriting}
              >
                {pending.sourceLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Globe className="h-4 w-4 mr-2" />
                )}
                Bron ophalen
              </Button>
              <Button
                type="button"
                onClick={handleRewrite}
                disabled={!form.sourceText.trim() || pending.rewriting || pending.sourceLoading}
              >
                {pending.rewriting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Herschrijf met AI
              </Button>
            </div>
            {(form.sourceText || form.sourceUrl || form.sourceNote) && (
              <div className="space-y-2">
                <Label htmlFor="ai-source">Bron (bewerkbaar)</Label>
                <Textarea
                  id="ai-source"
                  value={form.sourceText}
                  onChange={(e) => dispatch({ type: "set", field: "sourceText", value: e.target.value })}
                  placeholder="Bron-tekst voor de AI..."
                  rows={8}
                />
                {form.sourceUrl && (
                  <p className="text-xs text-muted-foreground">Bron: {form.sourceUrl}</p>
                )}
                {form.sourceNote && <p className="text-xs text-amber-600">{form.sourceNote}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>Adres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="street">Straat</Label>
              <Input
                id="street"
                value={form.street}
                onChange={(e) => dispatch({ type: "set", field: "street", value: e.target.value })}
                placeholder="Keizersgracht 1"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Stad</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => dispatch({ type: "set", field: "city", value: e.target.value })}
                  placeholder="Amsterdam"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipcode">Postcode</Label>
                <Input
                  id="zipcode"
                  value={form.zipcode}
                  onChange={(e) => dispatch({ type: "set", field: "zipcode", value: e.target.value })}
                  placeholder="1012 AB"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">Provincie</Label>
                <Select
                  value={form.state || "none"}
                  onValueChange={(val) =>
                    dispatch({ type: "set", field: "state", value: val === "none" ? "" : val })
                  }
                >
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
              <div className="space-y-2">
                <Label htmlFor="country">Land</Label>
                <Input
                  id="country"
                  value={form.country}
                  onChange={(e) => dispatch({ type: "set", field: "country", value: e.target.value })}
                  placeholder="NL"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Industry and size */}
        <Card>
          <CardHeader>
            <CardTitle>Sector en omvang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="industry">Industrie / Sector</Label>
              <Input
                id="industry"
                value={form.industry}
                onChange={(e) => dispatch({ type: "set", field: "industry", value: e.target.value })}
                placeholder="bijv. IT, Zorg, Transport (kommagescheiden)"
              />
            </div>

            <div className="space-y-2">
              <Label>Bedrijfsgrootte (medewerkers)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={form.sizeMin}
                  onChange={(e) => dispatch({ type: "set", field: "sizeMin", value: e.target.value })}
                  placeholder="Min"
                  min={0}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  value={form.sizeMax}
                  onChange={(e) => dispatch({ type: "set", field: "sizeMax", value: e.target.value })}
                  placeholder="Max"
                  min={0}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" type="button" disabled={pending.deleting}>
                {pending.deleting ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="size-4 mr-2" />
                )}
                Verwijderen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Bedrijf archiveren?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dit bedrijf wordt gearchiveerd. Dit kan niet ongedaan worden gemaakt.
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
            <Link href="/companies">
              <Button variant="outline" type="button">
                Annuleren
              </Button>
            </Link>
            <Button type="submit" disabled={pending.saving}>
              {pending.saving && <Loader2 className="size-4 mr-2 animate-spin" />}
              Opslaan
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

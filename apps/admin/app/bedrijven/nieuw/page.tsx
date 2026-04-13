"use client"

import { useState } from "react"
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
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import { ArrowLeft, Loader2, Building2 } from "lucide-react"
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

export default function NieuwBedrijfPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [website, setWebsite] = useState("")
  const [description, setDescription] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [kvkNumber, setKvkNumber] = useState("")
  const [street, setStreet] = useState("")
  const [city, setCity] = useState("")
  const [zipcode, setZipcode] = useState("")
  const [state, setState] = useState("")
  const [country, setCountry] = useState("NL")
  const [phone, setPhone] = useState("")
  const [industry, setIndustry] = useState("")
  const [sizeMin, setSizeMin] = useState("")
  const [sizeMax, setSizeMax] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error("Naam is verplicht")
      return
    }

    setSaving(true)
    try {
      const res = await authFetch("/api/bedrijven", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || undefined,
          description: description.trim() || undefined,
          logo_url: logoUrl.trim() || undefined,
          linkedin_url: linkedinUrl.trim() || undefined,
          kvk_number: kvkNumber.trim() || undefined,
          street: street.trim() || undefined,
          city: city.trim() || undefined,
          zipcode: zipcode.trim() || undefined,
          state: state || undefined,
          country: country || "NL",
          phone: phone.trim() || undefined,
          industry: industry.trim() || undefined,
          size_min: sizeMin || undefined,
          size_max: sizeMax || undefined,
        }),
      })

      const result = await res.json()

      if (!result.success) {
        toast.error(result.error || "Fout bij aanmaken bedrijf")
        return
      }

      toast.success("Bedrijf aangemaakt")
      router.push("/companies")
    } catch {
      toast.error("Fout bij aanmaken bedrijf")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/companies">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Terug
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-8 w-8" />
            Nieuw bedrijf
          </h1>
          <p className="text-muted-foreground mt-1">
            Maak een nieuw bedrijf aan
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
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn URL</Label>
                <Input
                  id="linkedin"
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="kvk">KvK nummer</Label>
                <Input
                  id="kvk"
                  value={kvkNumber}
                  onChange={(e) => setKvkNumber(e.target.value)}
                  placeholder="12345678"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefoon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+31 20 1234567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-muted-foreground">
                Directe URL naar het logo. File upload wordt later ondersteund.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Korte beschrijving van het bedrijf..."
                rows={5}
              />
            </div>
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
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Keizersgracht 1"
              />
            </div>
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
              <div className="space-y-2">
                <Label htmlFor="country">Land</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
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
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="bijv. IT, Zorg, Transport (kommagescheiden)"
              />
            </div>

            <div className="space-y-2">
              <Label>Bedrijfsgrootte (medewerkers)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={sizeMin}
                  onChange={(e) => setSizeMin(e.target.value)}
                  placeholder="Min"
                  min={0}
                />
                <span className="text-muted-foreground">-</span>
                <Input
                  type="number"
                  value={sizeMax}
                  onChange={(e) => setSizeMax(e.target.value)}
                  placeholder="Max"
                  min={0}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Link href="/companies">
            <Button variant="outline" type="button">
              Annuleren
            </Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Bedrijf aanmaken
          </Button>
        </div>
      </form>
    </div>
  )
}

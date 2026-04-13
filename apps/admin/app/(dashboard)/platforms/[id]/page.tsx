"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Globe,
  Palette,
  Type,
  FileText,
  Loader2,
  Monitor,
} from "lucide-react"

interface PlatformDetail {
  id: string
  regio_platform: string
  central_place: string | null
  domain: string | null
  is_public: boolean
  tier: string | null
  logo_url: string | null
  primary_color: string | null
  hero_title: string | null
  hero_subtitle: string | null
  seo_description: string | null
  published_at: string | null
  approved_count: number
}

export default function PlatformDetailPage() {
  const params = useParams()
  const router = useRouter()
  const platformId = params.id as string

  const [platform, setPlatform] = useState<PlatformDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [domain, setDomain] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [logoUrl, setLogoUrl] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#0066cc")
  const [heroTitle, setHeroTitle] = useState("")
  const [heroSubtitle, setHeroSubtitle] = useState("")
  const [seoDescription, setSeoDescription] = useState("")

  useEffect(() => {
    async function fetchPlatform() {
      setLoading(true)
      try {
        const res = await authFetch(`/api/review/platforms/${platformId}`)
        const result = await res.json()
        if (result.error) {
          toast.error(result.error)
          return
        }
        const data = result.data as PlatformDetail
        setPlatform(data)
        setDomain(data.domain || "")
        setIsPublic(data.is_public)
        setLogoUrl(data.logo_url || "")
        setPrimaryColor(data.primary_color || "#0066cc")
        setHeroTitle(data.hero_title || "")
        setHeroSubtitle(data.hero_subtitle || "")
        setSeoDescription(data.seo_description || "")
      } catch {
        toast.error("Fout bij ophalen platform")
      } finally {
        setLoading(false)
      }
    }
    fetchPlatform()
  }, [platformId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await authFetch(`/api/review/platforms/${platformId}`, {
        method: "PATCH",
        body: JSON.stringify({
          domain: domain || null,
          is_public: isPublic,
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          hero_title: heroTitle || null,
          hero_subtitle: heroSubtitle || null,
          seo_description: seoDescription || null,
        }),
      })
      const result = await res.json()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Platform opgeslagen")
        if (result.data) {
          setPlatform({ ...result.data, approved_count: platform?.approved_count || 0 })
        }
      }
    } catch {
      toast.error("Fout bij opslaan")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <span className="text-muted-foreground">Platform laden...</span>
        </div>
      </div>
    )
  }

  if (!platform) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-muted-foreground">Platform niet gevonden.</p>
        <Button variant="outline" onClick={() => router.push("/platforms")} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug naar platforms
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/platforms")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6" />
            {platform.regio_platform}
          </h1>
          <p className="text-muted-foreground text-sm">
            {platform.central_place || "Geen hoofdplaats ingesteld"}
          </p>
        </div>
        <Badge
          variant={isPublic ? "default" : "secondary"}
          className={isPublic ? "bg-green-100 text-green-800 border-green-200" : ""}
        >
          {isPublic ? "Publiek" : "Niet publiek"}
        </Badge>
      </div>

      {/* Info banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            Dit platform heeft{" "}
            <strong>{platform.approved_count.toLocaleString("nl-NL")}</strong>{" "}
            goedgekeurde vacatures.
          </p>
        </CardContent>
      </Card>

      {/* Domain & Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domein & Zichtbaarheid
          </CardTitle>
          <CardDescription>
            Stel het domein en de publieke status in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Domein</Label>
            <Input
              id="domain"
              placeholder="bijv. amsterdamsebanen.nl"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label>Publieke site</Label>
              <p className="text-sm text-muted-foreground">
                Maak dit platform zichtbaar op het internet
              </p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Branding
          </CardTitle>
          <CardDescription>Logo en kleurinstellingen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primaire kleur</Label>
            <div className="flex gap-3 items-center">
              <input
                type="color"
                id="primaryColor"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-10 h-10 rounded border cursor-pointer"
              />
              <Input
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="max-w-[150px]"
                placeholder="#0066cc"
              />
              <div
                className="h-10 flex-1 rounded border"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hero Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Hero Content
          </CardTitle>
          <CardDescription>Tekst op de homepagina</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="heroTitle">Hero Titel</Label>
            <Input
              id="heroTitle"
              placeholder="bijv. Vind jouw baan in Amsterdam"
              value={heroTitle}
              onChange={(e) => setHeroTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="heroSubtitle">Hero Ondertitel</Label>
            <Input
              id="heroSubtitle"
              placeholder="bijv. Ontdek de beste vacatures in jouw regio"
              value={heroSubtitle}
              onChange={(e) => setHeroSubtitle(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            SEO
          </CardTitle>
          <CardDescription>Zoekmachineoptimalisatie</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="seoDescription">SEO Beschrijving</Label>
            <Textarea
              id="seoDescription"
              placeholder="Korte beschrijving voor zoekmachines (max 160 tekens)"
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {seoDescription.length}/160 tekens
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => router.push("/platforms")}>
          Annuleren
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Opslaan
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Upload,
  ExternalLink,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  Share2,
  Shield,
  Search,
  Image as ImageIcon,
  X,
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
  about_text: string | null
  contact_email: string | null
  contact_phone: string | null
  social_linkedin: string | null
  social_instagram: string | null
  social_facebook: string | null
  social_tiktok: string | null
  social_twitter: string | null
  favicon_url: string | null
  og_image_url: string | null
  privacy_text: string | null
  terms_text: string | null
}

const DEFAULT_PRIVACY_TEXT = `# Privacybeleid

## 1. Inleiding
Wij respecteren de privacy van alle gebruikers van onze website en dragen er zorg voor dat de persoonlijke informatie die u ons verschaft vertrouwelijk wordt behandeld.

## 2. Welke gegevens verzamelen wij?
- Naam en contactgegevens wanneer u een formulier invult
- IP-adres en browsergegevens voor analytische doeleinden
- Cookies voor het verbeteren van de gebruikerservaring

## 3. Waarvoor gebruiken wij uw gegevens?
- Om u te voorzien van de gevraagde informatie of diensten
- Om onze website te verbeteren
- Om te voldoen aan wettelijke verplichtingen

## 4. Bewaartermijn
Wij bewaren uw gegevens niet langer dan noodzakelijk voor de doeleinden waarvoor zij zijn verzameld.

## 5. Uw rechten
U heeft het recht om uw persoonsgegevens in te zien, te corrigeren of te verwijderen. Neem hiervoor contact met ons op.

## 6. Contact
Voor vragen over dit privacybeleid kunt u contact met ons opnemen via het contactformulier op onze website.`

const DEFAULT_TERMS_TEXT = `# Algemene Voorwaarden

## 1. Toepasselijkheid
Deze algemene voorwaarden zijn van toepassing op het gebruik van deze website en alle diensten die via de website worden aangeboden.

## 2. Gebruik van de website
- De informatie op deze website is bedoeld als algemene informatie
- Wij spannen ons in om de informatie actueel en correct te houden
- Aan de inhoud van vacatures kunnen geen rechten worden ontleend

## 3. Intellectueel eigendom
Alle content op deze website, inclusief teksten, afbeeldingen en logo's, is eigendom van ons of onze licentiegevers.

## 4. Aansprakelijkheid
- Wij zijn niet aansprakelijk voor schade voortvloeiend uit het gebruik van deze website
- Wij garanderen niet dat de website ononderbroken beschikbaar is
- Links naar externe websites zijn voor uw gemak; wij zijn niet verantwoordelijk voor de inhoud daarvan

## 5. Privacy
Op het gebruik van deze website is ons privacybeleid van toepassing.

## 6. Wijzigingen
Wij behouden ons het recht voor deze voorwaarden te wijzigen. Controleer deze pagina regelmatig.

## 7. Toepasselijk recht
Op deze voorwaarden is Nederlands recht van toepassing.`

// --- Logo Upload Component ---

function LogoUpload({
  currentUrl,
  platformId,
  onUploaded,
}: {
  currentUrl: string
  platformId: string
  onUploaded: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(async (file: File) => {
    const allowedTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Ongeldig bestandstype. Gebruik PNG, JPEG, SVG of WebP.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Bestand te groot. Maximum is 5MB.")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await authFetch(`/api/review/platforms/${platformId}/upload`, {
        method: "POST",
        body: formData,
      })
      const result = await res.json()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Logo geüpload")
        onUploaded(result.url)
      }
    } catch {
      toast.error("Fout bij uploaden")
    } finally {
      setUploading(false)
    }
  }, [platformId, onUploaded])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }, [handleUpload])

  return (
    <div className="space-y-3">
      <Label>Logo</Label>
      {currentUrl && (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
          <img
            src={currentUrl}
            alt="Huidig logo"
            className="h-12 w-12 object-contain rounded border bg-white"
          />
          <span className="text-sm text-muted-foreground truncate flex-1">
            {currentUrl}
          </span>
        </div>
      )}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Uploaden...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-medium">
              Sleep een bestand hierheen of klik om te kiezen
            </span>
            <span className="text-xs text-muted-foreground">
              PNG, JPEG, SVG of WebP - max 5MB
            </span>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  )
}

// --- Social Link Field ---

function SocialField({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
}: {
  label: string
  icon: React.ComponentType<{ className?: string }>
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        {value && (
          <Button
            variant="outline"
            size="icon"
            asChild
          >
            <a href={value} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

// --- TikTok Icon (not in lucide) ---

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.98a8.18 8.18 0 004.76 1.52V7.06a4.84 4.84 0 01-1-.37z" />
    </svg>
  )
}

// --- Main Page Component ---

export default function PlatformDetailPage() {
  const params = useParams()
  const router = useRouter()
  const platformId = params.id as string

  const [platform, setPlatform] = useState<PlatformDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Branding fields
  const [domain, setDomain] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [logoUrl, setLogoUrl] = useState("")
  const [primaryColor, setPrimaryColor] = useState("#0066cc")
  const [faviconUrl, setFaviconUrl] = useState("")

  // Content fields
  const [heroTitle, setHeroTitle] = useState("")
  const [heroSubtitle, setHeroSubtitle] = useState("")
  const [aboutText, setAboutText] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [contactPhone, setContactPhone] = useState("")

  // Social fields
  const [socialLinkedin, setSocialLinkedin] = useState("")
  const [socialInstagram, setSocialInstagram] = useState("")
  const [socialFacebook, setSocialFacebook] = useState("")
  const [socialTiktok, setSocialTiktok] = useState("")
  const [socialTwitter, setSocialTwitter] = useState("")

  // Legal fields
  const [privacyText, setPrivacyText] = useState("")
  const [termsText, setTermsText] = useState("")

  // SEO fields
  const [seoDescription, setSeoDescription] = useState("")
  const [ogImageUrl, setOgImageUrl] = useState("")

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
        // Branding
        setDomain(data.domain || "")
        setIsPublic(data.is_public)
        setLogoUrl(data.logo_url || "")
        setPrimaryColor(data.primary_color || "#0066cc")
        setFaviconUrl(data.favicon_url || "")
        // Content
        setHeroTitle(data.hero_title || "")
        setHeroSubtitle(data.hero_subtitle || "")
        setAboutText(data.about_text || "")
        setContactEmail(data.contact_email || "")
        setContactPhone(data.contact_phone || "")
        // Social
        setSocialLinkedin(data.social_linkedin || "")
        setSocialInstagram(data.social_instagram || "")
        setSocialFacebook(data.social_facebook || "")
        setSocialTiktok(data.social_tiktok || "")
        setSocialTwitter(data.social_twitter || "")
        // Legal
        setPrivacyText(data.privacy_text || "")
        setTermsText(data.terms_text || "")
        // SEO
        setSeoDescription(data.seo_description || "")
        setOgImageUrl(data.og_image_url || "")
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
          favicon_url: faviconUrl || null,
          hero_title: heroTitle || null,
          hero_subtitle: heroSubtitle || null,
          about_text: aboutText || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          social_linkedin: socialLinkedin || null,
          social_instagram: socialInstagram || null,
          social_facebook: socialFacebook || null,
          social_tiktok: socialTiktok || null,
          social_twitter: socialTwitter || null,
          privacy_text: privacyText || null,
          terms_text: termsText || null,
          seo_description: seoDescription || null,
          og_image_url: ogImageUrl || null,
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

      {/* Tabs */}
      <Tabs defaultValue="branding" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="branding" className="flex items-center gap-1.5">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-1.5">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">Content</span>
          </TabsTrigger>
          <TabsTrigger value="social" className="flex items-center gap-1.5">
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">Social</span>
          </TabsTrigger>
          <TabsTrigger value="legal" className="flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Legal</span>
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center gap-1.5">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">SEO</span>
          </TabsTrigger>
        </TabsList>

        {/* ===== BRANDING TAB ===== */}
        <TabsContent value="branding" className="space-y-6">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Branding
              </CardTitle>
              <CardDescription>Logo en kleurinstellingen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <LogoUpload
                currentUrl={logoUrl}
                platformId={platformId}
                onUploaded={(url) => setLogoUrl(url)}
              />

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

              <div className="space-y-2">
                <Label htmlFor="faviconUrl">Favicon URL</Label>
                <Input
                  id="faviconUrl"
                  placeholder="https://example.com/favicon.ico"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                />
                {faviconUrl && (
                  <div className="flex items-center gap-2 mt-1">
                    <img
                      src={faviconUrl}
                      alt="Favicon preview"
                      className="h-6 w-6 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Preview</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== CONTENT TAB ===== */}
        <TabsContent value="content" className="space-y-6">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Over ons
              </CardTitle>
              <CardDescription>Beschrijving van het platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label htmlFor="aboutText">About tekst</Label>
              <Textarea
                id="aboutText"
                placeholder="Beschrijf het platform, de regio en wat bezoekers kunnen verwachten..."
                value={aboutText}
                onChange={(e) => setAboutText(e.target.value)}
                rows={10}
              />
              <p className="text-xs text-muted-foreground">
                Markdown wordt ondersteund
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contactgegevens</CardTitle>
              <CardDescription>Contactinformatie voor bezoekers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">E-mailadres</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="info@platform.nl"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Telefoonnummer</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  placeholder="+31 20 123 4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== SOCIAL TAB ===== */}
        <TabsContent value="social" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Social Media
              </CardTitle>
              <CardDescription>
                Links naar sociale media profielen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SocialField
                label="LinkedIn"
                icon={Linkedin}
                value={socialLinkedin}
                onChange={setSocialLinkedin}
                placeholder="https://linkedin.com/company/..."
              />
              <SocialField
                label="Instagram"
                icon={Instagram}
                value={socialInstagram}
                onChange={setSocialInstagram}
                placeholder="https://instagram.com/..."
              />
              <SocialField
                label="Facebook"
                icon={Facebook}
                value={socialFacebook}
                onChange={setSocialFacebook}
                placeholder="https://facebook.com/..."
              />
              <SocialField
                label="TikTok"
                icon={TikTokIcon}
                value={socialTiktok}
                onChange={setSocialTiktok}
                placeholder="https://tiktok.com/@..."
              />
              <SocialField
                label="Twitter / X"
                icon={Twitter}
                value={socialTwitter}
                onChange={setSocialTwitter}
                placeholder="https://x.com/..."
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LEGAL TAB ===== */}
        <TabsContent value="legal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Privacybeleid
              </CardTitle>
              <CardDescription>
                Privacyverklaring voor het platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="privacyText">Privacytekst</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPrivacyText(DEFAULT_PRIVACY_TEXT)
                    toast.info("Standaard privacybeleid template ingeladen")
                  }}
                >
                  Gebruik standaard template
                </Button>
              </div>
              <Textarea
                id="privacyText"
                placeholder="Voer het privacybeleid in..."
                value={privacyText}
                onChange={(e) => setPrivacyText(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Markdown wordt ondersteund
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Algemene Voorwaarden
              </CardTitle>
              <CardDescription>
                Gebruiksvoorwaarden voor het platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="termsText">Voorwaarden tekst</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTermsText(DEFAULT_TERMS_TEXT)
                    toast.info("Standaard voorwaarden template ingeladen")
                  }}
                >
                  Gebruik standaard template
                </Button>
              </div>
              <Textarea
                id="termsText"
                placeholder="Voer de algemene voorwaarden in..."
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                rows={15}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Markdown wordt ondersteund
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== SEO TAB ===== */}
        <TabsContent value="seo" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                SEO
              </CardTitle>
              <CardDescription>Zoekmachineoptimalisatie</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="seoDescription">SEO Beschrijving</Label>
                <Textarea
                  id="seoDescription"
                  placeholder="Korte beschrijving voor zoekmachines (max 160 tekens)"
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={3}
                  maxLength={160}
                />
                <p className={`text-xs ${seoDescription.length > 160 ? "text-red-500" : "text-muted-foreground"}`}>
                  {seoDescription.length}/160 tekens
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Open Graph
              </CardTitle>
              <CardDescription>
                Afbeelding voor social media previews
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ogImageUrl">OG Image URL</Label>
                <Input
                  id="ogImageUrl"
                  placeholder="https://example.com/og-image.jpg"
                  value={ogImageUrl}
                  onChange={(e) => setOgImageUrl(e.target.value)}
                />
              </div>
              {ogImageUrl && (
                <div className="space-y-2">
                  <Label>Preview</Label>
                  <div className="rounded-lg border overflow-hidden bg-muted/30">
                    <img
                      src={ogImageUrl}
                      alt="OG Image preview"
                      className="w-full h-auto max-h-[200px] object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none"
                      }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button - always visible */}
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

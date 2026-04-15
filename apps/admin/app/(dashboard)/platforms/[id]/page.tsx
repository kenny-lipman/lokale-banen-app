"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import {
  ArrowLeft,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Loader2,
  Mail,
  Monitor,
  Palette,
  Rocket,
  Search,
  Settings,
  Type,
  TriangleAlert,
} from "lucide-react"
import {
  DEFAULT_FORM_VALUES,
  formToPatchPayload,
  platformToForm,
  type PlatformDetail,
  type PlatformFormValues,
} from "./types"
import { useAutoSave } from "./use-auto-save"
import { BasicsTab } from "./tabs/basics-tab"
import { BrandingTab } from "./tabs/branding-tab"
import { ContentTab } from "./tabs/content-tab"
import { SeoTab } from "./tabs/seo-tab"
import { ContactTab } from "./tabs/contact-tab"
import { GoLiveTab } from "./tabs/go-live-tab"

type TabKey = "basics" | "branding" | "content" | "seo" | "contact" | "go-live"

export default function PlatformDetailPage() {
  const params = useParams()
  const router = useRouter()
  const platformId = params.id as string

  const [platform, setPlatform] = useState<PlatformDetail | null>(null)
  const [values, setValues] = useState<PlatformFormValues>(DEFAULT_FORM_VALUES)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("basics")

  const handleSaved = useCallback((updated: unknown) => {
    const next = updated as PlatformDetail
    setPlatform((prev) => ({
      ...next,
      approved_count: prev?.approved_count ?? next.approved_count ?? 0,
    }))
  }, [])

  const autoSave = useAutoSave<PlatformFormValues>({
    platformId,
    debounceMs: 2000,
    toPayload: formToPatchPayload,
    onSaved: handleSaved,
    enabled: !loading,
  })

  // Load platform on mount / id change.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await authFetch(`/api/review/platforms/${platformId}`)
        const json = await res.json()
        if (cancelled) return
        if (!res.ok || json.error) {
          toast.error(json.error || "Platform niet gevonden")
          return
        }
        const data = json.data as PlatformDetail
        setPlatform(data)
        setValues(platformToForm(data))
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : "Unknown error"
        toast.error(`Fout bij laden: ${msg}`)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [platformId])

  // Unified change handler — patches values, then triggers debounced auto-save.
  const handleChange = useCallback(
    (patch: Partial<PlatformFormValues>) => {
      setValues((prev) => {
        const next = { ...prev, ...patch }
        autoSave.markDirty(next)
        return next
      })
    },
    [autoSave],
  )

  // Flush pending saves when navigating away.
  useEffect(() => {
    const handler = () => {
      void autoSave.flush()
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [autoSave])

  const publicUrl = platform?.domain
    ? `https://${platform.domain}`
    : platform?.preview_domain
      ? `https://${platform.preview_domain}`
      : null

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
    <div className="container mx-auto py-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/platforms")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="h-6 w-6" />
            {platform.regio_platform}
          </h1>
          <p className="text-muted-foreground text-sm">
            {platform.central_place || "Geen hoofdplaats ingesteld"}
          </p>
        </div>
        <AutoSaveIndicator
          status={autoSave.status}
          lastSavedAt={autoSave.lastSavedAt}
          error={autoSave.error}
        />
        <Badge
          variant={values.is_public ? "default" : "secondary"}
          className={values.is_public ? "bg-green-100 text-green-800 border-green-200" : ""}
        >
          {values.is_public ? "Publiek" : "Niet publiek"}
        </Badge>
        {publicUrl && (
          <Button size="sm" variant="outline" asChild>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Bekijk site
            </a>
          </Button>
        )}
      </div>

      {/* Info banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <p className="text-sm text-blue-800">
            Dit platform heeft{" "}
            <strong>
              {(platform.approved_count ?? 0).toLocaleString("nl-NL")}
            </strong>{" "}
            goedgekeurde vacatures.
          </p>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
          <TabsTrigger value="basics" className="flex items-center gap-1.5 py-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Basis</span>
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-1.5 py-2">
            <Palette className="h-4 w-4" />
            <span className="hidden sm:inline">Branding</span>
          </TabsTrigger>
          <TabsTrigger value="content" className="flex items-center gap-1.5 py-2">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">Content</span>
          </TabsTrigger>
          <TabsTrigger value="seo" className="flex items-center gap-1.5 py-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">SEO</span>
          </TabsTrigger>
          <TabsTrigger value="contact" className="flex items-center gap-1.5 py-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Contact</span>
          </TabsTrigger>
          <TabsTrigger value="go-live" className="flex items-center gap-1.5 py-2">
            <Rocket className="h-4 w-4" />
            <span className="hidden sm:inline">Go-Live</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basics">
          <BasicsTab platform={platform} values={values} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="branding">
          <BrandingTab platformId={platformId} values={values} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="content">
          <ContentTab values={values} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="seo">
          <SeoTab platform={platform} values={values} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="contact">
          <ContactTab values={values} onChange={handleChange} />
        </TabsContent>

        <TabsContent value="go-live">
          <GoLiveTab
            platform={platform}
            onPublished={(next) => {
              setPlatform(next)
              setValues(platformToForm(next))
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * Small inline status indicator showing auto-save state.
 */
function AutoSaveIndicator({
  status,
  lastSavedAt,
  error,
}: {
  status: "idle" | "dirty" | "saving" | "saved" | "error"
  lastSavedAt: Date | null
  error: string | null
}) {
  if (status === "saving") {
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Opslaan...
      </span>
    )
  }
  if (status === "dirty") {
    return (
      <span className="flex items-center gap-2 text-xs text-amber-700">
        <CircleDashed className="h-3.5 w-3.5" />
        Wijzigingen wachten...
      </span>
    )
  }
  if (status === "error") {
    return (
      <span
        className="flex items-center gap-2 text-xs text-red-700"
        title={error ?? undefined}
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        Opslaan mislukt
      </span>
    )
  }
  if (status === "saved" && lastSavedAt) {
    const hh = String(lastSavedAt.getHours()).padStart(2, "0")
    const mm = String(lastSavedAt.getMinutes()).padStart(2, "0")
    return (
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        Opgeslagen om {hh}:{mm}
      </span>
    )
  }
  return null
}

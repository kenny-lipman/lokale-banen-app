"use client"

import * as React from "react"
import { ExternalLink, Eye, Loader2, Monitor, Smartphone } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"

export interface LivePreviewProps {
  vacature: {
    id: string
    slug: string | null
    title: string
    review_status?: string | null
    published_at?: string | null
  }
  platform: {
    id: string
    regio_platform: string
    domain: string | null
    preview_domain: string | null
  } | null
  trigger?: React.ReactNode
}

type ViewportKey = "desktop" | "mobile"

const VIEWPORTS: Record<ViewportKey, { label: string; width: number; height: number }> = {
  desktop: { label: "Desktop 1200x800", width: 1200, height: 800 },
  mobile: { label: "Mobile 375x812", width: 375, height: 812 },
}

/**
 * Build the PUBLISHED public-site URL for a vacature.
 * Only works for approved + published vacatures.
 */
function buildPublishedUrl(
  platform: LivePreviewProps["platform"],
  slug: string | null,
): string | null {
  if (!platform || !slug) return null
  const host = platform.preview_domain ?? platform.domain
  if (!host) return null
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "")
  return `https://${cleanHost}/vacature/${slug}`
}

export function LivePreview({ vacature, platform, trigger }: LivePreviewProps) {
  const isPublished = !!vacature.published_at && vacature.review_status === 'approved'
  const publishedUrl = buildPublishedUrl(platform, vacature.slug)

  const [open, setOpen] = React.useState(false)
  const [viewport, setViewport] = React.useState<ViewportKey>("desktop")
  const [loaded, setLoaded] = React.useState(false)
  const [draftUrl, setDraftUrl] = React.useState<string | null>(null)
  const [loadingUrl, setLoadingUrl] = React.useState(false)

  // Fetch draft preview URL when opening dialog for unpublished vacature
  React.useEffect(() => {
    if (!open) return
    setLoaded(false)

    // Published: use direct slug URL
    if (isPublished && publishedUrl) {
      setDraftUrl(publishedUrl)
      return
    }

    // Draft: fetch signed preview URL from admin API
    setLoadingUrl(true)
    setDraftUrl(null)
    authFetch(`/api/vacatures/${vacature.id}/preview-url`)
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data?.url) {
          setDraftUrl(result.data.url)
        } else {
          toast.error(result.error || "Preview URL genereren mislukt")
        }
      })
      .catch((err) => {
        toast.error("Preview URL genereren mislukt", {
          description: err instanceof Error ? err.message : "Onbekende fout",
        })
      })
      .finally(() => setLoadingUrl(false))
  }, [open, viewport, isPublished, publishedUrl, vacature.id])

  const viewportConfig = VIEWPORTS[viewport]
  const url = draftUrl

  // Trigger is always enabled now — draft preview works for any job with platform
  const hasPlatform = !!platform
  const triggerNode = trigger ?? (
    <Button variant="outline" size="sm" disabled={!hasPlatform}>
      <Eye className="mr-2 h-4 w-4" />
      Live preview
    </Button>
  )

  if (!hasPlatform) {
    return triggerNode
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      <DialogContent className="max-w-[95vw] p-0 sm:max-w-[1320px]">
        <DialogHeader className="flex-row items-start justify-between gap-4 border-b p-4 pr-14">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">
              {vacature.title}
              {!isPublished && (
                <span className="ml-2 inline-block align-middle rounded bg-amber-100 text-amber-800 text-xs font-medium px-2 py-0.5">
                  Draft preview
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              {platform?.regio_platform ?? "Platform onbekend"} — {url || "URL laden..."}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Tabs
              value={viewport}
              onValueChange={(v) => setViewport(v as ViewportKey)}
            >
              <TabsList className="h-9">
                <TabsTrigger value="desktop" className="gap-1.5 px-2.5 text-xs">
                  <Monitor className="h-3.5 w-3.5" />
                  Desktop
                </TabsTrigger>
                <TabsTrigger value="mobile" className="gap-1.5 px-2.5 text-xs">
                  <Smartphone className="h-3.5 w-3.5" />
                  Mobile
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in nieuw tabblad
              </a>
            )}
          </div>
        </DialogHeader>

        <div className="flex max-h-[calc(90vh-64px)] items-start justify-center overflow-auto bg-muted/30 p-4">
          <div
            className="relative overflow-hidden rounded-lg border bg-background shadow-sm transition-all"
            style={{
              width: `${viewportConfig.width}px`,
              maxWidth: "100%",
              height: `${viewportConfig.height}px`,
            }}
          >
            {(loadingUrl || !loaded) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {loadingUrl ? "Preview genereren..." : "Preview laden..."}
                </span>
              </div>
            )}
            {url && (
              <iframe
                key={`${url}-${viewport}`}
                src={url}
                title={`Preview: ${vacature.title}`}
                onLoad={() => setLoaded(true)}
                sandbox="allow-scripts allow-same-origin"
                referrerPolicy="no-referrer"
                className="h-full w-full border-0"
                width={viewportConfig.width}
                height={viewportConfig.height}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LivePreview

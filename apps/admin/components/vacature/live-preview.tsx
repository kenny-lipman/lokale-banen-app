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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface LivePreviewProps {
  vacature: { id: string; slug: string | null; title: string }
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
 * Build the public-site URL for a vacature. Prefers `preview_domain`
 * (Vercel preview URL) so we stay on a host that we control, falling
 * back to the production `.nl` domain.
 */
function buildPreviewUrl(
  platform: LivePreviewProps["platform"],
  slug: string | null,
): string | null {
  if (!platform || !slug) return null
  const host = platform.preview_domain ?? platform.domain
  if (!host) return null
  return `https://${host}/vacature/${slug}`
}

export function LivePreview({ vacature, platform, trigger }: LivePreviewProps) {
  const url = buildPreviewUrl(platform, vacature.slug)
  const disabled = !url

  const [open, setOpen] = React.useState(false)
  const [viewport, setViewport] = React.useState<ViewportKey>("desktop")
  const [loaded, setLoaded] = React.useState(false)

  // Reset loading spinner whenever the dialog opens or the viewport/URL
  // changes so each iframe load is tracked independently.
  React.useEffect(() => {
    if (open) setLoaded(false)
  }, [open, viewport, url])

  const viewportConfig = VIEWPORTS[viewport]

  const triggerNode = trigger ?? (
    <Button variant="outline" size="sm" disabled={disabled}>
      <Eye className="mr-2 h-4 w-4" />
      Live preview
    </Button>
  )

  if (disabled) {
    // When there is no URL, wrap the (disabled) trigger in a tooltip so the
    // user understands why. We don't open the dialog.
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex" tabIndex={0} aria-disabled>
              {triggerNode}
            </span>
          </TooltipTrigger>
          <TooltipContent>Preview beschikbaar na publicatie</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{triggerNode}</DialogTrigger>
      <DialogContent
        className="max-w-[95vw] p-0 sm:max-w-[1320px]"
        // The built-in close button lives in DialogContent; we still render our
        // own "Open in nieuw tabblad" link alongside it.
      >
        <DialogHeader className="flex-row items-start justify-between gap-4 border-b p-4 pr-14">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-base">{vacature.title}</DialogTitle>
            <DialogDescription className="truncate text-xs">
              {platform?.regio_platform ?? "Platform onbekend"} - {url}
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
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in nieuw tabblad
            </a>
          </div>
        </DialogHeader>

        <div className="flex max-h-[calc(90vh-64px)] items-start justify-center overflow-auto bg-muted/30 p-4">
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border bg-background shadow-sm transition-all",
            )}
            style={{
              width: `${viewportConfig.width}px`,
              maxWidth: "100%",
              height: `${viewportConfig.height}px`,
            }}
          >
            {!loaded && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  Preview laden...
                </span>
              </div>
            )}
            <iframe
              key={`${url}-${viewport}`}
              src={url}
              title={`Preview: ${vacature.title}`}
              onLoad={() => setLoaded(true)}
              sandbox="allow-scripts allow-same-origin"
              referrerPolicy="no-referrer"
              className="h-full w-full border-0"
              // Explicit dimensions keep the iframe the exact viewport size
              // even if the outer div is scaled via CSS.
              width={viewportConfig.width}
              height={viewportConfig.height}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default LivePreview

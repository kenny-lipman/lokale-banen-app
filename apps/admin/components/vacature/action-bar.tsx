"use client"

/**
 * VacatureActionBar
 *
 * Herbruikbare horizontale actie-bar voor een vacature. Wordt gebruikt in
 * - de vacature drawer (full variant, onderaan)
 * - de review table row (compact variant, inline)
 *
 * Zie tasks/task3-admin-wizards-upload-junction.md voor de bredere context.
 * API endpoints bestaan al:
 *  - POST   /api/vacatures/[id]/publish
 *  - POST   /api/vacatures/[id]/unpublish
 *  - DELETE /api/vacatures/[id]            (soft delete → status=archived)
 */

import * as React from "react"
import Link from "next/link"
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  Circle,
  ExternalLink,
  Globe,
  Loader2,
  Pencil,
  Rocket,
  Send,
  EyeOff,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VacatureActionBarProps {
  vacature: {
    id: string
    slug: string | null
    review_status: "pending" | "approved" | "rejected" | string
    published_at: string | null
    status: string | null
    platform_id: string | null
  }
  platform: {
    id: string
    regio_platform: string
    domain: string | null
    preview_domain: string | null
  } | null
  /** `full` = drawer bottom (alle knoppen), `compact` = row inline (kernknoppen) */
  variant?: "full" | "compact"
  /** parent re-fetch na succesvolle actie */
  onChange?: () => void | Promise<void>
  className?: string
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type StatusKey = "archived" | "rejected" | "live" | "ready" | "review" | "draft"

interface StatusDescriptor {
  key: StatusKey
  label: string
  /**
   * Tailwind kleuren voor de Circle icon (fill/text) + subtiele
   * achtergrond voor de Badge. Geen echte emojis — een gevulde
   * lucide `Circle` in de juiste kleur.
   */
  dotClass: string
  badgeClass: string
}

function deriveStatus(
  vacature: VacatureActionBarProps["vacature"]
): StatusDescriptor {
  const { status, review_status, published_at } = vacature

  if (status === "archived") {
    return {
      key: "archived",
      label: "Gearchiveerd",
      dotClass: "fill-gray-500 text-gray-500",
      badgeClass:
        "border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-100",
    }
  }

  if (review_status === "rejected") {
    return {
      key: "rejected",
      label: "Afgekeurd",
      dotClass: "fill-red-500 text-red-500",
      badgeClass: "border-red-200 bg-red-50 text-red-700 hover:bg-red-50",
    }
  }

  if (review_status === "approved" && published_at) {
    return {
      key: "live",
      label: "Live",
      dotClass: "fill-green-500 text-green-500",
      badgeClass:
        "border-green-200 bg-green-50 text-green-700 hover:bg-green-50",
    }
  }

  if (review_status === "approved" && !published_at) {
    return {
      key: "ready",
      label: "Klaar",
      dotClass: "fill-yellow-500 text-yellow-500",
      badgeClass:
        "border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-50",
    }
  }

  if (review_status === "pending") {
    return {
      key: "review",
      label: "In review",
      dotClass: "fill-orange-500 text-orange-500",
      badgeClass:
        "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-50",
    }
  }

  return {
    key: "draft",
    label: "Concept",
    dotClass: "fill-slate-400 text-slate-400",
    badgeClass:
      "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50",
  }
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function buildPublicUrl(
  platform: VacatureActionBarProps["platform"],
  slug: string | null
): string | null {
  if (!platform || !slug) return null
  const host = platform.preview_domain ?? platform.domain
  if (!host) return null
  const cleanHost = host.replace(/^https?:\/\//, "").replace(/\/$/, "")
  return `https://${cleanHost}/vacature/${slug}`
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VacatureActionBar({
  vacature,
  platform,
  variant = "full",
  onChange,
  className,
}: VacatureActionBarProps) {
  const [publishing, setPublishing] = React.useState(false)
  const [unpublishing, setUnpublishing] = React.useState(false)
  const [archiving, setArchiving] = React.useState(false)
  const [restoring, setRestoring] = React.useState(false)
  const [unpublishDialogOpen, setUnpublishDialogOpen] = React.useState(false)
  const [archiveDialogOpen, setArchiveDialogOpen] = React.useState(false)

  const status = deriveStatus(vacature)
  const publicUrl = buildPublicUrl(platform, vacature.slug)
  const isLive = status.key === "live"
  const isArchived = status.key === "archived"
  const canPublish = !isLive && !isArchived
  const canUnpublish = Boolean(vacature.published_at) && !isArchived

  // ------------------------------ Publish ---------------------------------

  const handlePublish = React.useCallback(async () => {
    if (publishing) return
    setPublishing(true)
    try {
      const res = await authFetch(`/api/vacatures/${vacature.id}/publish`, {
        method: "POST",
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result?.success === false) {
        toast.error(
          result?.error ?? "Publiceren mislukt",
          result?.details ? { description: String(result.details) } : undefined
        )
        return
      }
      toast.success("Vacature is gepubliceerd", {
        action: publicUrl
          ? {
              label: "Bekijk op site",
              onClick: () =>
                window.open(publicUrl, "_blank", "noopener,noreferrer"),
            }
          : undefined,
      })
      await onChange?.()
    } catch (err) {
      toast.error("Publiceren mislukt", {
        description: err instanceof Error ? err.message : "Onbekende fout",
      })
    } finally {
      setPublishing(false)
    }
  }, [publishing, vacature.id, publicUrl, onChange])

  // ----------------------------- Unpublish --------------------------------

  const handleUnpublish = React.useCallback(async () => {
    if (unpublishing) return
    setUnpublishing(true)
    try {
      const res = await authFetch(`/api/vacatures/${vacature.id}/unpublish`, {
        method: "POST",
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result?.success === false) {
        toast.error(
          result?.error ?? "Offline halen mislukt",
          result?.details ? { description: String(result.details) } : undefined
        )
        return
      }
      toast.success("Vacature is offline gehaald")
      setUnpublishDialogOpen(false)
      await onChange?.()
    } catch (err) {
      toast.error("Offline halen mislukt", {
        description: err instanceof Error ? err.message : "Onbekende fout",
      })
    } finally {
      setUnpublishing(false)
    }
  }, [unpublishing, vacature.id, onChange])

  // ----------------------------- Archive ----------------------------------

  const handleArchive = React.useCallback(async () => {
    if (archiving) return
    setArchiving(true)
    try {
      const res = await authFetch(`/api/vacatures/${vacature.id}`, {
        method: "DELETE",
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result?.success === false) {
        toast.error(
          result?.error ?? "Archiveren mislukt",
          result?.details ? { description: String(result.details) } : undefined
        )
        return
      }
      toast.success("Vacature gearchiveerd")
      setArchiveDialogOpen(false)
      await onChange?.()
    } catch (err) {
      toast.error("Archiveren mislukt", {
        description: err instanceof Error ? err.message : "Onbekende fout",
      })
    } finally {
      setArchiving(false)
    }
  }, [archiving, vacature.id, onChange])

  // ----------------------------- Restore ---------------------------------

  const handleRestore = React.useCallback(async () => {
    if (restoring) return
    setRestoring(true)
    try {
      const res = await authFetch(`/api/vacatures/${vacature.id}/restore`, {
        method: "POST",
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result?.success === false) {
        toast.error(
          result?.error ?? "Herstellen mislukt",
          result?.details ? { description: String(result.details) } : undefined
        )
        return
      }
      toast.success("Vacature hersteld naar review")
      await onChange?.()
    } catch (err) {
      toast.error("Herstellen mislukt", {
        description: err instanceof Error ? err.message : "Onbekende fout",
      })
    } finally {
      setRestoring(false)
    }
  }, [restoring, vacature.id, onChange])

  // --------------------------- Shared helpers -----------------------------

  const [openingPreview, setOpeningPreview] = React.useState(false)

  // Open Vercel draft preview — fetches signed URL, then opens in new tab.
  const handleOpenVercelPreview = React.useCallback(async () => {
    if (openingPreview) return
    setOpeningPreview(true)
    try {
      const res = await authFetch(`/api/vacatures/${vacature.id}/preview-url`)
      const result = await res.json()
      if (!res.ok || !result.success || !result.data?.url) {
        toast.error(result?.error || "Preview URL genereren mislukt")
        return
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error("Preview URL genereren mislukt", {
        description: err instanceof Error ? err.message : "Onbekende fout",
      })
    } finally {
      setOpeningPreview(false)
    }
  }, [openingPreview, vacature.id])

  const hasProductionUrl = !!publicUrl
  const hasPlatform = !!platform
  const canPreview = hasPlatform || hasProductionUrl

  const viewOnSiteButton = (() => {
    const size = variant === "compact" ? "sm" : "default"

    if (!canPreview) {
      // Neither production URL nor platform — fully disabled with tooltip
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  type="button"
                  variant="outline"
                  size={size}
                  disabled
                  className="opacity-50 cursor-not-allowed"
                >
                  <ExternalLink aria-hidden="true" />
                  <span className={variant === "compact" ? "sr-only" : undefined}>
                    Bekijk op site
                  </span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {!vacature.slug
                ? "Geen slug beschikbaar"
                : "Geen platform aan vacature gekoppeld"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={size}
            disabled={openingPreview}
          >
            {openingPreview ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink aria-hidden="true" />
            )}
            <span className={variant === "compact" ? "sr-only" : undefined}>
              Bekijk op site
            </span>
            <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Open vacature</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hasProductionUrl}
            onSelect={(e) => {
              if (!publicUrl) {
                e.preventDefault()
                return
              }
              window.open(publicUrl, "_blank", "noopener,noreferrer")
            }}
            className="flex-col items-start gap-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-2 font-medium">
              <Globe className="h-4 w-4" aria-hidden="true" />
              <span>Productie</span>
              {!hasProductionUrl && (
                <span className="ml-auto text-xs text-muted-foreground">(n.v.t.)</span>
              )}
            </div>
            <span className="text-xs text-muted-foreground pl-6">
              {hasProductionUrl
                ? "Live URL op het platform domein"
                : !vacature.slug
                  ? "Geen slug (nog niet gepubliceerd)"
                  : "Platform heeft geen domain"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              handleOpenVercelPreview()
            }}
            className="flex-col items-start gap-0.5 cursor-pointer"
          >
            <div className="flex items-center gap-2 font-medium">
              <Rocket className="h-4 w-4" aria-hidden="true" />
              <span>Vercel preview</span>
              <span className="ml-auto text-xs text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                draft
              </span>
            </div>
            <span className="text-xs text-muted-foreground pl-6">
              Werkt altijd — signed URL, 1u geldig
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  })()

  const publishButton = canPublish && (
    <Button
      type="button"
      variant="default"
      size={variant === "compact" ? "sm" : "default"}
      disabled={publishing}
      onClick={handlePublish}
    >
      {publishing ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Send aria-hidden="true" />
      )}
      <span className={variant === "compact" ? "sr-only" : undefined}>
        Publish
      </span>
    </Button>
  )

  const unpublishButton = canUnpublish && (
    <AlertDialog
      open={unpublishDialogOpen}
      onOpenChange={setUnpublishDialogOpen}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={variant === "compact" ? "sm" : "default"}
          disabled={unpublishing}
        >
          {unpublishing ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <EyeOff aria-hidden="true" />
          )}
          <span className={variant === "compact" ? "sr-only" : undefined}>
            Unpublish
          </span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Vacature offline halen?</AlertDialogTitle>
          <AlertDialogDescription>
            Hij verdwijnt binnen seconden van de publieke site. Je kunt
            hem later opnieuw publiceren.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={unpublishing}>
            Annuleren
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleUnpublish()
            }}
            disabled={unpublishing}
          >
            {unpublishing ? (
              <>
                <Loader2 className="animate-spin" aria-hidden="true" />
                Bezig...
              </>
            ) : (
              "Offline halen"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // ------------------------------ Compact ---------------------------------

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5",
          className
        )}
      >
        <Badge
          variant="outline"
          className={cn("gap-1 font-medium", status.badgeClass)}
        >
          <Circle
            className={cn("h-2 w-2", status.dotClass)}
            aria-hidden="true"
          />
          <span>{status.label}</span>
        </Badge>
        {viewOnSiteButton}
        {publishButton}
        {unpublishButton}
      </div>
    )
  }

  // ------------------------------- Full -----------------------------------

  const scrapedLabel = formatDate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vacature as any).scraped_at ?? null
  )
  const publishedLabel = formatDate(vacature.published_at)

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-3 rounded-lg border bg-card p-4",
        className
      )}
    >
      {/* Top row: status + platform + timestamps */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Badge
          variant="outline"
          className={cn("gap-1.5 font-medium", status.badgeClass)}
        >
          <Circle
            className={cn("h-2.5 w-2.5", status.dotClass)}
            aria-hidden="true"
          />
          <span>{status.label}</span>
        </Badge>

        {platform?.regio_platform && (
          <span className="font-medium text-foreground">
            {platform.regio_platform}
          </span>
        )}

        {(scrapedLabel || publishedLabel) && (
          <span className="text-xs text-muted-foreground">
            {scrapedLabel && <>scr {scrapedLabel}</>}
            {scrapedLabel && publishedLabel && <> &middot; </>}
            {publishedLabel && <>pub {publishedLabel}</>}
          </span>
        )}
      </div>

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        {viewOnSiteButton}

        <Button type="button" variant="outline" asChild>
          <Link href={`/vacatures/${vacature.id}/bewerken`}>
            <Pencil aria-hidden="true" />
            <span>Bewerk</span>
          </Link>
        </Button>

        {/* Restore button — only for archived/rejected vacatures */}
        {isArchived && (
          <Button
            type="button"
            variant="outline"
            disabled={restoring}
            onClick={handleRestore}
          >
            {restoring ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <ArchiveRestore aria-hidden="true" />
            )}
            <span>Herstel</span>
          </Button>
        )}

        <AlertDialog
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
        >
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={archiving || isArchived}
            >
              {archiving ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Archive aria-hidden="true" />
              )}
              <span>Archiveer</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Vacature archiveren?</AlertDialogTitle>
              <AlertDialogDescription>
                De vacature wordt verplaatst naar de archief-status en
                verdwijnt van de publieke site. Dit is een soft-delete en
                kan later ongedaan gemaakt worden via de database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={archiving}>
                Annuleren
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault()
                  handleArchive()
                }}
                disabled={archiving}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {archiving ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Bezig...
                  </>
                ) : (
                  "Archiveer"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Spacer pushes publish actions to the right */}
        <div className="ml-auto flex items-center gap-2">
          {unpublishButton}
          {publishButton}
        </div>
      </div>
    </div>
  )
}

export default VacatureActionBar

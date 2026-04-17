"use client"

import * as React from "react"
import {
  CheckCircle2,
  Download,
  Globe,
  Pencil,
  PlusCircle,
  XCircle,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { nl } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { authFetch } from "@/lib/authenticated-fetch"

export interface ActivityLogProps {
  vacature: {
    id: string
    scraped_at: string | null
    created_at: string | null
    updated_at: string | null
    published_at: string | null
    reviewed_at: string | null
    reviewed_by: string | null
    review_status: string
    job_sources?: { name: string | null } | null
  }
}

interface TimelineEntry {
  key: string
  icon: React.ComponentType<{ className?: string }>
  iconTone: "neutral" | "positive" | "negative" | "info"
  title: React.ReactNode
  at: string
}

// Dutch short date + time formatter. 24u window uses relative language
// ("2 uur geleden") via date-fns for readability at a glance.
const dutchDateTime = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "short",
  timeStyle: "short",
})

function formatDate(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso

  const ageMs = Date.now() - date.getTime()
  const oneDay = 24 * 60 * 60 * 1000
  if (ageMs >= 0 && ageMs < oneDay) {
    return formatDistanceToNow(date, { addSuffix: true, locale: nl })
  }
  return dutchDateTime.format(date)
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id
}

// Simple in-memory cache shared across instances, keyed by reviewer id.
// Keeps lookups cheap when many log components render on one page.
const reviewerCache = new Map<string, string>()

function useReviewerName(reviewedBy: string | null): string {
  const [name, setName] = React.useState<string>(() => {
    if (!reviewedBy) return ""
    return reviewerCache.get(reviewedBy) ?? truncateId(reviewedBy)
  })

  React.useEffect(() => {
    if (!reviewedBy) return

    const cached = reviewerCache.get(reviewedBy)
    if (cached) {
      setName(cached)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    ;(async () => {
      try {
        const res = await authFetch(
          `/api/users/${encodeURIComponent(reviewedBy)}/profile`,
          { signal: controller.signal },
        )
        if (!res.ok) return
        const body = await res.json()
        const resolved: string | undefined = body?.data?.display_name
        if (resolved && !cancelled) {
          reviewerCache.set(reviewedBy, resolved)
          setName(resolved)
        }
      } catch {
        // Fall back to truncated id (already rendered).
      }
    })()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [reviewedBy])

  return name
}

const TONE_CLASSES: Record<TimelineEntry["iconTone"], string> = {
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-emerald-100 text-emerald-700",
  negative: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
}

export function ActivityLog({ vacature }: ActivityLogProps) {
  const reviewerName = useReviewerName(vacature.reviewed_by)

  const entries = React.useMemo<TimelineEntry[]>(() => {
    const list: TimelineEntry[] = []
    const sourceName = vacature.job_sources?.name ?? null

    if (vacature.scraped_at) {
      list.push({
        key: "scraped",
        icon: Download,
        iconTone: "info",
        title: (
          <>
            <span className="font-medium">Gescrapet</span>
            {sourceName ? (
              <>
                {" "}via <span className="font-medium">{sourceName}</span>
              </>
            ) : null}
          </>
        ),
        at: vacature.scraped_at,
      })
    } else if (vacature.created_at) {
      list.push({
        key: "created",
        icon: PlusCircle,
        iconTone: "neutral",
        title: (
          <>
            <span className="font-medium">Aangemaakt</span> handmatig
          </>
        ),
        at: vacature.created_at,
      })
    }

    // "Bewerkt" only fires if updated_at is meaningfully later than the
    // record's origin moment (scraped_at fallback created_at). A 60s grace
    // window avoids flickering for rows touched right after insert.
    const originIso = vacature.scraped_at ?? vacature.created_at
    if (vacature.updated_at && originIso) {
      const updated = new Date(vacature.updated_at).getTime()
      const origin = new Date(originIso).getTime()
      if (
        Number.isFinite(updated) &&
        Number.isFinite(origin) &&
        updated - origin > 60 * 1000
      ) {
        list.push({
          key: "updated",
          icon: Pencil,
          iconTone: "neutral",
          title: (
            <>
              <span className="font-medium">Bewerkt</span>
            </>
          ),
          at: vacature.updated_at,
        })
      }
    }

    if (
      vacature.review_status === "approved" &&
      vacature.reviewed_by &&
      vacature.reviewed_at
    ) {
      list.push({
        key: "approved",
        icon: CheckCircle2,
        iconTone: "positive",
        title: (
          <>
            <span className="font-medium">Goedgekeurd</span> door{" "}
            <span className="font-medium">{reviewerName || "..."}</span>
          </>
        ),
        at: vacature.reviewed_at,
      })
    }

    if (
      vacature.review_status === "rejected" &&
      vacature.reviewed_at
    ) {
      list.push({
        key: "rejected",
        icon: XCircle,
        iconTone: "negative",
        title: (
          <>
            <span className="font-medium">Afgekeurd</span>
            {vacature.reviewed_by ? (
              <>
                {" "}door <span className="font-medium">{reviewerName || "..."}</span>
              </>
            ) : null}
          </>
        ),
        at: vacature.reviewed_at,
      })
    }

    if (vacature.published_at) {
      list.push({
        key: "published",
        icon: Globe,
        iconTone: "positive",
        title: (
          <>
            <span className="font-medium">Gepubliceerd</span>
          </>
        ),
        at: vacature.published_at,
      })
    }

    // Newest first.
    return list.sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    )
  }, [vacature, reviewerName])

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Nog geen activiteit voor deze vacature.
      </div>
    )
  }

  return (
    <ol className="relative space-y-3 pl-2">
      {entries.map((entry, idx) => {
        const Icon = entry.icon
        const isLast = idx === entries.length - 1
        return (
          <li key={entry.key} className="relative flex gap-3">
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 ring-border",
                  TONE_CLASSES[entry.iconTone],
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && (
                <span
                  aria-hidden
                  className="mt-1 w-px flex-1 bg-border"
                  style={{ minHeight: "0.75rem" }}
                />
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col pb-3 text-sm">
              <div className="leading-5 text-foreground">{entry.title}</div>
              <time
                dateTime={entry.at}
                className="mt-0.5 text-xs text-muted-foreground"
                title={new Date(entry.at).toLocaleString("nl-NL")}
              >
                {formatDate(entry.at)}
              </time>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default ActivityLog

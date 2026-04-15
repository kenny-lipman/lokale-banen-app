"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Check,
  ExternalLink,
  Loader2,
  Rocket,
  RefreshCw,
  TriangleAlert,
  X,
} from "lucide-react"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import type { GoLiveCheckResponse, PlatformDetail } from "../types"

export interface GoLiveTabProps {
  platform: PlatformDetail
  /** Called after a successful /go-live POST with the updated platform. */
  onPublished: (platform: PlatformDetail) => void
  /** Called when something might have changed (useful for parent to refresh). */
  onRefresh?: () => void
}

export function GoLiveTab({ platform, onPublished, onRefresh }: GoLiveTabProps) {
  const [checks, setChecks] = useState<GoLiveCheckResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [publishing, setPublishing] = useState(false)

  const fetchChecks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch(`/api/platforms/${platform.id}/go-live-check`)
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error || "Kan checklist niet ophalen")
        return
      }
      setChecks(json.data as GoLiveCheckResponse)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(`Fout bij laden checklist: ${msg}`)
    } finally {
      setLoading(false)
    }
  }, [platform.id])

  useEffect(() => {
    void fetchChecks()
    // Re-fetch when relevant platform fields change — we rely on the parent
    // passing a fresh `platform` prop after each auto-save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    platform.id,
    platform.domain,
    platform.primary_color,
    platform.logo_url,
    platform.hero_title,
    platform.seo_description,
    platform.about_text,
    platform.is_public,
  ])

  const publish = useCallback(async () => {
    if (!checks?.all_required_passed) {
      toast.error("Niet alle required checks zijn groen.")
      return
    }
    setPublishing(true)
    try {
      const res = await authFetch(`/api/platforms/${platform.id}/go-live`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        toast.error(json.error || "Live zetten mislukt")
        return
      }
      toast.success("Platform is live! 🚀")
      if (json.data) {
        onPublished(json.data as PlatformDetail)
      }
      await fetchChecks()
      onRefresh?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      toast.error(`Fout bij live zetten: ${msg}`)
    } finally {
      setPublishing(false)
    }
  }, [checks?.all_required_passed, platform.id, fetchChecks, onPublished, onRefresh])

  const publicUrl = platform.domain
    ? `https://${platform.domain}`
    : platform.preview_domain
      ? `https://${platform.preview_domain}`
      : null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5" />
                Go-Live checklist
              </CardTitle>
              <CardDescription>
                Controleer dat alle onderdelen ingevuld zijn voordat je het platform publiek zet.
              </CardDescription>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={fetchChecks}
              disabled={loading}
            >
              <RefreshCw className={loading ? "h-4 w-4 mr-2 animate-spin" : "h-4 w-4 mr-2"} />
              Herladen
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && !checks ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checks laden...
            </div>
          ) : checks ? (
            <ul className="space-y-2">
              {checks.checks.map((item) => {
                const state = item.passed ? "pass" : item.required ? "fail" : "warn"
                return (
                  <li
                    key={item.key}
                    className="flex items-center justify-between rounded-md border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {state === "pass" && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-700">
                          <Check className="h-4 w-4" />
                        </span>
                      )}
                      {state === "fail" && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-700">
                          <X className="h-4 w-4" />
                        </span>
                      )}
                      {state === "warn" && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                          <TriangleAlert className="h-4 w-4" />
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-medium">{item.label}</p>
                        {!item.required && (
                          <p className="text-xs text-muted-foreground">Optioneel</p>
                        )}
                      </div>
                    </div>
                    <Badge
                      variant={item.passed ? "default" : "secondary"}
                      className={
                        item.passed
                          ? "bg-green-100 text-green-800 border-green-200"
                          : item.required
                            ? "bg-red-100 text-red-800 border-red-200"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                      }
                    >
                      {item.passed ? "OK" : item.required ? "Ontbreekt" : "Aanbevolen"}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Geen data beschikbaar.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publicatie</CardTitle>
          <CardDescription>
            {checks?.is_public
              ? "Dit platform staat al live."
              : "Zet het platform publiek — alle required checks moeten groen zijn."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={publish}
              disabled={
                publishing || loading || !checks?.all_required_passed || !!checks?.is_public
              }
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              {checks?.is_public ? "Al live" : "Live zetten"}
            </Button>

            {publicUrl && (
              <Button type="button" size="lg" variant="outline" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Bekijk site
                </a>
              </Button>
            )}
          </div>

          {!checks?.all_required_passed && !checks?.is_public && (
            <p className="text-xs text-amber-700">
              Een of meer required checks staan nog open. Vul de ontbrekende velden in en
              klik op "Herladen".
            </p>
          )}
          {checks?.approved_vacancy_count !== undefined && (
            <p className="text-xs text-muted-foreground">
              Aantal goedgekeurde vacatures:{" "}
              <span className="font-semibold">{checks.approved_vacancy_count}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

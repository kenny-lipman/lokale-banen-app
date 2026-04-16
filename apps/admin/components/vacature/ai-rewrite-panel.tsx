"use client"

import * as React from "react"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Sparkles,
  Check,
  X,
  Pencil,
  ChevronDown,
  ChevronUp,
} from "lucide-react"

interface ExtractedFields {
  employment: string | null
  education_level: string | null
  categories: string | null
  salary: string | null
  working_hours_min: number | null
  working_hours_max: number | null
  seo_title: string | null
  seo_description: string | null
}

interface AIRewritePanelProps {
  vacatureId: string
  hasDescription: boolean
  currentContentMd: string | null
  contentEnrichedAt: string | null
  onAccepted: () => void | Promise<void>
}

export function AIRewritePanel({
  vacatureId,
  hasDescription,
  currentContentMd,
  contentEnrichedAt,
  onAccepted,
}: AIRewritePanelProps) {
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [result, setResult] = React.useState<{
    content_md: string
    extracted: ExtractedFields
  } | null>(null)
  const [showExtracted, setShowExtracted] = React.useState(false)

  const handleRewrite = React.useCallback(async () => {
    if (loading) return
    setLoading(true)
    setResult(null)

    try {
      const res = await authFetch(`/api/vacatures/${vacatureId}/ai-rewrite`, {
        method: "POST",
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.error || "AI herschrijving mislukt")
        return
      }

      setResult(data.data)
      toast.success("AI herschrijving gegenereerd")
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "AI herschrijving mislukt"
      )
    } finally {
      setLoading(false)
    }
  }, [loading, vacatureId])

  const handleAccept = React.useCallback(async () => {
    if (!result || saving) return
    setSaving(true)

    try {
      // Build update payload — only include extracted fields that have values
      const payload: Record<string, unknown> = {
        content_md: result.content_md,
        content_enriched_at: new Date().toISOString(),
      }

      const ex = result.extracted
      if (ex.seo_title) payload.seo_title = ex.seo_title
      if (ex.seo_description) payload.seo_description = ex.seo_description
      // Only fill metadata if currently missing (don't overwrite existing values)
      if (ex.employment) payload.employment = ex.employment
      if (ex.education_level) payload.education_level = ex.education_level
      if (ex.categories) payload.categories = ex.categories
      if (ex.salary) payload.salary = ex.salary
      if (ex.working_hours_min != null)
        payload.working_hours_min = ex.working_hours_min
      if (ex.working_hours_max != null)
        payload.working_hours_max = ex.working_hours_max

      const res = await authFetch(`/api/vacatures/${vacatureId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        toast.error(data.error || "Opslaan mislukt")
        return
      }

      toast.success("AI herschrijving opgeslagen")
      setResult(null)
      await onAccepted()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Opslaan mislukt"
      )
    } finally {
      setSaving(false)
    }
  }, [result, saving, vacatureId, onAccepted])

  const handleReject = React.useCallback(() => {
    setResult(null)
  }, [])

  // Don't show if there's no description to rewrite
  if (!hasDescription) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          AI Herschrijving
        </h4>
        {contentEnrichedAt && !result && (
          <Badge
            variant="outline"
            className="text-xs bg-purple-50 border-purple-200 text-purple-700"
          >
            Herschreven op{" "}
            {new Date(contentEnrichedAt).toLocaleDateString("nl-NL", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </Badge>
        )}
      </div>

      {/* Current content_md preview */}
      {currentContentMd && !result && (
        <div className="bg-purple-50/50 rounded-lg p-4 max-h-60 overflow-y-auto border border-purple-100">
          <div className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
            {currentContentMd.substring(0, 800)}
            {currentContentMd.length > 800 && "..."}
          </div>
        </div>
      )}

      {/* AI result preview */}
      {result && (
        <div className="space-y-3">
          <div className="bg-green-50/50 rounded-lg p-4 max-h-80 overflow-y-auto border border-green-200">
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {result.content_md}
            </div>
          </div>

          {/* Extracted metadata */}
          <button
            type="button"
            onClick={() => setShowExtracted(!showExtracted)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {showExtracted ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            Geëxtraheerde metadata
          </button>

          {showExtracted && (
            <div className="flex flex-wrap gap-2">
              {result.extracted.employment && (
                <Badge variant="outline" className="text-xs">
                  Type: {result.extracted.employment}
                </Badge>
              )}
              {result.extracted.education_level && (
                <Badge variant="outline" className="text-xs">
                  Opleiding: {result.extracted.education_level}
                </Badge>
              )}
              {result.extracted.salary && (
                <Badge variant="outline" className="text-xs">
                  Salaris: {result.extracted.salary}
                </Badge>
              )}
              {(result.extracted.working_hours_min ||
                result.extracted.working_hours_max) && (
                <Badge variant="outline" className="text-xs">
                  Uren:{" "}
                  {[
                    result.extracted.working_hours_min,
                    result.extracted.working_hours_max,
                  ]
                    .filter(Boolean)
                    .join("-")}
                </Badge>
              )}
              {result.extracted.categories && (
                <Badge variant="outline" className="text-xs">
                  Categorie: {result.extracted.categories}
                </Badge>
              )}
              {result.extracted.seo_title && (
                <Badge variant="outline" className="text-xs text-gray-500">
                  SEO: {result.extracted.seo_title}
                </Badge>
              )}
            </div>
          )}

          {/* Accept / Reject buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleAccept}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span className="ml-1">Accepteer & Opslaan</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleReject}
              disabled={saving}
            >
              <X className="w-4 h-4" />
              <span className="ml-1">Verwerp</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRewrite}
              disabled={loading || saving}
            >
              <Sparkles className="w-4 h-4" />
              <span className="ml-1">Opnieuw</span>
            </Button>
          </div>
        </div>
      )}

      {/* Generate button (when no result) */}
      {!result && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRewrite}
          disabled={loading}
          className="border-purple-200 text-purple-700 hover:bg-purple-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span className="ml-1">
            {loading
              ? "Herschrijven..."
              : currentContentMd
                ? "Opnieuw herschrijven"
                : "AI Herschrijf"}
          </span>
        </Button>
      )}
    </div>
  )
}

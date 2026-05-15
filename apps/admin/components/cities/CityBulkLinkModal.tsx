"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface BulkTargetRow {
  id: string
  plaats: string
  postcode: string | null
  suggested_platform_id: string | null
  suggested_regio_platform: string | null
}

interface PlatformOption {
  id: string
  regio_platform: string
}

interface Props {
  selected: BulkTargetRow[]
  platforms: PlatformOption[]
  open: boolean
  onClose: () => void
  onApplied: () => void
}

export function CityBulkLinkModal({ selected, platforms, open, onClose, onApplied }: Props) {
  const [platformId, setPlatformId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const dominantSuggestion = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>()
    for (const r of selected) {
      if (!r.suggested_platform_id || !r.suggested_regio_platform) continue
      const cur = counts.get(r.suggested_platform_id) ?? {
        id: r.suggested_platform_id,
        name: r.suggested_regio_platform,
        count: 0,
      }
      cur.count++
      counts.set(r.suggested_platform_id, cur)
    }
    const sorted = [...counts.values()].sort((a, b) => b.count - a.count)
    return sorted[0] ?? null
  }, [selected])

  const outliers = useMemo(() => {
    if (!dominantSuggestion) return []
    return selected.filter(
      (r) =>
        r.suggested_platform_id !== null &&
        r.suggested_platform_id !== dominantSuggestion.id,
    )
  }, [selected, dominantSuggestion])

  const handleApply = async () => {
    if (!platformId) {
      toast.error("Selecteer een platform")
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch("/api/cities/bulk-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected.map((r) => r.id), platform_id: platformId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Bulk-koppeling mislukt")
      toast.success(`${data.updated} plaatsen gekoppeld`)
      onApplied()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onbekende fout")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{selected.length} plaatsen koppelen aan platform</DialogTitle>
          <DialogDescription>Alle geselecteerde plaatsen krijgen hetzelfde platform.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded p-3 max-h-32 overflow-y-auto text-sm space-y-1">
            {selected.slice(0, 8).map((r) => (
              <div key={r.id}>
                • {r.plaats} <span className="text-gray-500">({r.postcode ?? "—"})</span>
              </div>
            ))}
            {selected.length > 8 && (
              <div className="text-gray-400">… +{selected.length - 8} meer</div>
            )}
          </div>

          <div>
            <Label htmlFor="bulk-platform">Platform</Label>
            <Select
              value={platformId ?? ""}
              onValueChange={(v) => setPlatformId(v)}
            >
              <SelectTrigger id="bulk-platform">
                <SelectValue placeholder="Selecteer platform" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {dominantSuggestion && (
                  <SelectItem value={dominantSuggestion.id}>
                    {dominantSuggestion.name} (suggestie: {dominantSuggestion.count} van {selected.length} matchen)
                  </SelectItem>
                )}
                {platforms
                  .slice()
                  .sort((a, b) => a.regio_platform.localeCompare(b.regio_platform, "nl"))
                  .filter((p) => p.id !== dominantSuggestion?.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.regio_platform}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {outliers.length > 0 && platformId === dominantSuggestion?.id && (
              <p className="text-xs text-orange-600 mt-2">
                ⚠ {outliers.length} van {selected.length} plaatsen heeft een andere PC4-suggestie.
                Die krijgen alsnog dit platform.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annuleer
          </Button>
          <Button onClick={handleApply} disabled={isSaving || !platformId}>
            {isSaving ? "Koppelen…" : `Koppel ${selected.length} plaatsen`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

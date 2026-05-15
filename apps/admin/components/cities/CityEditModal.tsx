"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

export interface CityEditTarget {
  id: string
  plaats: string
  postcode: string | null
  platform_id: string | null
  current_regio_platform: string | null
  suggested_platform_id: string | null
  suggested_regio_platform: string | null
  source: string
  is_active: boolean | null
}

interface PlatformOption {
  id: string
  regio_platform: string
}

interface Props {
  city: CityEditTarget | null
  platforms: PlatformOption[]
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function CityEditModal({ city, platforms, open, onClose, onSaved }: Props) {
  const [plaats, setPlaats] = useState("")
  const [postcode, setPostcode] = useState("")
  const [platformId, setPlatformId] = useState<string | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (city) {
      setPlaats(city.plaats)
      setPostcode(city.postcode ?? "")
      setPlatformId(city.platform_id)
      setIsActive(city.is_active ?? false)
    }
  }, [city])

  if (!city) return null

  const acceptSuggestion = () => {
    if (city.suggested_platform_id) {
      setPlatformId(city.suggested_platform_id)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/cities/${city.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plaats: plaats.trim(),
          postcode: postcode.trim() || null,
          platform_id: platformId,
          is_active: isActive,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update mislukt")
      toast.success("Plaats bijgewerkt")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onbekende fout")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Plaats "${plaats}" verwijderen?`)) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/cities/${city.id}`, { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || "Verwijderen mislukt")
      toast.success("Plaats verwijderd")
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onbekende fout")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{city.plaats} {city.postcode ? `· ${city.postcode}` : ""}</DialogTitle>
          <DialogDescription>
            Bron: {city.source === "cbs_pc4" ? "CBS PC4" : "Handmatig"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="plaats">Plaats</Label>
            <Input id="plaats" value={plaats} onChange={(e) => setPlaats(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="postcode">Postcode (PC4)</Label>
            <Input
              id="postcode"
              value={postcode}
              maxLength={4}
              onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </div>
          <div>
            <Label htmlFor="platform">Platform-koppeling</Label>
            <Select
              value={platformId ?? "__none__"}
              onValueChange={(v) => setPlatformId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="platform">
                <SelectValue placeholder="Selecteer platform" />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="__none__">— Niet gekoppeld —</SelectItem>
                {platforms
                  .slice()
                  .sort((a, b) => a.regio_platform.localeCompare(b.regio_platform, "nl"))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.regio_platform}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {city.suggested_platform_id && city.platform_id === null && (
              <button
                type="button"
                aria-label={`Accepteer platform-suggestie: ${city.suggested_regio_platform}`}
                className="mt-2 text-xs text-orange-700 hover:underline"
                onClick={acceptSuggestion}
              >
                <span aria-hidden="true">✦ </span>
                Accepteer suggestie: {city.suggested_regio_platform}
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Switch id="is-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="is-active">Actief (zichtbaar in publieke regio-overzichten)</Label>
          </div>
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            className="text-red-600 hover:text-red-700"
            onClick={handleDelete}
            disabled={isDeleting || isSaving}
          >
            Verwijder
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>
              Annuleer
            </Button>
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              {isSaving ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

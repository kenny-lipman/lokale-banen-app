"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PlatformOption {
  id: string
  regio_platform: string
}

interface Props {
  platforms: PlatformOption[]
  onAdded: () => void
}

export function CityAddModal({ platforms, onAdded }: Props) {
  const [open, setOpen] = useState(false)
  const [plaats, setPlaats] = useState("")
  const [postcode, setPostcode] = useState("")
  const [platformId, setPlatformId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setPlaats("")
    setPostcode("")
    setPlatformId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plaats.trim() || !/^\d{4}$/.test(postcode)) {
      toast.error("Plaats en 4-cijferige postcode zijn verplicht")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/cities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plaats: plaats.trim(),
          postcode: postcode.trim(),
          platform_id: platformId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || "Toevoegen mislukt")
      toast.success(`${plaats} toegevoegd`)
      reset()
      setOpen(false)
      onAdded()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onbekende fout")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o) }}>
      <DialogTrigger asChild>
        <Button className="bg-orange-600 hover:bg-orange-700">
          <Plus className="w-4 h-4 mr-2" />
          Plaats toevoegen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Nieuwe plaats toevoegen</DialogTitle>
          <DialogDescription>
            Voeg een plaats handmatig toe. Platform-koppeling is optioneel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="city-add-plaats">Plaats</Label>
            <Input
              id="city-add-plaats"
              value={plaats}
              onChange={(e) => setPlaats(e.target.value)}
              placeholder="bijv. Amsterdam"
              disabled={saving}
              required
            />
          </div>
          <div>
            <Label htmlFor="city-add-postcode">Postcode (4 cijfers)</Label>
            <Input
              id="city-add-postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="bijv. 1011"
              maxLength={4}
              disabled={saving}
              required
            />
          </div>
          <div>
            <Label htmlFor="city-add-platform">Platform (optioneel)</Label>
            <Select
              value={platformId ?? "__none__"}
              onValueChange={(v) => setPlatformId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="city-add-platform">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                <SelectItem value="__none__">— Niet koppelen —</SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.regio_platform}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Annuleer
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Toevoegen…" : "Plaats toevoegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

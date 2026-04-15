"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Globe, Settings } from "lucide-react"
import type { PlatformDetail, PlatformFormValues } from "../types"
import { TIER_OPTIONS } from "../types"

export interface BasicsTabProps {
  platform: PlatformDetail
  values: PlatformFormValues
  onChange: (patch: Partial<PlatformFormValues>) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

export function BasicsTab({ platform, values, onChange }: BasicsTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Basis
          </CardTitle>
          <CardDescription>
            Kernconfiguratie van dit platform. Regio en centrale plaats zijn niet aanpasbaar
            vanuit deze pagina.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Regio platform</Label>
              <Input value={platform.regio_platform} readOnly disabled />
            </div>
            <div className="space-y-2">
              <Label>Centrale plaats</Label>
              <Input value={platform.central_place ?? "—"} readOnly disabled />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tier">Tier</Label>
              <Select
                value={values.tier || "free"}
                onValueChange={(v) => onChange({ tier: v })}
              >
                <SelectTrigger id="tier">
                  <SelectValue placeholder="Kies een tier" />
                </SelectTrigger>
                <SelectContent>
                  {TIER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="is_public">Publiek</Label>
                <p className="text-xs text-muted-foreground">
                  Staat de publieke site aan?
                </p>
              </div>
              <Switch
                id="is_public"
                checked={values.is_public}
                onCheckedChange={(checked) => onChange({ is_public: checked })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Domeinen
          </CardTitle>
          <CardDescription>
            Productiedomein (custom .nl) en automatisch gegenereerd preview-domein.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="domain">Productiedomein</Label>
            <Input
              id="domain"
              placeholder="bijv. utrechtsebanen.nl"
              value={values.domain}
              onChange={(e) => onChange({ domain: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Gebruik geen protocol (geen https://). Alleen de hostname.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Preview domein (Vercel)</Label>
            <Input value={platform.preview_domain ?? "—"} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Wordt automatisch gezet door Vercel. Niet handmatig te wijzigen.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Laatste wijziging</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-muted-foreground">Laatst bijgewerkt</p>
              <p className="font-medium">{formatDate(platform.updated_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Gepubliceerd op</p>
              <p className="font-medium">{formatDate(platform.published_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

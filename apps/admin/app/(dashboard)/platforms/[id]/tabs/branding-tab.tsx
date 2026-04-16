"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Palette } from "lucide-react"
import { ImageUpload } from "@/components/ui/image-upload"
import type { PlatformFormValues } from "../types"

export interface BrandingTabProps {
  platformId: string
  values: PlatformFormValues
  onChange: (patch: Partial<PlatformFormValues>) => void
}

const COLOR_PRESETS = [
  "#0066cc",
  "#1d4ed8",
  "#15803d",
  "#b91c1c",
  "#c2410c",
  "#7c3aed",
  "#db2777",
  "#0f172a",
]

export function BrandingTab({ platformId, values, onChange }: BrandingTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Afbeeldingen
          </CardTitle>
          <CardDescription>
            Logo, favicon en social-share image. Drag &amp; drop of klik om te uploaden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ImageUpload
            bucket="platform-assets"
            path={`${platformId}/logo.png`}
            currentUrl={values.logo_url}
            label="Logo"
            helperText="Toont in de header. Aanbevolen 200 × 60 px — PNG of SVG."
            aspectRatio="auto"
            onUpload={(url) => onChange({ logo_url: url })}
            onRemove={() => onChange({ logo_url: "" })}
          />

          <ImageUpload
            bucket="platform-assets"
            path={`${platformId}/favicon.png`}
            currentUrl={values.favicon_url}
            label="Favicon"
            helperText="32 × 32 px (PNG/ICO). Toont in de browsertab."
            aspectRatio="1:1"
            acceptedFormats={["image/png", "image/x-icon", "image/svg+xml"]}
            onUpload={(url) => onChange({ favicon_url: url })}
            onRemove={() => onChange({ favicon_url: "" })}
          />

          <ImageUpload
            bucket="platform-assets"
            path={`${platformId}/og-image.png`}
            currentUrl={values.og_image_url}
            label="OG image"
            helperText="1200 × 630 px — toont in LinkedIn/Twitter/WhatsApp previews."
            aspectRatio="16:9"
            onUpload={(url) => onChange({ og_image_url: url })}
            onRemove={() => onChange({ og_image_url: "" })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Primary color
          </CardTitle>
          <CardDescription>
            Wordt gebruikt voor knoppen, links en accenten op de publieke site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="primary_color">Hex kleur</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                id="primary_color"
                value={values.primary_color || "#0066cc"}
                onChange={(e) => onChange({ primary_color: e.target.value })}
                className="h-10 w-10 cursor-pointer rounded border"
              />
              <Input
                value={values.primary_color}
                onChange={(e) => onChange({ primary_color: e.target.value })}
                placeholder="#0066cc"
                className="max-w-[160px] font-mono"
              />
              <div
                className="h-10 flex-1 rounded border"
                style={{ backgroundColor: values.primary_color || "#0066cc" }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Presets</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Preset ${color}`}
                  onClick={() => onChange({ primary_color: color })}
                  className="h-8 w-8 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10 transition hover:scale-110"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Voorbeeld
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: values.primary_color || "#0066cc" }}
              >
                Primaire knop
              </button>
              <a
                style={{ color: values.primary_color || "#0066cc" }}
                className="text-sm font-medium underline underline-offset-4"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                Voorbeeld link
              </a>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: values.primary_color || "#0066cc" }}
              >
                Badge
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

/**
 * Storage upload demo page.
 *
 * Tijdelijke pagina om ImageUpload handmatig te testen.
 * Agent A mag deze weghalen zodra de component geintegreerd is in de
 * platform branding tab.
 */

import { useState } from "react"
import { toast } from "sonner"

import { ImageUpload } from "@/components/ui/image-upload"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function StorageDemoPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null)
  const [ogUrl, setOgUrl] = useState<string | null>(null)

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Storage upload demo</h1>
        <p className="text-sm text-muted-foreground">
          Test de ImageUpload component tegen de{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            platform-assets
          </code>{" "}
          bucket. Upload + preview + remove moeten alle drie werken.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Logo (auto aspect)</CardTitle>
          <CardDescription>
            Upload pad: <code>demo/logo.png</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            bucket="platform-assets"
            path="demo/logo.png"
            currentUrl={logoUrl}
            label="Logo"
            helperText="Transparante PNG aanbevolen. Max 2 MB."
            onUpload={(url) => {
              setLogoUrl(url)
              toast.success("Logo geupload", { description: url })
            }}
            onRemove={() => {
              setLogoUrl(null)
              toast.info("Logo verwijderd uit preview (bestand blijft in storage)")
            }}
          />
          {logoUrl && (
            <p className="mt-2 break-all text-xs text-muted-foreground">
              Public URL: {logoUrl}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Favicon (1:1)</CardTitle>
          <CardDescription>
            Upload pad: <code>demo/favicon.png</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            bucket="platform-assets"
            path="demo/favicon.png"
            currentUrl={faviconUrl}
            aspectRatio="1:1"
            maxSizeMB={1}
            acceptedFormats={[
              "image/png",
              "image/x-icon",
              "image/svg+xml",
            ]}
            label="Favicon"
            helperText="32x32 of 180x180 PNG / ICO. Max 1 MB."
            onUpload={(url) => {
              setFaviconUrl(url)
              toast.success("Favicon geupload")
            }}
            onRemove={() => setFaviconUrl(null)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OG image (16:9)</CardTitle>
          <CardDescription>
            Upload pad: <code>demo/og.png</code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            bucket="platform-assets"
            path="demo/og.png"
            currentUrl={ogUrl}
            aspectRatio="16:9"
            label="OG image"
            helperText="1200x630 JPG/PNG/WebP voor social sharing."
            onUpload={(url) => {
              setOgUrl(url)
              toast.success("OG image geupload")
            }}
            onRemove={() => setOgUrl(null)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validatie tests</CardTitle>
          <CardDescription>
            Probeer een te groot bestand (&gt;2MB) of verkeerd type (bv. PDF)
            om de foutafhandeling te zien.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImageUpload
            bucket="platform-assets"
            path="demo/validation-test.png"
            maxSizeMB={2}
            label="Validatie test"
            onUpload={(url) => toast.success("Test gelukt", { description: url })}
          />
        </CardContent>
      </Card>
    </div>
  )
}

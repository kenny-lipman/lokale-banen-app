"use client"

/**
 * HeaderImageField demo page.
 *
 * Tijdelijke test-pagina voor de HeaderImageField wrapper. Gebruikt een
 * hardcoded WestlandseBanen approved vacature. De upload gaat naar de
 * job-images bucket, path = `${vacatureId}/header.jpg`.
 *
 * Geen DB PATCH vanaf deze page — state is enkel in-memory. Integratie in
 * de vacature edit form / drawer gebeurt bij merge.
 */

import { useState } from "react"
import { toast } from "sonner"

import { HeaderImageField } from "@/components/vacature/header-image-field"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Hardcoded WestlandseBanen approved vacature — "Helpende" in Wateringen.
const DEMO_VACATURE_ID = "64c47ec2-5811-4b01-887e-213a3ecb63cf"
const DEMO_VACATURE_TITLE = "Helpende — Wateringen (WestlandseBanen)"

export default function HeaderImageDemoPage() {
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null)

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Header image demo</h1>
        <p className="text-sm text-muted-foreground">
          Test de <code>HeaderImageField</code> wrapper. Upload gaat naar de{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">job-images</code>{" "}
          bucket, path ={" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            {DEMO_VACATURE_ID}/header.jpg
          </code>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vacature header</CardTitle>
          <CardDescription>
            {DEMO_VACATURE_TITLE} — vacature ID{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[11px]">
              {DEMO_VACATURE_ID}
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <HeaderImageField
            vacatureId={DEMO_VACATURE_ID}
            currentUrl={headerImageUrl}
            onUpload={(url) => {
              setHeaderImageUrl(url)
              toast.success("Header geupload", { description: url })
            }}
            onRemove={() => {
              setHeaderImageUrl(null)
              toast.info("Header verwijderd (lokaal)")
            }}
          />

          {headerImageUrl && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs font-medium text-muted-foreground">
                Publieke URL
              </div>
              <code className="break-all text-xs">{headerImageUrl}</code>
            </div>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <strong>Let op:</strong> deze demo slaat niets op in de database.
            Refresh wist de URL state. DB persistentie gebeurt via{" "}
            <code>PATCH /api/vacatures/[id]</code> met veld{" "}
            <code>header_image_url</code> — buiten de scope van deze demo.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Validatie-checks</CardTitle>
          <CardDescription>
            Probeer verschillende bestandsgroottes/formaten.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            <li>
              <strong>1600 × 900 PNG (&lt; 3 MB)</strong> → moet lukken, preview
              verschijnt
            </li>
            <li>
              <strong>5 MB bestand</strong> → rode foutmelding met &quot;Bestand
              te groot&quot;
            </li>
            <li>
              <strong>SVG of ICO bestand</strong> → rode foutmelding met
              &quot;Bestandstype niet toegestaan&quot;
            </li>
            <li>
              <strong>Remove knop</strong> → preview verdwijnt, state reset
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

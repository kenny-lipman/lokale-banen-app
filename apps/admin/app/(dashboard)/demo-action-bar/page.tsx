"use client"

/**
 * Demo page voor VacatureActionBar.
 *
 * Mag verwijderd worden zodra de ActionBar op de juiste plekken is
 * geintegreerd (vacature drawer + review row). Alle API calls op
 * deze pagina treffen ECHTE vacatures — gebruik de mock IDs hieronder
 * alleen om visueel te inspecteren.
 */

import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VacatureActionBar } from "@/components/vacature/action-bar"

const platformMock = {
  id: "00000000-0000-0000-0000-000000000001",
  regio_platform: "UtrechtseBanen",
  domain: "utrechtsebanen.nl",
  preview_domain: null,
}

const platformPreviewOnly = {
  id: "00000000-0000-0000-0000-000000000002",
  regio_platform: "RotterdamseBanen",
  domain: null,
  preview_domain: "rotterdamsebanen.vercel.app",
}

const baseVacature = {
  id: "demo-id-0000",
  slug: "senior-backend-developer-utrecht-demo1234",
  platform_id: platformMock.id,
  // Non-schema fields cast for the full variant timestamps
  scraped_at: "2026-04-12T09:00:00Z",
}

const scenarios = [
  {
    title: "Concept",
    description:
      "review_status=pending maar anders dan verwacht; fallback → Concept.",
    vacature: {
      ...baseVacature,
      id: "demo-draft",
      review_status: "draft",
      published_at: null,
      status: "active",
    },
    platform: platformMock,
  },
  {
    title: "In review",
    description: "review_status=pending, niet gepubliceerd, niet gearchiveerd.",
    vacature: {
      ...baseVacature,
      id: "demo-pending",
      review_status: "pending",
      published_at: null,
      status: "active",
    },
    platform: platformMock,
  },
  {
    title: "Klaar",
    description: "approved maar published_at nog null (handmatig publiceren).",
    vacature: {
      ...baseVacature,
      id: "demo-ready",
      review_status: "approved",
      published_at: null,
      status: "active",
    },
    platform: platformMock,
  },
  {
    title: "Live",
    description: "approved + published_at gezet. Unpublish knop verschijnt.",
    vacature: {
      ...baseVacature,
      id: "demo-live",
      review_status: "approved",
      published_at: "2026-04-14T10:30:00Z",
      status: "active",
    },
    platform: platformMock,
  },
  {
    title: "Live via preview_domain",
    description:
      "Geen production domain, wel preview_domain (Vercel) — URL valt terug op preview.",
    vacature: {
      ...baseVacature,
      id: "demo-live-preview",
      review_status: "approved",
      published_at: "2026-04-14T10:30:00Z",
      status: "active",
      platform_id: platformPreviewOnly.id,
    },
    platform: platformPreviewOnly,
  },
  {
    title: "Afgekeurd",
    description: "review_status=rejected. Publish is nog mogelijk.",
    vacature: {
      ...baseVacature,
      id: "demo-rejected",
      review_status: "rejected",
      published_at: null,
      status: "active",
    },
    platform: platformMock,
  },
  {
    title: "Gearchiveerd",
    description: "status=archived. Publish/unpublish/archive gedeactiveerd.",
    vacature: {
      ...baseVacature,
      id: "demo-archived",
      review_status: "rejected",
      published_at: null,
      status: "archived",
    },
    platform: platformMock,
  },
  {
    title: "Zonder platform / slug",
    description:
      "Geen platform en geen slug — Bekijk op site knop is disabled met tooltip.",
    vacature: {
      ...baseVacature,
      id: "demo-no-platform",
      slug: null,
      review_status: "pending",
      published_at: null,
      status: "active",
      platform_id: null,
    },
    platform: null,
  },
] as const

export default function DemoActionBarPage() {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">VacatureActionBar demo</h1>
        <p className="text-sm text-muted-foreground">
          Visuele regressie-check voor alle status-varianten van{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            components/vacature/action-bar.tsx
          </code>
          . Deze pagina roept{" "}
          <strong>de echte publish/unpublish/delete APIs</strong> aan voor
          de opgegeven IDs — gebruik de buttons alleen bij demo-IDs die
          niet bestaan of blijf ervan af.
        </p>
        <p className="text-sm">
          <Link
            className="text-primary underline-offset-4 hover:underline"
            href="/"
          >
            &larr; Terug naar dashboard
          </Link>
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Full variant (drawer)</h2>
        {scenarios.map((scenario) => (
          <Card key={`full-${scenario.title}`}>
            <CardHeader>
              <CardTitle>{scenario.title}</CardTitle>
              <CardDescription>{scenario.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <VacatureActionBar
                vacature={scenario.vacature}
                platform={scenario.platform}
                variant="full"
                onChange={() => {
                  // demo: no re-fetch
                }}
              />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Compact variant (row inline)</h2>
        <Card>
          <CardContent className="space-y-3 p-6">
            {scenarios.map((scenario) => (
              <div
                key={`compact-${scenario.title}`}
                className="flex items-center justify-between gap-4 border-b pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <div className="text-sm font-medium">{scenario.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {scenario.description}
                  </div>
                </div>
                <VacatureActionBar
                  vacature={scenario.vacature}
                  platform={scenario.platform}
                  variant="compact"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

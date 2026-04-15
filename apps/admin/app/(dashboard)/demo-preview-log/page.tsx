"use client"

/**
 * Demo page for VacatureLivePreview + VacatureActivityLog.
 *
 * Tijdelijke pagina om de componenten handmatig te testen. De integratie in
 * de vacature-drawer/review-flow gebeurt in een aparte merge; deze pagina
 * mag daarna weg.
 */

import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ActivityLog } from "@/components/vacature/activity-log"
import { LivePreview } from "@/components/vacature/live-preview"

const WESTLANDSE_PLATFORM = {
  id: "6c6f5971-065d-4c3d-844a-787d437a32c1",
  regio_platform: "WestlandseBanen",
  domain: "westlandsebanen.nl",
  preview_domain: null,
}

// Vacature seeded in production met een bestaande slug.
const WESTLANDSE_VACATURE = {
  id: "c140a3c2-73dc-4351-86a0-c9a025b89294",
  slug: "logistiek-co-rdinator-honselersdijk-c140a3c2",
  title: "Logistiek Coordinator",
}

const VACATURE_WITHOUT_SLUG = {
  id: "00000000-0000-0000-0000-000000000000",
  slug: null,
  title: "Nog niet gepubliceerd",
}

const now = new Date()
const minus = (ms: number) => new Date(now.getTime() - ms).toISOString()

const MOCK_FULL_ACTIVITY = {
  id: "demo-full",
  scraped_at: minus(5 * 24 * 60 * 60 * 1000), // 5 dagen geleden
  created_at: minus(5 * 24 * 60 * 60 * 1000),
  updated_at: minus(3 * 60 * 60 * 1000), // 3 uur geleden
  published_at: minus(60 * 60 * 1000), // 1 uur geleden
  reviewed_at: minus(2 * 60 * 60 * 1000),
  reviewed_by: "853ee0ae-699e-4c87-8f15-6a607164a735",
  review_status: "approved",
  job_sources: { name: "Indeed" },
}

const MOCK_REJECTED = {
  id: "demo-rejected",
  scraped_at: minus(2 * 24 * 60 * 60 * 1000),
  created_at: minus(2 * 24 * 60 * 60 * 1000),
  updated_at: minus(2 * 24 * 60 * 60 * 1000),
  published_at: null,
  reviewed_at: minus(4 * 60 * 60 * 1000),
  reviewed_by: "0410f2b3-91b5-409d-9eb7-4f3e2487d377",
  review_status: "rejected",
  job_sources: { name: "Nationale Vacaturebank" },
}

const MOCK_MINIMAL = {
  id: "demo-minimal",
  scraped_at: minus(30 * 60 * 1000), // 30 min geleden -> relative time
  created_at: minus(30 * 60 * 1000),
  updated_at: minus(30 * 60 * 1000),
  published_at: null,
  reviewed_at: null,
  reviewed_by: null,
  review_status: "pending",
  job_sources: { name: "Baan in de Buurt" },
}

export default function DemoPreviewLogPage() {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Vacature Preview + Activity Log demo</h1>
        <p className="text-sm text-muted-foreground">
          Tijdelijke demo om de nieuwe componenten handmatig te valideren.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live preview (WestlandseBanen)</CardTitle>
          <CardDescription>
            Iframe preview met desktop/mobile toggle. Slug bestaat, dialog opent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LivePreview
            vacature={WESTLANDSE_VACATURE}
            platform={WESTLANDSE_PLATFORM}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live preview (disabled state)</CardTitle>
          <CardDescription>
            Vacature zonder slug - trigger is disabled, tooltip legt uit waarom.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LivePreview
            vacature={VACATURE_WITHOUT_SLUG}
            platform={WESTLANDSE_PLATFORM}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity log - volledig</CardTitle>
          <CardDescription>
            Alle states: scraped, edited, approved, published. Reviewer wordt
            opgezocht via /api/users/[id]/profile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityLog vacature={MOCK_FULL_ACTIVITY} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity log - afgekeurd</CardTitle>
          <CardDescription>Rejected variant met andere reviewer.</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityLog vacature={MOCK_REJECTED} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity log - minimaal</CardTitle>
          <CardDescription>
            Alleen scraped_at (30 min geleden - toont relatieve tijd).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityLog vacature={MOCK_MINIMAL} />
        </CardContent>
      </Card>
    </div>
  )
}

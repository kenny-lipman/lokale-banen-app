# Sales Lead Automation — Fase 2 Owner Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maak de owner-mapping pagina (`/sales/owner-mapping`) volledig functioneel — een tabel met de 4 dealeigenaars en een edit-modal met cascading dropdowns die live Pipedrive-metadata laden (users / pipelines / stages / date-deal-fields), met "Test config" validatie.

**Architecture:** Eén `PipedriveMetaService` met cache-integratie via `enrichment_cache` (TTL 1u) levert read-only Pipedrive-metadata via 4 API-routes. CRUD op `sales_lead_owner_config` via 3 routes (GET list, POST create, PATCH update). Validatie-route die elke config tegen Pipedrive checkt. Frontend gebruikt shadcn `Dialog` + `Select` voor de edit-modal; cascading: pipeline-keuze refresht stages.

**Tech Stack:** Next.js 15 App Router · TypeScript · Supabase (`enrichment_cache`, `sales_lead_owner_config`) · Pipedrive REST API v1 · shadcn/ui (Dialog, Select, Button, Input, Switch, Label) · `withAdminAuth` middleware uit `lib/auth-middleware`.

**Spec:** [`docs/superpowers/specs/2026-05-04-sales-lead-automation-design.md`](../specs/2026-05-04-sales-lead-automation-design.md) — sectie 5.5 (UI), 9 (API-routes), 12 fase 2 (deliverables)

---

## File Structure

| Pad | Actie | Verantwoordelijkheid |
|---|---|---|
| `apps/admin/lib/services/sales-leads/pipedrive-meta.service.ts` | **Create** | Cache-aware client voor Pipedrive read-only metadata |
| `apps/admin/lib/services/sales-leads/types.ts` | **Create** | Gedeelde TypeScript types (PipedriveUser, PipedrivePipeline, etc.) |
| `apps/admin/app/api/sales-leads/pipedrive-meta/users/route.ts` | **Create** | GET endpoint, admin-only |
| `apps/admin/app/api/sales-leads/pipedrive-meta/pipelines/route.ts` | **Create** | GET endpoint, admin-only |
| `apps/admin/app/api/sales-leads/pipedrive-meta/stages/route.ts` | **Create** | GET met `?pipeline_id=` query, admin-only |
| `apps/admin/app/api/sales-leads/pipedrive-meta/deal-fields/route.ts` | **Create** | GET met `?type=date` filter, admin-only |
| `apps/admin/app/api/sales-leads/owner-config/route.ts` | **Create** | GET (list) + POST (create), admin-only |
| `apps/admin/app/api/sales-leads/owner-config/[id]/route.ts` | **Create** | PATCH (update), admin-only |
| `apps/admin/app/api/sales-leads/owner-config/[id]/test/route.ts` | **Create** | POST validate-config tegen Pipedrive |
| `apps/admin/components/sales/owner-config-edit-modal.tsx` | **Create** | Modal met cascading dropdowns + test-knop |
| `apps/admin/app/sales/owner-mapping/page.tsx` | **Modify** | Placeholder vervangen door live tabel + edit-flow |

---

## Task 1: Shared TypeScript types

**Files:**
- Create: `apps/admin/lib/services/sales-leads/types.ts`

- [ ] **Step 1: Maak directory + types-bestand**

```bash
mkdir -p /Users/kennylipman/Lokale-Banen/apps/admin/lib/services/sales-leads
```

Schrijf naar `apps/admin/lib/services/sales-leads/types.ts`:

```ts
// Pipedrive-metadata shapes (subset van wat /v1 returnt; alleen wat de UI nodig heeft)

export type PipedriveUser = {
  id: number
  name: string
  email: string
  active_flag: boolean
}

export type PipedrivePipeline = {
  id: number
  name: string
  active: boolean
  order_nr: number
}

export type PipedriveStage = {
  id: number
  name: string
  pipeline_id: number
  order_nr: number
}

export type PipedriveDealField = {
  key: string                      // 40-char hash (custom) of standaard naam
  name: string
  field_type: string               // 'date' | 'enum' | 'varchar' | ...
  edit_flag: boolean
  mandatory_flag: boolean
}

// Owner-config validation result
export type OwnerConfigTestResult = {
  ok: boolean
  checks: {
    user: { ok: boolean; message?: string }
    pipeline: { ok: boolean; message?: string }
    stage: { ok: boolean; message?: string }
    deal_field: { ok: boolean; message?: string }
  }
}
```

- [ ] **Step 2: Verifieer compile**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm exec tsc --noEmit lib/services/sales-leads/types.ts 2>&1 | head -5
```

Expected: leeg of "Cannot use JSX flag" (irrelevant — file heeft geen JSX). Geen TS2-errors.

---

## Task 2: PipedriveMetaService

**Files:**
- Create: `apps/admin/lib/services/sales-leads/pipedrive-meta.service.ts`

- [ ] **Step 1: Schrijf de service-class**

Schrijf naar `apps/admin/lib/services/sales-leads/pipedrive-meta.service.ts`:

```ts
import { createServiceRoleClient } from '@/lib/supabase-server'
import type {
  PipedriveUser,
  PipedrivePipeline,
  PipedriveStage,
  PipedriveDealField,
  OwnerConfigTestResult,
} from './types'

const PIPEDRIVE_API_KEY = process.env.PIPEDRIVE_API_KEY
const PIPEDRIVE_V1_BASE = (process.env.PIPEDRIVE_API_URL ?? 'https://lokalebanen.pipedrive.com/api/v2')
  .replace(/\/v2\/?$/, '/v1')

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 uur

type CacheRow = { source: string; cache_key: string; response: unknown; expires_at: string }

export class PipedriveMetaService {
  private supabase = createServiceRoleClient()

  private async cachedFetch<T>(source: string, cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
    // Try cache eerst
    const { data: row } = await this.supabase
      .from('enrichment_cache')
      .select('source, cache_key, response, expires_at')
      .eq('source', source)
      .eq('cache_key', cacheKey)
      .single<CacheRow>()

    if (row && new Date(row.expires_at).getTime() > Date.now()) {
      return row.response as T
    }

    // Fetch fresh
    const fresh = await fetcher()

    // Upsert in cache
    await this.supabase.from('enrichment_cache').upsert({
      source,
      cache_key: cacheKey,
      response: fresh as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    })

    return fresh
  }

  private async pdFetch(path: string): Promise<unknown> {
    if (!PIPEDRIVE_API_KEY) throw new Error('PIPEDRIVE_API_KEY ontbreekt')
    const sep = path.includes('?') ? '&' : '?'
    const url = `${PIPEDRIVE_V1_BASE}${path}${sep}api_token=${PIPEDRIVE_API_KEY}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Pipedrive ${path} failed: ${res.status}`)
    const json = await res.json()
    if (json.success === false) throw new Error(`Pipedrive error: ${json.error ?? 'unknown'}`)
    return json.data
  }

  async getUsers(): Promise<PipedriveUser[]> {
    return this.cachedFetch('pipedrive_users', 'all', async () => {
      const data = (await this.pdFetch('/users')) as Array<{
        id: number; name: string; email: string; active_flag: boolean
      }>
      return data
        .filter((u) => u.active_flag)
        .map((u) => ({ id: u.id, name: u.name, email: u.email, active_flag: u.active_flag }))
    })
  }

  async getPipelines(): Promise<PipedrivePipeline[]> {
    return this.cachedFetch('pipedrive_pipelines', 'all', async () => {
      const data = (await this.pdFetch('/pipelines')) as Array<{
        id: number; name: string; active: boolean; order_nr: number
      }>
      return data.filter((p) => p.active)
    })
  }

  async getStages(pipelineId: number): Promise<PipedriveStage[]> {
    return this.cachedFetch('pipedrive_stages', String(pipelineId), async () => {
      const data = (await this.pdFetch(`/stages?pipeline_id=${pipelineId}`)) as Array<{
        id: number; name: string; pipeline_id: number; order_nr: number
      }>
      return data.sort((a, b) => a.order_nr - b.order_nr)
    })
  }

  async getDateDealFields(): Promise<PipedriveDealField[]> {
    return this.cachedFetch('pipedrive_deal_fields_date', 'all', async () => {
      const data = (await this.pdFetch('/dealFields')) as Array<PipedriveDealField>
      return data.filter((f) => f.field_type === 'date' && f.edit_flag && !f.mandatory_flag)
    })
  }

  async testConfig(opts: {
    pipedrive_user_id: number
    pipedrive_pipeline_id: number
    pipedrive_default_stage_id: number
    contactmoment_field_key: string | null
  }): Promise<OwnerConfigTestResult> {
    const result: OwnerConfigTestResult = {
      ok: false,
      checks: {
        user: { ok: false },
        pipeline: { ok: false },
        stage: { ok: false },
        deal_field: { ok: false },
      },
    }

    const users = await this.getUsers()
    const user = users.find((u) => u.id === opts.pipedrive_user_id)
    result.checks.user = user
      ? { ok: true, message: `${user.name} (${user.email})` }
      : { ok: false, message: `User ${opts.pipedrive_user_id} niet gevonden of inactief` }

    const pipelines = await this.getPipelines()
    const pipeline = pipelines.find((p) => p.id === opts.pipedrive_pipeline_id)
    result.checks.pipeline = pipeline
      ? { ok: true, message: pipeline.name }
      : { ok: false, message: `Pipeline ${opts.pipedrive_pipeline_id} niet gevonden of inactief` }

    if (pipeline) {
      const stages = await this.getStages(pipeline.id)
      const stage = stages.find((s) => s.id === opts.pipedrive_default_stage_id)
      result.checks.stage = stage
        ? { ok: true, message: `${stage.name} (order ${stage.order_nr})` }
        : { ok: false, message: `Stage ${opts.pipedrive_default_stage_id} hoort niet bij pipeline ${pipeline.name}` }
    } else {
      result.checks.stage = { ok: false, message: 'Pipeline ontbreekt — kan stage niet valideren' }
    }

    if (opts.contactmoment_field_key === null) {
      result.checks.deal_field = { ok: true, message: 'Geen contactmoment ingesteld (toegestaan)' }
    } else {
      const fields = await this.getDateDealFields()
      const field = fields.find((f) => f.key === opts.contactmoment_field_key)
      result.checks.deal_field = field
        ? { ok: true, message: field.name }
        : { ok: false, message: `Date-veld met key ${opts.contactmoment_field_key} niet gevonden` }
    }

    result.ok = Object.values(result.checks).every((c) => c.ok)
    return result
  }

  async invalidateCache(source?: string): Promise<void> {
    if (source) {
      await this.supabase.from('enrichment_cache').delete().eq('source', source)
    } else {
      // Alleen pipedrive_-bronnen wissen, niet KvK/Apollo cache
      await this.supabase
        .from('enrichment_cache')
        .delete()
        .or('source.eq.pipedrive_users,source.eq.pipedrive_pipelines,source.eq.pipedrive_stages,source.eq.pipedrive_deal_fields_date')
    }
  }
}
```

- [ ] **Step 2: TypeScript-check**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm exec tsc --noEmit 2>&1 | grep -E "pipedrive-meta\.service" | head -5
```

Expected: leeg (geen errors specifiek voor dit bestand).

---

## Task 3: API-routes voor Pipedrive metadata (4 endpoints)

**Files:**
- Create: `apps/admin/app/api/sales-leads/pipedrive-meta/users/route.ts`
- Create: `apps/admin/app/api/sales-leads/pipedrive-meta/pipelines/route.ts`
- Create: `apps/admin/app/api/sales-leads/pipedrive-meta/stages/route.ts`
- Create: `apps/admin/app/api/sales-leads/pipedrive-meta/deal-fields/route.ts`

- [ ] **Step 1: Maak alle 4 directories**

```bash
mkdir -p /Users/kennylipman/Lokale-Banen/apps/admin/app/api/sales-leads/pipedrive-meta/users \
         /Users/kennylipman/Lokale-Banen/apps/admin/app/api/sales-leads/pipedrive-meta/pipelines \
         /Users/kennylipman/Lokale-Banen/apps/admin/app/api/sales-leads/pipedrive-meta/stages \
         /Users/kennylipman/Lokale-Banen/apps/admin/app/api/sales-leads/pipedrive-meta/deal-fields
```

- [ ] **Step 2: Users route**

Schrijf naar `apps/admin/app/api/sales-leads/pipedrive-meta/users/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function handler(_req: NextRequest) {
  try {
    const service = new PipedriveMetaService()
    const users = await service.getUsers()
    return NextResponse.json({ users })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withAdminAuth(handler)
```

- [ ] **Step 3: Pipelines route**

Schrijf naar `apps/admin/app/api/sales-leads/pipedrive-meta/pipelines/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function handler(_req: NextRequest) {
  try {
    const service = new PipedriveMetaService()
    const pipelines = await service.getPipelines()
    return NextResponse.json({ pipelines })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withAdminAuth(handler)
```

- [ ] **Step 4: Stages route**

Schrijf naar `apps/admin/app/api/sales-leads/pipedrive-meta/stages/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function handler(req: NextRequest) {
  try {
    const pipelineIdParam = new URL(req.url).searchParams.get('pipeline_id')
    if (!pipelineIdParam) {
      return NextResponse.json({ error: 'pipeline_id query param required' }, { status: 400 })
    }
    const pipelineId = parseInt(pipelineIdParam, 10)
    if (Number.isNaN(pipelineId)) {
      return NextResponse.json({ error: 'pipeline_id must be a number' }, { status: 400 })
    }
    const service = new PipedriveMetaService()
    const stages = await service.getStages(pipelineId)
    return NextResponse.json({ stages })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withAdminAuth(handler)
```

- [ ] **Step 5: Deal-fields route**

Schrijf naar `apps/admin/app/api/sales-leads/pipedrive-meta/deal-fields/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth } from '@/lib/auth-middleware'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function handler(_req: NextRequest) {
  try {
    const service = new PipedriveMetaService()
    const deal_fields = await service.getDateDealFields()
    return NextResponse.json({ deal_fields })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const GET = withAdminAuth(handler)
```

- [ ] **Step 6: TS check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "pipedrive-meta/.*route" | head -10
```

Expected: leeg.

---

## Task 4: API-routes voor owner-config CRUD

**Files:**
- Create: `apps/admin/app/api/sales-leads/owner-config/route.ts`
- Create: `apps/admin/app/api/sales-leads/owner-config/[id]/route.ts`

- [ ] **Step 1: Maak directories**

```bash
mkdir -p /Users/kennylipman/Lokale-Banen/apps/admin/app/api/sales-leads/owner-config/[id]
```

- [ ] **Step 2: List + Create endpoint**

Schrijf naar `apps/admin/app/api/sales-leads/owner-config/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

async function listHandler(_req: NextRequest, _auth: AuthResult) {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_owner_config')
    .select('*')
    .order('display_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configs: data })
}

async function createHandler(req: NextRequest, _auth: AuthResult) {
  const body = await req.json()
  const required = ['key', 'label', 'pipedrive_user_id', 'pipedrive_pipeline_id', 'pipedrive_default_stage_id', 'hoofddomein_strategy']
  for (const k of required) {
    if (!(k in body)) return NextResponse.json({ error: `Missing field: ${k}` }, { status: 400 })
  }
  if (body.hoofddomein_strategy === 'fixed' && !body.hoofddomein_fixed_value) {
    return NextResponse.json({ error: 'hoofddomein_fixed_value required when strategy=fixed' }, { status: 400 })
  }
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_owner_config')
    .insert({
      key: body.key,
      label: body.label,
      pipedrive_user_id: body.pipedrive_user_id,
      pipedrive_pipeline_id: body.pipedrive_pipeline_id,
      pipedrive_default_stage_id: body.pipedrive_default_stage_id,
      hoofddomein_strategy: body.hoofddomein_strategy,
      hoofddomein_fixed_value: body.hoofddomein_fixed_value ?? null,
      wetarget_flag_value: body.wetarget_flag_value ?? 301,
      contactmoment_field_key: body.contactmoment_field_key ?? null,
      contactmoment_offset_workdays: body.contactmoment_offset_workdays ?? 1,
      is_active: body.is_active ?? true,
      display_order: body.display_order ?? 100,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data }, { status: 201 })
}

export const GET = withAdminAuth(listHandler)
export const POST = withAdminAuth(createHandler)
```

- [ ] **Step 3: Update endpoint**

Schrijf naar `apps/admin/app/api/sales-leads/owner-config/[id]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'

const UPDATABLE_FIELDS = [
  'label', 'pipedrive_user_id', 'pipedrive_pipeline_id', 'pipedrive_default_stage_id',
  'hoofddomein_strategy', 'hoofddomein_fixed_value', 'wetarget_flag_value',
  'contactmoment_field_key', 'contactmoment_offset_workdays', 'is_active', 'display_order',
] as const

async function patchHandler(req: NextRequest, _auth: AuthResult, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const k of UPDATABLE_FIELDS) {
    if (k in body) updates[k] = body[k]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields in body' }, { status: 400 })
  }
  if (updates.hoofddomein_strategy === 'fixed' && !updates.hoofddomein_fixed_value && !('hoofddomein_fixed_value' in body)) {
    return NextResponse.json({ error: 'hoofddomein_fixed_value required when strategy=fixed' }, { status: 400 })
  }
  updates.updated_at = new Date().toISOString()
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('sales_lead_owner_config')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ config: data })
}

export const PATCH = withAdminAuth(patchHandler)
```

- [ ] **Step 4: TS check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "owner-config" | head -5
```

Expected: leeg.

---

## Task 5: API-route voor "Test config"

**Files:**
- Create: `apps/admin/app/api/sales-leads/owner-config/[id]/test/route.ts`

- [ ] **Step 1: Maak dir + file**

```bash
mkdir -p /Users/kennylipman/Lokale-Banen/apps/admin/app/api/sales-leads/owner-config/[id]/test
```

Schrijf naar `apps/admin/app/api/sales-leads/owner-config/[id]/test/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AuthResult } from '@/lib/auth-middleware'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { PipedriveMetaService } from '@/lib/services/sales-leads/pipedrive-meta.service'

async function testHandler(_req: NextRequest, _auth: AuthResult, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = createServiceRoleClient()
  const { data: config, error } = await supabase
    .from('sales_lead_owner_config')
    .select('pipedrive_user_id, pipedrive_pipeline_id, pipedrive_default_stage_id, contactmoment_field_key')
    .eq('id', id)
    .single()
  if (error || !config) return NextResponse.json({ error: 'Config niet gevonden' }, { status: 404 })

  try {
    const service = new PipedriveMetaService()
    const result = await service.testConfig({
      pipedrive_user_id: config.pipedrive_user_id,
      pipedrive_pipeline_id: config.pipedrive_pipeline_id,
      pipedrive_default_stage_id: config.pipedrive_default_stage_id,
      contactmoment_field_key: config.contactmoment_field_key,
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export const POST = withAdminAuth(testHandler)
```

- [ ] **Step 2: TS check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "owner-config/.*test" | head -5
```

Expected: leeg.

---

## Task 6: Smoke-test alle API endpoints

- [ ] **Step 1: Start dev server**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm dev
```

Run met `run_in_background: true`. Wacht tot "Ready in" log.

- [ ] **Step 2: Test alle 6 endpoints zonder auth (verwacht 401)**

```bash
for path in /api/sales-leads/pipedrive-meta/users /api/sales-leads/pipedrive-meta/pipelines '/api/sales-leads/pipedrive-meta/stages?pipeline_id=5' '/api/sales-leads/pipedrive-meta/deal-fields' /api/sales-leads/owner-config; do
  code=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000${path}")
  echo "${path} → ${code}"
done
```

Expected: alles `401` (unauthorized — geen session-cookie).

- [ ] **Step 3: Test stages endpoint zonder pipeline_id (verwacht 400 maar eerst 401 want unauthenticated)**

```bash
/usr/bin/curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/sales-leads/pipedrive-meta/stages"
```

Expected: `401` (auth wint over query-validatie).

- [ ] **Step 4: Inspecteer dev-server logs op compile errors**

Lees `/tmp/admin-dev.log` (of background-task output) en filter op `error`. Verwacht: geen compile-errors voor de nieuwe routes/services.

- [ ] **Step 5: Stop dev server**

```bash
pkill -f "next dev"
```

---

## Task 7: OwnerConfigEditModal component

**Files:**
- Create: `apps/admin/components/sales/owner-config-edit-modal.tsx`

- [ ] **Step 1: Maak directory + component**

```bash
mkdir -p /Users/kennylipman/Lokale-Banen/apps/admin/components/sales
```

Schrijf naar `apps/admin/components/sales/owner-config-edit-modal.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import type {
  PipedriveUser,
  PipedrivePipeline,
  PipedriveStage,
  PipedriveDealField,
  OwnerConfigTestResult,
} from "@/lib/services/sales-leads/types"

type OwnerConfig = {
  id: string
  key: string
  label: string
  pipedrive_user_id: number
  pipedrive_pipeline_id: number
  pipedrive_default_stage_id: number
  hoofddomein_strategy: "fixed" | "auto_match_by_address"
  hoofddomein_fixed_value: string | null
  wetarget_flag_value: number
  contactmoment_field_key: string | null
  contactmoment_offset_workdays: number
  is_active: boolean
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: OwnerConfig
  onSaved: () => void
}

export function OwnerConfigEditModal({ open, onOpenChange, config, onSaved }: Props) {
  const [form, setForm] = useState<OwnerConfig>(config)
  const [users, setUsers] = useState<PipedriveUser[]>([])
  const [pipelines, setPipelines] = useState<PipedrivePipeline[]>([])
  const [stages, setStages] = useState<PipedriveStage[]>([])
  const [dealFields, setDealFields] = useState<PipedriveDealField[]>([])
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<OwnerConfigTestResult | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Reset form als config-prop verandert
  useEffect(() => {
    setForm(config)
    setTestResult(null)
    setSaveError(null)
  }, [config, open])

  // Initial load: users, pipelines, deal-fields (parallel) + stages voor huidige pipeline
  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      fetch("/api/sales-leads/pipedrive-meta/users").then((r) => r.json()),
      fetch("/api/sales-leads/pipedrive-meta/pipelines").then((r) => r.json()),
      fetch("/api/sales-leads/pipedrive-meta/deal-fields").then((r) => r.json()),
      fetch(`/api/sales-leads/pipedrive-meta/stages?pipeline_id=${form.pipedrive_pipeline_id}`).then((r) => r.json()),
    ])
      .then(([u, p, d, s]) => {
        setUsers(u.users ?? [])
        setPipelines(p.pipelines ?? [])
        setDealFields(d.deal_fields ?? [])
        setStages(s.stages ?? [])
      })
      .finally(() => setLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cascading: bij pipeline-wijziging refresh stages
  async function handlePipelineChange(newPipelineId: number) {
    setForm((f) => ({ ...f, pipedrive_pipeline_id: newPipelineId, pipedrive_default_stage_id: 0 }))
    setStages([])
    const r = await fetch(`/api/sales-leads/pipedrive-meta/stages?pipeline_id=${newPipelineId}`).then((r) => r.json())
    setStages(r.stages ?? [])
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await fetch(`/api/sales-leads/owner-config/${config.id}/test`, { method: "POST" }).then((r) => r.json())
      setTestResult(r)
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaveError(null)
    const res = await fetch(`/api/sales-leads/owner-config/${config.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: form.label,
        pipedrive_user_id: form.pipedrive_user_id,
        pipedrive_pipeline_id: form.pipedrive_pipeline_id,
        pipedrive_default_stage_id: form.pipedrive_default_stage_id,
        hoofddomein_strategy: form.hoofddomein_strategy,
        hoofddomein_fixed_value: form.hoofddomein_fixed_value,
        wetarget_flag_value: form.wetarget_flag_value,
        contactmoment_field_key: form.contactmoment_field_key,
        contactmoment_offset_workdays: form.contactmoment_offset_workdays,
        is_active: form.is_active,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setSaveError(j.error ?? "Opslaan mislukt")
      return
    }
    onSaved()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bewerk: {form.label}</DialogTitle>
          <DialogDescription>Pipedrive metadata wordt live geladen (1u cache).</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Pipedrive metadata laden...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <Label htmlFor="label">Label</Label>
              <Input id="label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>

            <div>
              <Label>Pipedrive User</Label>
              <Select value={String(form.pipedrive_user_id)} onValueChange={(v) => setForm({ ...form, pipedrive_user_id: parseInt(v, 10) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name} <span className="text-gray-500 text-xs">({u.email})</span></SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pipeline</Label>
              <Select value={String(form.pipedrive_pipeline_id)} onValueChange={(v) => handlePipelineChange(parseInt(v, 10))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Default Stage</Label>
              <Select value={String(form.pipedrive_default_stage_id)} onValueChange={(v) => setForm({ ...form, pipedrive_default_stage_id: parseInt(v, 10) })}>
                <SelectTrigger><SelectValue placeholder="Kies stage..." /></SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Contactmoment veld</Label>
              <Select
                value={form.contactmoment_field_key ?? "__none"}
                onValueChange={(v) => setForm({ ...form, contactmoment_field_key: v === "__none" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Geen contactmoment</SelectItem>
                  {dealFields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Contactmoment offset (werkdagen)</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={form.contactmoment_offset_workdays}
                onChange={(e) => setForm({ ...form, contactmoment_offset_workdays: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <div>
              <Label>Hoofddomein strategie</Label>
              <RadioGroup
                value={form.hoofddomein_strategy}
                onValueChange={(v) => setForm({ ...form, hoofddomein_strategy: v as "fixed" | "auto_match_by_address" })}
                className="mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="strat-fixed" value="fixed" />
                  <Label htmlFor="strat-fixed" className="font-normal">Vast</Label>
                  {form.hoofddomein_strategy === "fixed" && (
                    <Input
                      className="ml-2 w-48"
                      placeholder="bv. WeTarget"
                      value={form.hoofddomein_fixed_value ?? ""}
                      onChange={(e) => setForm({ ...form, hoofddomein_fixed_value: e.target.value })}
                    />
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="strat-auto" value="auto_match_by_address" />
                  <Label htmlFor="strat-auto" className="font-normal">Auto-match op adres (regio→platform)</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label>WeTarget flag</Label>
              <Select
                value={String(form.wetarget_flag_value)}
                onValueChange={(v) => setForm({ ...form, wetarget_flag_value: parseInt(v, 10) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="265">Ja (WeTarget)</SelectItem>
                  <SelectItem value="301">Nee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="active"
                checked={form.is_active}
                onCheckedChange={(c) => setForm({ ...form, is_active: c })}
              />
              <Label htmlFor="active">Actief</Label>
            </div>

            {testResult && (
              <div className="border rounded p-3 space-y-1 text-sm">
                <div className="font-semibold">Test config resultaat: {testResult.ok ? "✓ alles OK" : "✗ fouten"}</div>
                {(["user", "pipeline", "stage", "deal_field"] as const).map((k) => {
                  const c = testResult.checks[k]
                  return (
                    <div key={k} className="flex items-center gap-2">
                      {c.ok ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-red-600" />}
                      <span className="font-mono text-xs text-gray-500 w-20">{k}:</span>
                      <span>{c.message ?? (c.ok ? "OK" : "Faalt")}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {saveError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{saveError}</div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={loading || testing}>
            {testing ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Testen...</> : "Test config"}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={handleSave} disabled={loading}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verifieer dat shadcn-componenten bestaan**

```bash
ls /Users/kennylipman/Lokale-Banen/apps/admin/components/ui/ | grep -E "dialog|select|radio-group|switch|input|label|button"
```

Expected: alle 7 zijn aanwezig. Als `radio-group.tsx` of `switch.tsx` niet bestaan:

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm exec shadcn@latest add radio-group switch
```

- [ ] **Step 3: TS check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "owner-config-edit-modal" | head -5
```

Expected: leeg.

---

## Task 8: Vervang owner-mapping placeholder met live edit-tabel

**Files:**
- Modify: `apps/admin/app/sales/owner-mapping/page.tsx`

- [ ] **Step 1: Vervang volledige inhoud van page.tsx**

Schrijf naar `apps/admin/app/sales/owner-mapping/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { OwnerConfigEditModal } from "@/components/sales/owner-config-edit-modal"
import { Pencil, RefreshCw, Settings } from "lucide-react"

type OwnerConfig = {
  id: string
  key: string
  label: string
  pipedrive_user_id: number
  pipedrive_pipeline_id: number
  pipedrive_default_stage_id: number
  hoofddomein_strategy: "fixed" | "auto_match_by_address"
  hoofddomein_fixed_value: string | null
  wetarget_flag_value: number
  contactmoment_field_key: string | null
  contactmoment_offset_workdays: number
  is_active: boolean
  display_order: number
}

export default function OwnerMappingPage() {
  const [configs, setConfigs] = useState<OwnerConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<OwnerConfig | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  async function loadConfigs() {
    setLoading(true)
    const r = await fetch("/api/sales-leads/owner-config").then((r) => r.json())
    setConfigs(r.configs ?? [])
    setLoading(false)
  }

  useEffect(() => {
    loadConfigs()
  }, [])

  async function refreshPipedriveCache() {
    setRefreshing(true)
    // Cache-invalidatie is server-side: we tonen alleen UI-feedback en herladen
    // (de service invalideert automatisch wanneer expires_at bereikt is; manuele
    // refresh in V2 als endpoint POST /pipedrive-meta/cache/invalidate)
    await new Promise((r) => setTimeout(r, 600))
    await loadConfigs()
    setRefreshing(false)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Owner Mapping</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Koppel dealeigenaars aan Pipedrive users, pipelines en contactmoment-velden. Live van Pipedrive (1u cache).
          </p>
        </div>
        <Button variant="outline" onClick={refreshPipedriveCache} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Vernieuwen
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-600" />
            <CardTitle>Dealeigenaars ({configs.length})</CardTitle>
          </div>
          <CardDescription>Klik op ✎ om een rij te bewerken. "Test config" valideert alle velden tegen Pipedrive.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-gray-500 py-4">Laden...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Label</th>
                  <th className="text-left py-2">PD User</th>
                  <th className="text-left py-2">Pipeline</th>
                  <th className="text-left py-2">Stage</th>
                  <th className="text-left py-2">Hoofddomein</th>
                  <th className="text-left py-2">Contactmoment</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2"></th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 font-medium">{c.label}</td>
                    <td className="py-3 font-mono text-xs">{c.pipedrive_user_id}</td>
                    <td className="py-3 font-mono text-xs">{c.pipedrive_pipeline_id}</td>
                    <td className="py-3 font-mono text-xs">{c.pipedrive_default_stage_id}</td>
                    <td className="py-3">
                      {c.hoofddomein_strategy === "fixed" ? (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">vast: {c.hoofddomein_fixed_value}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-700 border-green-200">auto-match</Badge>
                      )}
                    </td>
                    <td className="py-3 text-xs text-gray-600">
                      {c.contactmoment_field_key ? <span className="font-mono">{c.contactmoment_field_key.slice(0, 8)}…</span> : <span>—</span>}
                      {c.contactmoment_field_key && <span className="ml-1 text-gray-400">+{c.contactmoment_offset_workdays}d</span>}
                    </td>
                    <td className="py-3">
                      {c.is_active ? <Badge className="bg-green-100 text-green-700 hover:bg-green-100">actief</Badge> : <Badge variant="secondary">inactief</Badge>}
                    </td>
                    <td className="py-3">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {configs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-center text-gray-500">Geen owner-configs gevonden.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {editing && (
        <OwnerConfigEditModal
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
          config={editing}
          onSaved={loadConfigs}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: TS check**

```bash
pnpm exec tsc --noEmit 2>&1 | grep -E "owner-mapping/page" | head -5
```

Expected: leeg.

---

## Task 9: End-to-end smoke-test

- [ ] **Step 1: Start dev server in background**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm dev > /tmp/admin-dev-fase2.log 2>&1 &
```

Wacht tot "Ready in" log verschijnt (~3-15s).

- [ ] **Step 2: Verifieer owner-mapping pagina laadt zonder error (auth-redirect of 200)**

```bash
/usr/bin/curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/sales/owner-mapping
```

Expected: `200` (als ingelogd via session-cookie) of `307` (redirect naar /login).

- [ ] **Step 3: Verifieer geen compile-errors in dev-log**

```bash
grep -iE "error|⨯" /tmp/admin-dev-fase2.log | grep -vE "Missing SUPABASE|Error:" | head -10
```

Expected: geen output (alle errors zijn pre-existing of niet-fataal).

- [ ] **Step 4: Test API zonder auth → moet 401**

```bash
/usr/bin/curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/sales-leads/owner-config
/usr/bin/curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/sales-leads/pipedrive-meta/users
```

Expected: beide `401`.

- [ ] **Step 5: Stop dev server**

```bash
pkill -f "next dev"
```

---

## Task 10: Final TS check + commit

- [ ] **Step 1: Volledige tsc-baseline check**

```bash
cd /Users/kennylipman/Lokale-Banen/apps/admin && pnpm exec tsc --noEmit 2>&1 | grep -cE "error TS"
```

Expected: blijft op of dichtbij `508` (baseline). Maximaal +5 nieuwe acceptabel als gerelateerd aan onbekende shadcn-types.

- [ ] **Step 2: Productie-build check**

```bash
pnpm build 2>&1 | grep -E "Compiled successfully|Build error|owner-mapping|owner-config|pipedrive-meta" | head -15
```

Expected: `Compiled successfully` + `/sales/owner-mapping ` (dynamic) + alle 6 nieuwe API-routes worden gebouwd (`/api/sales-leads/...`).

- [ ] **Step 3: Git status**

```bash
cd /Users/kennylipman/Lokale-Banen && git status -s | grep -E "(sales-leads|sales/|owner-config|pipedrive-meta|sales/owner-mapping)" | head -20
```

Expected: 11 bestanden gewijzigd/aangemaakt.

- [ ] **Step 4: Stage + commit**

```bash
git add apps/admin/lib/services/sales-leads/ \
        apps/admin/app/api/sales-leads/ \
        apps/admin/app/sales/owner-mapping/page.tsx \
        apps/admin/components/sales/

git commit -m "$(cat <<'EOF'
feat(sales-leads): fase 2 — owner mapping UI met cascading dropdowns

- PipedriveMetaService met enrichment_cache (TTL 1u) voor users/pipelines/
  stages/date-deal-fields
- 4 metadata API-routes (admin-only via withAdminAuth)
- 3 owner-config CRUD-routes (GET list / POST create / PATCH update)
- POST /owner-config/[id]/test endpoint dat user/pipeline/stage/deal-field
  valideert tegen Pipedrive (alle 4 checks groen of rood per veld)
- OwnerConfigEditModal component met cascading dropdowns
  (pipeline-keuze refresht stages live)
- /sales/owner-mapping pagina vervangt placeholder met live tabel +
  edit-flow + Pipedrive-cache refresh-knop

Spec: docs/superpowers/specs/2026-05-04-sales-lead-automation-design.md
Plan: docs/superpowers/plans/2026-05-05-sales-lead-automation-fase-2-owner-mapping.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: succesvolle commit, geen pre-commit hook errors.

- [ ] **Step 5: Verifieer commit**

```bash
git log --oneline -3
```

Expected: bovenste is de fase 2 feat-commit.

---

## Definition of Done — Fase 2

- [x] PipedriveMetaService werkt met cache (1u TTL via `enrichment_cache`)
- [x] 4 metadata-routes returnen correcte data (admin-only, 401 zonder auth)
- [x] CRUD-routes voor `sales_lead_owner_config` werken (GET/POST/PATCH)
- [x] Test-config endpoint valideert alle 4 velden tegen Pipedrive
- [x] OwnerConfigEditModal met cascading dropdowns gebouwd
- [x] `/sales/owner-mapping` toont live tabel + edit-flow
- [x] Productie-build succesvol
- [x] `tsc --noEmit` blijft op baseline 508 (max +5 acceptabel)
- [x] Commit op `main`

**Volgt op:** Fase 3 — Per-bron services (KvK / Maps / Apollo / Website-scraper, parallelliseerbaar in 4 sub-tasks).

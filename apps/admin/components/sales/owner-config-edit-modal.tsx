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
import { authFetch } from "@/lib/authenticated-fetch"

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
      authFetch("/api/sales-leads/pipedrive-meta/users").then((r) => r.json()),
      authFetch("/api/sales-leads/pipedrive-meta/pipelines").then((r) => r.json()),
      authFetch("/api/sales-leads/pipedrive-meta/deal-fields").then((r) => r.json()),
      authFetch(`/api/sales-leads/pipedrive-meta/stages?pipeline_id=${form.pipedrive_pipeline_id}`).then((r) => r.json()),
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
    const r = await authFetch(`/api/sales-leads/pipedrive-meta/stages?pipeline_id=${newPipelineId}`).then((r) => r.json())
    setStages(r.stages ?? [])
  }

  async function handleTest() {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await authFetch(`/api/sales-leads/owner-config/${config.id}/test`, { method: "POST" }).then((r) => r.json())
      setTestResult(r)
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    setSaveError(null)
    const res = await authFetch(`/api/sales-leads/owner-config/${config.id}`, {
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
                  <Label htmlFor="strat-auto" className="font-normal">Auto-match op adres (regio&rarr;platform)</Label>
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
                <div className="font-semibold">Test config resultaat: {testResult.ok ? "alles OK" : "fouten"}</div>
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

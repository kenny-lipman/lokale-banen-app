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
    const r = await authFetch("/api/sales-leads/owner-config").then((r) => r.json())
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

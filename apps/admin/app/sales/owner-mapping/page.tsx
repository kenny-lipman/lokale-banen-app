import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { Settings } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function OwnerMappingPage() {
  const supabase = createServiceRoleClient()
  const { data: configs } = await supabase
    .from("sales_lead_owner_config")
    .select("*")
    .order("display_order", { ascending: true })

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Owner Mapping</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Koppel dealeigenaars aan Pipedrive users, pipelines en contactmoment-velden.
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-600" />
            <CardTitle>In ontwikkeling — fase 2</CardTitle>
          </div>
          <CardDescription>
            UI met cascading dropdowns + edit-modal komt in fase 2. Hieronder de huidige seed-data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Label</th>
                <th className="text-left py-2">PD User</th>
                <th className="text-left py-2">Pipeline</th>
                <th className="text-left py-2">Stage</th>
                <th className="text-left py-2">Hoofddomein</th>
                <th className="text-left py-2">WeTarget flag</th>
              </tr>
            </thead>
            <tbody>
              {configs?.map((c) => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 font-medium">{c.label}</td>
                  <td className="py-2 font-mono text-xs">{c.pipedrive_user_id}</td>
                  <td className="py-2 font-mono text-xs">{c.pipedrive_pipeline_id}</td>
                  <td className="py-2 font-mono text-xs">{c.pipedrive_default_stage_id}</td>
                  <td className="py-2">
                    {c.hoofddomein_strategy === "fixed" ? (
                      <span className="text-orange-600">vast: {c.hoofddomein_fixed_value}</span>
                    ) : (
                      <span className="text-green-700">auto-match</span>
                    )}
                  </td>
                  <td className="py-2">{c.wetarget_flag_value === 265 ? "Ja" : "Nee"}</td>
                </tr>
              ))}
              {!configs?.length && (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-gray-500">
                    Geen owner-configs gevonden — voer task 3 seed uit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

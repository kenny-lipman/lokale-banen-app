import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { createServiceRoleClient } from "@/lib/supabase-server"
import { Monitor } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function ScrapeBronnenPage() {
  const supabase = createServiceRoleClient()
  const { data: sources } = await supabase
    .from("job_sources")
    .select("id, name, scraping_method, active, kind, company_id, url, last_scraped_at")
    .order("kind", { ascending: true })
    .order("name", { ascending: true })

  const aggregators = sources?.filter((s) => s.kind === "aggregator") ?? []
  const careerPages = sources?.filter((s) => s.kind === "company_career_page") ?? []

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Scrape-bronnen</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Alle vacature-bronnen die wij scrapen — aggregator-platforms en bedrijfs-werkenbij-pagina's.
        </p>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-orange-600" />
            <CardTitle>In ontwikkeling — fase 6</CardTitle>
          </div>
          <CardDescription>
            Volledige UI met filters, edit-modal en monitoring komt in fase 6. Hieronder de huidige bronnen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <h3 className="font-semibold mb-2">Aggregator-platforms ({aggregators.length})</h3>
          <table className="w-full text-sm mb-6">
            <thead className="text-xs uppercase text-gray-500 border-b">
              <tr>
                <th className="text-left py-2">Naam</th>
                <th className="text-left py-2">Methode</th>
                <th className="text-left py-2">Actief</th>
              </tr>
            </thead>
            <tbody>
              {aggregators.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="py-2 text-gray-600">{s.scraping_method ?? "—"}</td>
                  <td className="py-2">{s.active ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="font-semibold mb-2">Bedrijfs-werkenbij-pagina's ({careerPages.length})</h3>
          {careerPages.length === 0 ? (
            <p className="text-sm text-gray-500">
              Nog geen career-pages — worden aangemaakt bij elke succesvolle Sales Lead Sync.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">URL</th>
                  <th className="text-left py-2">Laatst gescrapet</th>
                </tr>
              </thead>
              <tbody>
                {careerPages.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="py-2 font-mono text-xs">{s.url}</td>
                    <td className="py-2 text-gray-600">{s.last_scraped_at ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

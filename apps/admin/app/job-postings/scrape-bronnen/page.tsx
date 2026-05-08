import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { CareerPagesTable } from '@/components/scrape-bronnen/career-pages-table'

export const dynamic = 'force-dynamic'

export default async function ScrapeBronnenPage() {
  const supabase = createServiceRoleClient()
  const [{ data: aggregators }, { count: careerCount }] = await Promise.all([
    supabase
      .from('job_sources')
      .select('id, name, scraping_method, active, last_scraped_at, last_scrape_status')
      .eq('kind', 'aggregator')
      .order('name', { ascending: true }),
    supabase
      .from('job_sources')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'company_career_page'),
  ])

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Scrape-bronnen</h1>
        <p className="text-sm text-slate-500 mt-1">
          Alle bronnen waar wij vacatures van scrapen — aggregator-platforms en bedrijfs-werkenbij-pagina&apos;s.
        </p>
      </div>

      <Tabs defaultValue="career-pages" className="w-full">
        <TabsList>
          <TabsTrigger value="career-pages">
            Werken-bij pagina&apos;s <span className="ml-1 text-xs">({careerCount ?? 0})</span>
          </TabsTrigger>
          <TabsTrigger value="aggregators">
            Aggregators <span className="ml-1 text-xs">({aggregators?.length ?? 0})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="career-pages" className="mt-4">
          <CareerPagesTable />
        </TabsContent>

        <TabsContent value="aggregators" className="mt-4">
          <div className="border rounded-lg overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Naam</th>
                  <th className="text-left py-2 font-medium">Methode</th>
                  <th className="text-left py-2 font-medium">Laatst gescrapet</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Actief</th>
                </tr>
              </thead>
              <tbody>
                {(aggregators ?? []).map((s) => (
                  <tr key={s.id} className="border-b hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{s.name}</td>
                    <td className="py-2 text-slate-600">{s.scraping_method ?? '—'}</td>
                    <td className="py-2 text-slate-600">
                      {s.last_scraped_at ? new Date(s.last_scraped_at).toLocaleDateString('nl-NL') : '—'}
                    </td>
                    <td className="py-2 text-slate-600">{s.last_scrape_status ?? '—'}</td>
                    <td className="px-4 py-2">{s.active ? '✓' : '—'}</td>
                  </tr>
                ))}
                {(!aggregators || aggregators.length === 0) && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-500">Geen aggregators</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

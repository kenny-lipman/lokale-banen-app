"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CompaniesTable } from "@/components/companies-table"
import { CompanyDrawer } from "@/components/company-drawer"
import { CompanyStats } from "@/components/company-stats"

export default function CompaniesPage() {
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
            <p className="text-gray-600 mt-2">Beheer alle bedrijven en hun vacatures</p>
          </div>
        </div>
      </div>

      {/* Company Statistics */}
      <CompanyStats refreshKey={statsRefreshKey} />

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bedrijfsoverzicht</CardTitle>
          <CardDescription>Alle bedrijven in de database</CardDescription>
        </CardHeader>
        <CardContent>
          <CompaniesTable onCompanyClick={setSelectedCompany} onStatusChange={() => setStatsRefreshKey(k => k + 1)} />
        </CardContent>
      </Card>

      {/* Company Detail Drawer */}
      <CompanyDrawer company={selectedCompany} open={!!selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  )
}

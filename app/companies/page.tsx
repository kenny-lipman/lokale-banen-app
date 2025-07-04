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

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
            <p className="text-gray-600 mt-2">Beheer alle bedrijven en hun vacatures</p>
          </div>
          <Button className="bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4 mr-2" />
            Nieuw Bedrijf
          </Button>
        </div>
      </div>

      {/* Company Statistics */}
      <CompanyStats />

      {/* Companies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Bedrijfsoverzicht</CardTitle>
          <CardDescription>Alle bedrijven in de database</CardDescription>
        </CardHeader>
        <CardContent>
          <CompaniesTable onCompanyClick={setSelectedCompany} />
        </CardContent>
      </Card>

      {/* Company Detail Drawer */}
      <CompanyDrawer company={selectedCompany} open={!!selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  )
}

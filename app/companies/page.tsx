"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { CompaniesTabContainer } from "@/components/companies-tab-container"
import { CompanyDrawer } from "@/components/company-drawer"
import { CompanyStats } from "@/components/company-stats"
import { CompaniesFilters } from "@/components/companies-filters"
import { supabaseService } from "@/lib/supabase-service"

export default function CompaniesPage() {
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [statsRefreshKey, setStatsRefreshKey] = useState(0);

  // Filter state (preserve all existing filters)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [sourceFilter, setSourceFilter] = useState<string[]>([])
  const [customerFilter, setCustomerFilter] = useState("all")
  const [websiteFilter, setWebsiteFilter] = useState("all")
  const [categorySizeFilter, setCategorySizeFilter] = useState<string[]>([])
  const [apolloEnrichedFilter, setApolloEnrichedFilter] = useState("all")
  const [hasContactsFilter, setHasContactsFilter] = useState("all")
  const [regioPlatformFilter, setRegioPlatformFilter] = useState<string[]>([])

  // Filter data state
  const [allSources, setAllSources] = useState<{id: string, name: string}[]>([])
  const [allRegioPlatformOptions, setAllRegioPlatformOptions] = useState<{value: string, label: string, key: string}[]>([])
  const [totalCompaniesCount, setTotalCompaniesCount] = useState(0)

  // Load filter data
  useEffect(() => {
    const loadFilterData = async () => {
      try {
        // Load all sources
        const sources = await supabaseService.getCompanySources()
        setAllSources(sources)

        // Load regio platform options
        const platforms = await supabaseService.getUniqueRegioPlatforms()
        const platformOptions = platforms.map((platform, index) => ({
          value: platform,
          label: platform,
          key: `${platform}-${index}`
        }))
        setAllRegioPlatformOptions(platformOptions)

        // Load total count for filter display
        const result = await supabaseService.getCompanies({ limit: 1 })
        setTotalCompaniesCount(result.count || 0)
      } catch (error) {
        console.error('Error loading filter data:', error)
      }
    }

    loadFilterData()
  }, [])

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Companies</h1>
            <p className="text-gray-600 mt-2">Beheer alle bedrijven en hun qualification workflow</p>
          </div>
        </div>
      </div>

      {/* Company Statistics */}
      <CompanyStats refreshKey={statsRefreshKey} />

      {/* Companies Filters */}
      <div className="mb-6">
        <CompaniesFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          sourceFilter={sourceFilter}
          setSourceFilter={setSourceFilter}
          customerFilter={customerFilter}
          setCustomerFilter={setCustomerFilter}
          websiteFilter={websiteFilter}
          setWebsiteFilter={setWebsiteFilter}
          categorySizeFilter={categorySizeFilter}
          setCategorySizeFilter={setCategorySizeFilter}
          apolloEnrichedFilter={apolloEnrichedFilter}
          setApolloEnrichedFilter={setApolloEnrichedFilter}
          hasContactsFilter={hasContactsFilter}
          setHasContactsFilter={setHasContactsFilter}
          regioPlatformFilter={regioPlatformFilter}
          setRegioPlatformFilter={setRegioPlatformFilter}
          totalCount={totalCompaniesCount}
          allSources={allSources}
          allRegioPlatformOptions={allRegioPlatformOptions}
        />
      </div>

      {/* Companies Qualification Management */}
      <CompaniesTabContainer 
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        sourceFilter={sourceFilter}
        customerFilter={customerFilter}
        websiteFilter={websiteFilter}
        categorySizeFilter={categorySizeFilter}
        apolloEnrichedFilter={apolloEnrichedFilter}
        hasContactsFilter={hasContactsFilter}
        regioPlatformFilter={regioPlatformFilter}
        onCompanyClick={setSelectedCompany}
      />

      {/* Company Detail Drawer */}
      <CompanyDrawer company={selectedCompany} open={!!selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  )
}

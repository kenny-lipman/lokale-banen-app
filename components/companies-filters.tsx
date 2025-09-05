"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TableFilters } from "@/components/ui/table-filters"

interface CompaniesFiltersProps {
  searchTerm: string
  setSearchTerm: (value: string) => void
  statusFilter: string
  setStatusFilter: (value: string) => void
  sourceFilter: string
  setSourceFilter: (value: string) => void
  customerFilter: string
  setCustomerFilter: (value: string) => void
  websiteFilter: string
  setWebsiteFilter: (value: string) => void
  categorySizeFilter: string
  setCategorySizeFilter: (value: string) => void
  apolloEnrichedFilter: string
  setApolloEnrichedFilter: (value: string) => void
  hasContactsFilter: string
  setHasContactsFilter: (value: string) => void
  regioPlatformFilter: string
  setRegioPlatformFilter: (value: string) => void
  totalCount: number
  allSources: {id: string, name: string}[]
  allRegioPlatformOptions: {value: string, label: string, key: string}[]
  onResetPage?: () => void
}

export function CompaniesFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  sourceFilter,
  setSourceFilter,
  customerFilter,
  setCustomerFilter,
  websiteFilter,
  setWebsiteFilter,
  categorySizeFilter,
  setCategorySizeFilter,
  apolloEnrichedFilter,
  setApolloEnrichedFilter,
  hasContactsFilter,
  setHasContactsFilter,
  regioPlatformFilter,
  setRegioPlatformFilter,
  totalCount,
  allSources,
  allRegioPlatformOptions,
  onResetPage
}: CompaniesFiltersProps) {
  
  const handleResetFilters = () => {
    setSearchTerm("")
    setStatusFilter("all")
    setSourceFilter("all")
    setCustomerFilter("all")
    setWebsiteFilter("all")
    setCategorySizeFilter("all")
    setApolloEnrichedFilter("all")
    setHasContactsFilter("all")
    setRegioPlatformFilter("all")
    onResetPage?.()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filters & Search</CardTitle>
        <CardDescription>Filter bedrijven op verschillende criteria</CardDescription>
      </CardHeader>
      <CardContent>
        <TableFilters
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Zoek op bedrijf of locatie..."
          totalCount={totalCount}
          resultText="bedrijven"
          onResetFilters={handleResetFilters}
          filters={[
            {
              id: "source",
              label: "Bron",
              value: sourceFilter,
              onValueChange: setSourceFilter,
              options: [
                { value: "all", label: "Alle bronnen" },
                ...allSources.map((s) => ({ value: s.id, label: s.name }))
              ],
              placeholder: "Filter op bron"
            },
            {
              id: "categorySize",
              label: "Grootte",
              value: categorySizeFilter,
              onValueChange: setCategorySizeFilter,
              options: [
                { value: "all", label: "Alle groottes" },
                { value: "Klein", label: "Klein" },
                { value: "Middel", label: "Middel" },
                { value: "Groot", label: "Groot" },
                { value: "Onbekend", label: "Onbekend" }
              ],
              placeholder: "Filter op grootte"
            },
            {
              id: "status",
              label: "Status",
              value: statusFilter,
              onValueChange: setStatusFilter,
              options: [
                { value: "all", label: "Alle statussen" },
                { value: "Prospect", label: "Prospect" },
                { value: "Qualified", label: "Qualified" },
                { value: "Disqualified", label: "Disqualified" }
              ],
              placeholder: "Filter op status"
            },
            {
              id: "apolloEnriched",
              label: "Apollo",
              value: apolloEnrichedFilter,
              onValueChange: setApolloEnrichedFilter,
              options: [
                { value: "all", label: "Verrijkt met Apollo" },
                { value: "enriched", label: "Verrijkt" },
                { value: "not_enriched", label: "Niet verrijkt" }
              ],
              placeholder: "Filter op Apollo"
            },
            {
              id: "hasContacts",
              label: "Contacten",
              value: hasContactsFilter,
              onValueChange: setHasContactsFilter,
              options: [
                { value: "all", label: "Contacten" },
                { value: "with_contacts", label: "Met contacten" },
                { value: "no_contacts", label: "Zonder contacten" }
              ],
              placeholder: "Filter op contacten"
            },
            {
              id: "website",
              label: "Website",
              value: websiteFilter,
              onValueChange: setWebsiteFilter,
              options: [
                { value: "all", label: "Website" },
                { value: "with", label: "Met website" },
                { value: "without", label: "Zonder website" }
              ],
              placeholder: "Filter op website"
            },
            {
              id: "regioPlatform",
              label: "Hoofddomein",
              value: regioPlatformFilter,
              onValueChange: setRegioPlatformFilter,
              options: [
                { value: "all", label: "Alle hoofddomeinen" },
                { value: "none", label: "Geen hoofddomein" },
                ...allRegioPlatformOptions
              ],
              placeholder: "Filter op hoofddomein"
            }
          ]}
        />
      </CardContent>
    </Card>
  )
}
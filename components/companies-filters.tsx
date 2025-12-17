"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MultiSelect } from "@/components/ui/multi-select"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, RotateCcw, X } from "lucide-react"
import { DateRangeFilter } from "@/components/ui/table-filters"

interface CompaniesFiltersProps {
  searchTerm: string
  setSearchTerm: (value: string) => void
  statusFilter: string[]
  setStatusFilter: (value: string[]) => void
  sourceFilter: string[]
  setSourceFilter: (value: string[]) => void
  customerFilter: string
  setCustomerFilter: (value: string) => void
  websiteFilter: string
  setWebsiteFilter: (value: string) => void
  categorySizeFilter: string[]
  setCategorySizeFilter: (value: string[]) => void
  apolloEnrichedFilter: string
  setApolloEnrichedFilter: (value: string) => void
  hasContactsFilter: string
  setHasContactsFilter: (value: string) => void
  regioPlatformFilter: string[]
  setRegioPlatformFilter: (value: string[]) => void
  pipedriveFilter: string
  setPipedriveFilter: (value: string) => void
  instantlyFilter: string
  setInstantlyFilter: (value: string) => void
  dateFrom: string | null
  setDateFrom: (value: string | null) => void
  dateTo: string | null
  setDateTo: (value: string | null) => void
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
  pipedriveFilter,
  setPipedriveFilter,
  instantlyFilter,
  setInstantlyFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  totalCount,
  allSources,
  allRegioPlatformOptions,
  onResetPage
}: CompaniesFiltersProps) {

  const handleResetFilters = () => {
    setSearchTerm("")
    setStatusFilter([])
    setSourceFilter([])
    setCustomerFilter("all")
    setWebsiteFilter("all")
    setCategorySizeFilter([])
    setApolloEnrichedFilter("all")
    setHasContactsFilter("all")
    setRegioPlatformFilter([])
    setPipedriveFilter("all")
    setInstantlyFilter("all")
    setDateFrom(null)
    setDateTo(null)
    onResetPage?.()
  }

  // Count active filters
  const getActiveFilterCount = () => {
    let count = 0
    if (searchTerm) count++
    if (statusFilter.length > 0) count++
    if (sourceFilter.length > 0) count++
    if (customerFilter !== "all") count++
    if (websiteFilter !== "all") count++
    if (categorySizeFilter.length > 0) count++
    if (apolloEnrichedFilter !== "all") count++
    if (hasContactsFilter !== "all") count++
    if (regioPlatformFilter.length > 0) count++
    if (pipedriveFilter !== "all") count++
    if (instantlyFilter !== "all") count++
    if (dateFrom || dateTo) count++
    return count
  }

  const activeFilterCount = getActiveFilterCount()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Filters & Search</CardTitle>
            <CardDescription>Filter bedrijven op verschillende criteria</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{totalCount} bedrijven</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary">{activeFilterCount} filters actief</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Active Filters Display */}
        {activeFilterCount > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-orange-900">
                  Actieve filters ({activeFilterCount}):
                </span>
                {searchTerm && (
                  <Badge variant="secondary" className="gap-1">
                    Zoekterm: "{searchTerm}"
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setSearchTerm("")}
                    />
                  </Badge>
                )}
                {statusFilter.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    Status: {statusFilter.length} geselecteerd
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setStatusFilter([])}
                    />
                  </Badge>
                )}
                {sourceFilter.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    Bron: {sourceFilter.length} geselecteerd
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setSourceFilter([])}
                    />
                  </Badge>
                )}
                {categorySizeFilter.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    Grootte: {categorySizeFilter.length} geselecteerd
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setCategorySizeFilter([])}
                    />
                  </Badge>
                )}
                {regioPlatformFilter.length > 0 && (
                  <Badge variant="secondary" className="gap-1">
                    Hoofddomein: {regioPlatformFilter.length} geselecteerd
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setRegioPlatformFilter([])}
                    />
                  </Badge>
                )}
                {customerFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Klant: {customerFilter === "customers" ? "Ja" : "Nee"}
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setCustomerFilter("all")}
                    />
                  </Badge>
                )}
                {websiteFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Website: {websiteFilter === "with" ? "Met" : "Zonder"}
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setWebsiteFilter("all")}
                    />
                  </Badge>
                )}
                {apolloEnrichedFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Apollo: {apolloEnrichedFilter === "enriched" ? "Verrijkt" : "Niet verrijkt"}
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setApolloEnrichedFilter("all")}
                    />
                  </Badge>
                )}
                {hasContactsFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Contacten: {hasContactsFilter === "with_contacts" ? "Met" : "Zonder"}
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setHasContactsFilter("all")}
                    />
                  </Badge>
                )}
                {pipedriveFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Pipedrive: {pipedriveFilter === "synced" ? "Gesynchroniseerd" : "Niet gesynchroniseerd"}
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setPipedriveFilter("all")}
                    />
                  </Badge>
                )}
                {instantlyFilter !== "all" && (
                  <Badge variant="secondary" className="gap-1">
                    Instantly: {instantlyFilter === "synced" ? "Gesynchroniseerd" : "Niet gesynchroniseerd"}
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => setInstantlyFilter("all")}
                    />
                  </Badge>
                )}
                {(dateFrom || dateTo) && (
                  <Badge variant="secondary" className="gap-1">
                    Aangemaakt: {dateFrom && dateTo
                      ? `${new Date(dateFrom).toLocaleDateString('nl-NL')} - ${new Date(dateTo).toLocaleDateString('nl-NL')}`
                      : dateFrom
                        ? `Vanaf ${new Date(dateFrom).toLocaleDateString('nl-NL')}`
                        : `Tot ${new Date(dateTo!).toLocaleDateString('nl-NL')}`
                    }
                    <X
                      className="h-3 w-3 cursor-pointer ml-1"
                      onClick={() => { setDateFrom(null); setDateTo(null); }}
                    />
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-orange-700 hover:text-orange-900"
              >
                Alles wissen
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Zoek op bedrijf of locatie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Source Filter - Multi-select */}
          <MultiSelect
            options={allSources.map((s) => ({ value: s.id, label: s.name }))}
            selected={sourceFilter}
            onChange={setSourceFilter}
            placeholder="Bron"
          />

          {/* Category Size Filter - Multi-select */}
          <MultiSelect
            options={[
              { value: "Klein", label: "Klein" },
              { value: "Middel", label: "Middel" },
              { value: "Groot", label: "Groot" },
              { value: "Onbekend", label: "Onbekend" }
            ]}
            selected={categorySizeFilter}
            onChange={setCategorySizeFilter}
            placeholder="Grootte"
          />

          {/* Status Filter - Multi-select */}
          <MultiSelect
            options={[
              { value: "Prospect", label: "Prospect" },
              { value: "Qualified", label: "Qualified" },
              { value: "Disqualified", label: "Disqualified" }
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
            placeholder="Status"
          />

          {/* Apollo Enriched Filter */}
          <Select value={apolloEnrichedFilter} onValueChange={setApolloEnrichedFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Apollo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Apollo</SelectItem>
              <SelectItem value="enriched">Verrijkt</SelectItem>
              <SelectItem value="not_enriched">Niet verrijkt</SelectItem>
            </SelectContent>
          </Select>

          {/* Has Contacts Filter */}
          <Select value={hasContactsFilter} onValueChange={setHasContactsFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Contacten" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Contacten</SelectItem>
              <SelectItem value="with_contacts">Met contacten</SelectItem>
              <SelectItem value="no_contacts">Zonder contacten</SelectItem>
            </SelectContent>
          </Select>

          {/* Website Filter */}
          <Select value={websiteFilter} onValueChange={setWebsiteFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Website" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Website</SelectItem>
              <SelectItem value="with">Met website</SelectItem>
              <SelectItem value="without">Zonder website</SelectItem>
            </SelectContent>
          </Select>

          {/* Regio Platform Filter - Multi-select */}
          <MultiSelect
            options={[
              { value: "none", label: "Geen hoofddomein" },
              ...allRegioPlatformOptions.map(p => ({ value: p.value, label: p.label }))
            ]}
            selected={regioPlatformFilter}
            onChange={setRegioPlatformFilter}
            placeholder="Hoofddomein"
          />

          {/* Pipedrive Filter */}
          <Select value={pipedriveFilter} onValueChange={setPipedriveFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Pipedrive" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Pipedrive</SelectItem>
              <SelectItem value="synced">In Pipedrive</SelectItem>
              <SelectItem value="not_synced">Niet in Pipedrive</SelectItem>
            </SelectContent>
          </Select>

          {/* Instantly Filter */}
          <Select value={instantlyFilter} onValueChange={setInstantlyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Instantly" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Instantly</SelectItem>
              <SelectItem value="synced">In Instantly</SelectItem>
              <SelectItem value="not_synced">Niet in Instantly</SelectItem>
            </SelectContent>
          </Select>

          {/* Date Range Filter */}
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            label="Aangemaakt op"
          />

          {/* Reset Filters Button */}
          <Button
            variant="outline"
            onClick={handleResetFilters}
            className="w-full flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

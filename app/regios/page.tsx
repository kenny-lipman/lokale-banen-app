"use client"

import { useEffect, useState } from "react"
import { Input } from "@/components/ui/input"
import { Table, TableHead, TableHeader, TableRow, TableCell, TableBody } from "@/components/ui/table"
import { supabaseService } from "@/lib/supabase-service"
import { Search, ChevronDown, ChevronRight, ArrowUpDown, ChevronUp, ChevronDown as ChevronDownIcon } from "lucide-react"
import React from "react"
import { useRegionsCache } from "@/hooks/use-regions-cache"
import { Button } from "@/components/ui/button"
import { TablePagination } from "@/components/ui/table-filters"

interface Region {
  id: string
  regio_platform: string
  plaats: string
  postcode: string
  created_at: string
  job_postings_count?: number
}

export default function RegionsPage() {
  // Vervang useState/useEffect door cache hook
  const { data: regions, loading, error, refetch } = useRegionsCache()
  const [searchTerm, setSearchTerm] = useState("")
  const [expanded, setExpanded] = useState<{ [plaats: string]: boolean }>({})
  const [orderBy, setOrderBy] = useState<'plaats' | 'vacatures'>("plaats")
  const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>("asc")
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  // Client-side filter op plaats, regio_platform of postcode
  const filteredRegions = (regions || []).filter((region: Region) => {
    const term = searchTerm.toLowerCase()
    return (
      region.plaats.toLowerCase().includes(term) ||
      region.regio_platform.toLowerCase().includes(term) ||
      region.postcode.toLowerCase().includes(term)
    )
  })

  // Groepeer per plaats
  const grouped = filteredRegions.reduce((acc: Record<string, Region[]>, region: Region) => {
    if (!acc[region.plaats]) acc[region.plaats] = []
    acc[region.plaats].push(region)
    return acc
  }, {})

  // Sorteer de plaatsen op basis van orderBy/orderDirection
  const sortedPlaatsen = Object.entries(grouped).sort(([plaatsA, regionsA], [plaatsB, regionsB]) => {
    if (orderBy === "vacatures") {
      const totalA = (regionsA as Region[]).reduce((sum: number, r: Region) => sum + (r.job_postings_count ?? 0), 0)
      const totalB = (regionsB as Region[]).reduce((sum: number, r: Region) => sum + (r.job_postings_count ?? 0), 0)
      return orderDirection === "asc" ? totalA - totalB : totalB - totalA
    } else {
      return orderDirection === "asc"
        ? plaatsA.localeCompare(plaatsB, "nl")
        : plaatsB.localeCompare(plaatsA, "nl")
    }
  })

  // Expand/collapse gedrag
  useEffect(() => {
    if (searchTerm) {
      // Expand alles bij zoeken
      const allExpanded: { [plaats: string]: boolean } = {}
      Object.keys(grouped).forEach((plaats) => {
        allExpanded[plaats] = true
      })
      setExpanded(allExpanded)
    } else {
      // Collapse alles als er niet gezocht wordt
      const allCollapsed: { [plaats: string]: boolean } = {}
      Object.keys(grouped).forEach((plaats) => {
        allCollapsed[plaats] = false
      })
      setExpanded(allCollapsed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, Object.keys(grouped).join(",")])

  const toggleExpand = (plaats: string) => {
    setExpanded((prev) => ({ ...prev, [plaats]: !prev[plaats] }))
  }

  // Na sorteren/groeperen:
  const sortedPlaatsenArray = sortedPlaatsen as [string, Region[]][];
  const totalRows = sortedPlaatsenArray.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / itemsPerPage));
  const pagedPlaatsen = sortedPlaatsenArray.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Regio's</h1>
        <p className="text-gray-600 mt-2">Overzicht van alle regio's in de database</p>
      </div>
      {/* Zoekveld met icoon */}
      <div className="mb-4 max-w-md relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          placeholder="Zoek op plaats, regio platform of postcode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Plaats</TableHead>
              <TableHead>Postcode</TableHead>
              <TableHead>Regio platform</TableHead>
              <TableHead>Aangemaakt op</TableHead>
              <TableHead>ID</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => {
                  if (orderBy === "vacatures") {
                    setOrderDirection(orderDirection === "desc" ? "asc" : "desc")
                  } else {
                    setOrderBy("vacatures")
                    setOrderDirection("desc")
                  }
                }}
              >
                Vacatures
                {orderBy !== "vacatures" && <ArrowUpDown className="inline w-4 h-4 ml-1 text-gray-400" />}
                {orderBy === "vacatures" && orderDirection === "asc" && <ChevronUp className="inline w-4 h-4 ml-1 text-gray-600" />}
                {orderBy === "vacatures" && orderDirection === "desc" && <ChevronDownIcon className="inline w-4 h-4 ml-1 text-gray-600" />}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <TableRow key={idx}>
                  {Array.from({ length: 7 }).map((_, cellIdx) => (
                    <TableCell key={cellIdx}>
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : Object.keys(grouped).length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  Geen regio's gevonden
                </TableCell>
              </TableRow>
            ) : (
              (pagedPlaatsen as [string, Region[]][]).map(([plaats, plaatsRegions]: [string, Region[]]) => {
                // Totaal aantal vacatures voor deze plaats (som van alle regio's onder deze plaats)
                const totalVacatures = plaatsRegions.reduce((sum: number, r: Region) => sum + (r.job_postings_count ?? 0), 0)
                return (
                  <React.Fragment key={plaats}>
                    <TableRow key={plaats} className="bg-orange-50 hover:bg-orange-100 text-base md:text-sm h-10">
                      <TableCell className="text-center py-1">
                        <button
                          aria-label={expanded[plaats] ? "Collapse" : "Expand"}
                          onClick={() => toggleExpand(plaats)}
                          className="focus:outline-none"
                        >
                          {expanded[plaats] ? (
                            <ChevronDown className="w-4 h-4 text-orange-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-orange-500" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="font-semibold text-base md:text-sm py-1">{plaats}</TableCell>
                      <TableCell></TableCell>
                      {/* Regio platform kolom */}
                      <TableCell className="text-sm text-gray-700">
                        {Array.from(new Set(plaatsRegions.map((r: Region) => r.regio_platform))).join(", ")}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="font-semibold text-base md:text-sm py-1 text-right">{totalVacatures}</TableCell>
                    </TableRow>
                    {expanded[plaats] &&
                      plaatsRegions.map((region: Region) => (
                        <TableRow key={region.id} className="hover:bg-orange-50">
                          <TableCell></TableCell>
                          <TableCell className="font-medium">{region.plaats}</TableCell>
                          <TableCell>{region.postcode}</TableCell>
                          <TableCell>{region.regio_platform}</TableCell>
                          <TableCell>{region.created_at ? new Date(region.created_at).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }) : '-'}</TableCell>
                          <TableCell className="text-xs text-gray-400">{region.id}</TableCell>
                          <TableCell className="text-right">{region.job_postings_count ?? 0}</TableCell>
                        </TableRow>
                      ))}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      {/* Pagination */}
      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalRows}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={(items) => {
          setItemsPerPage(items)
          setCurrentPage(1)
        }}
      />
    </div>
  )
} 
"use client"

import { ReactNode } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Search, Filter, RotateCcw, SlidersHorizontal } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface FilterProps {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
}

interface TableFiltersProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  filters?: FilterProps[]
  bulkActions?: ReactNode
  totalCount?: number
  resultText?: string
  className?: string
  onResetFilters?: () => void
  children?: ReactNode
}

export function TableFilters({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Zoeken...",
  filters = [],
  bulkActions,
  totalCount,
  resultText,
  className = "",
  onResetFilters,
  children
}: TableFiltersProps) {
  const hasActiveFilters = filters.some(filter => filter.value !== "all" && filter.value !== "")
  const showResults = totalCount !== undefined

  return (
    <Card className={`p-4 bg-gradient-to-r from-gray-50 to-gray-100/50 border ${className}`}>
      <div className="space-y-4">
        {/* Header with Search and Reset */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-white"
              />
            </div>

            {/* Results Count */}
            {showResults && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white">
                  {totalCount === 0 ? "Geen resultaten" : `${totalCount} ${resultText || "resultaten"}`}
                </Badge>
              </div>
            )}
          </div>

          {/* Reset Filters Button */}
          {hasActiveFilters && onResetFilters && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onResetFilters}
              className="bg-white hover:bg-gray-50"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset filters
            </Button>
          )}
        </div>

        {/* Filters Row */}
        {filters.length > 0 && (
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
              <SlidersHorizontal className="w-4 h-4" />
              Filters:
            </div>
            <div className="flex flex-wrap gap-3 flex-1">
              {filters.map((filter) => (
                <Select 
                  key={filter.id} 
                  value={filter.value} 
                  onValueChange={filter.onValueChange}
                >
                  <SelectTrigger className={`w-44 bg-white ${filter.className || ""}`}>
                    <SelectValue placeholder={filter.placeholder || filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {bulkActions && (
          <div className="border-t pt-4">
            {bulkActions}
          </div>
        )}

        {/* Custom Children */}
        {children}
      </div>
    </Card>
  )
}

// Utility component for pagination
interface TablePaginationProps {
  currentPage: number
  totalPages: number
  totalCount: number
  itemsPerPage: number
  onPageChange: (page: number) => void
  onItemsPerPageChange: (items: number) => void
  className?: string
}

export function TablePagination({
  currentPage,
  totalPages,
  totalCount,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  className = ""
}: TablePaginationProps) {
  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${className}`}>
      {/* Info & Items per page */}
      <div className="flex items-center gap-4 text-sm text-gray-600">
        <span>
          Pagina {currentPage} van {totalPages} ({totalCount} totaal)
        </span>
        <div className="flex items-center gap-2">
          <label>Per pagina:</label>
          <Select value={itemsPerPage.toString()} onValueChange={(value) => onItemsPerPageChange(Number(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 15, 20, 30, 50, 100].map(num => (
                <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Page Navigation */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          Vorige
        </Button>
        
        {/* Page Numbers */}
        {Array.from({ length: Math.min(totalPages, 5) }).map((_, idx) => {
          let page: number
          if (totalPages <= 5) {
            page = idx + 1
          } else if (currentPage <= 3) {
            page = idx + 1
          } else if (currentPage >= totalPages - 2) {
            page = totalPages - 4 + idx
          } else {
            page = currentPage - 2 + idx
          }

          const isCurrent = page === currentPage
          
          return (
            <Button
              key={page}
              variant={isCurrent ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(page)}
              disabled={isCurrent}
              className={isCurrent ? "bg-orange-500 hover:bg-orange-600" : ""}
            >
              {page}
            </Button>
          )
        })}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Volgende
        </Button>
      </div>
    </div>
  )
} 
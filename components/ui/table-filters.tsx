"use client"

import { ReactNode, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Search, Filter, RotateCcw, SlidersHorizontal, ChevronDown } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// MultiSelect component for multiple selection
function MultiSelect({ 
  value, 
  onValueChange, 
  options, 
  placeholder, 
  label 
}: { 
  value: string[]
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  label: string
}) {
  const [open, setOpen] = useState(false)
  
  const selectedCount = value.length
  const displayText = selectedCount === 0 
    ? placeholder || label
    : selectedCount === 1 
    ? options.find(opt => opt.value === value[0])?.label || value[0]
    : selectedCount === options.length
    ? `Alle ${options.length} geselecteerd`
    : `${selectedCount} geselecteerd`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={`min-w-[180px] max-w-[220px] justify-between bg-white border-gray-200 hover:border-gray-300 transition-colors ${
            selectedCount > 0 ? 'border-blue-300 bg-blue-50/30' : ''
          }`}
        >
          <span className={`truncate ${selectedCount > 0 ? 'font-medium' : 'text-gray-600'}`}>
            {displayText}
          </span>
          <ChevronDown className={`ml-2 h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2 shadow-lg border-gray-200">
        <div className="max-h-64 overflow-auto">
          {options.map((option) => (
            <div 
              key={option.value} 
              className={`flex items-center space-x-3 p-2 rounded-md transition-colors ${
                value.includes(option.value) 
                  ? 'bg-blue-50 border border-blue-200' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <Checkbox
                id={option.value}
                checked={value.includes(option.value)}
                onCheckedChange={() => onValueChange(option.value)}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <label
                htmlFor={option.value}
                className={`text-sm leading-none cursor-pointer flex-1 select-none ${
                  value.includes(option.value) ? 'font-medium text-blue-900' : 'text-gray-700'
                }`}
              >
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface FilterProps {
  id: string
  label: string
  value: string | string[]
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
  multiple?: boolean
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
  const hasActiveFilters = filters.some(filter => {
    if (Array.isArray(filter.value)) {
      return filter.value.length > 0
    }
    return filter.value !== "all" && filter.value !== ""
  })
  const showResults = totalCount !== undefined

  return (
    <Card className={`p-6 bg-gradient-to-br from-gray-50 via-white to-gray-50/50 border border-gray-200 shadow-sm ${className}`}>
      <div className="space-y-6">
        {/* Header with Search and Reset */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 bg-white border-gray-200 focus:border-blue-300 focus:ring-blue-200 transition-colors"
              />
            </div>

            {/* Results Count */}
            {showResults && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-white border-gray-200 text-gray-700 font-medium">
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
              className="bg-white hover:bg-gray-50 border-gray-200 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset filters
            </Button>
          )}
        </div>

        {/* Filters Row */}
        {filters.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <SlidersHorizontal className="w-4 h-4 text-gray-500" />
              Filters
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filters.map((filter) => (
                filter.multiple ? (
                  <MultiSelect
                    key={filter.id}
                    value={Array.isArray(filter.value) ? filter.value : []}
                    onValueChange={filter.onValueChange}
                    options={filter.options}
                    placeholder={filter.placeholder}
                    label={filter.label}
                  />
                ) : (
                  <Select 
                    key={filter.id} 
                    value={typeof filter.value === 'string' ? filter.value : ''} 
                    onValueChange={filter.onValueChange}
                  >
                    <SelectTrigger className={`min-w-[180px] max-w-[220px] bg-white border-gray-200 hover:border-gray-300 transition-colors ${filter.className || ""}`}>
                      <SelectValue placeholder={filter.placeholder || filter.label} />
                    </SelectTrigger>
                    <SelectContent className="w-64">
                      {filter.options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              ))}
            </div>
          </div>
        )}

        {/* Bulk Actions */}
        {bulkActions && (
          <div className="border-t border-gray-200 pt-6">
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
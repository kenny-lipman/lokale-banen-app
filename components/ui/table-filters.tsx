"use client"

import { ReactNode, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { Search, Filter, RotateCcw, SlidersHorizontal, ChevronDown, Calendar, Euro, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

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

// Date Range Filter component
export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  label = "Datum"
}: {
  dateFrom: string | null
  dateTo: string | null
  onDateFromChange: (value: string | null) => void
  onDateToChange: (value: string | null) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const hasValue = dateFrom || dateTo

  const presets = [
    { label: "Vandaag", from: new Date().toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
    { label: "Laatste 7 dagen", from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
    { label: "Laatste 30 dagen", from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
    { label: "Laatste 90 dagen", from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
  ]

  const getDisplayText = () => {
    if (!dateFrom && !dateTo) return label
    if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
      const toDate = new Date(dateTo).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
      return `${fromDate} - ${toDate}`
    }
    if (dateFrom) return `Vanaf ${new Date(dateFrom).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
    return `Tot ${new Date(dateTo!).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`min-w-[180px] max-w-[220px] justify-between bg-white border-gray-200 hover:border-gray-300 transition-colors ${
            hasValue ? 'border-blue-300 bg-blue-50/30' : ''
          }`}
        >
          <Calendar className="w-4 h-4 mr-2 text-gray-500" />
          <span className={`truncate ${hasValue ? 'font-medium' : 'text-gray-600'}`}>
            {getDisplayText()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 shadow-lg border-gray-200">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Snelle selectie</Label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onDateFromChange(preset.from)
                    onDateToChange(preset.to)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Van</Label>
              <Input
                type="date"
                value={dateFrom || ''}
                onChange={(e) => onDateFromChange(e.target.value || null)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Tot</Label>
              <Input
                type="date"
                value={dateTo || ''}
                onChange={(e) => onDateToChange(e.target.value || null)}
                className="text-sm"
              />
            </div>
          </div>
          {hasValue && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-gray-500"
              onClick={() => {
                onDateFromChange(null)
                onDateToChange(null)
              }}
            >
              Wis datumfilter
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Salary Range Filter component
export function SalaryRangeFilter({
  salaryMin,
  salaryMax,
  onSalaryMinChange,
  onSalaryMaxChange,
  label = "Salaris"
}: {
  salaryMin: number | null
  salaryMax: number | null
  onSalaryMinChange: (value: number | null) => void
  onSalaryMaxChange: (value: number | null) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const hasValue = salaryMin !== null || salaryMax !== null

  const presets = [
    { label: "Tot €2.500", min: null, max: 2500 },
    { label: "€2.500 - €4.000", min: 2500, max: 4000 },
    { label: "€4.000 - €6.000", min: 4000, max: 6000 },
    { label: "€6.000+", min: 6000, max: null },
  ]

  const getDisplayText = () => {
    if (salaryMin === null && salaryMax === null) return label
    if (salaryMin !== null && salaryMax !== null) {
      return `€${salaryMin.toLocaleString('nl-NL')} - €${salaryMax.toLocaleString('nl-NL')}`
    }
    if (salaryMin !== null) return `Vanaf €${salaryMin.toLocaleString('nl-NL')}`
    return `Tot €${salaryMax!.toLocaleString('nl-NL')}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`min-w-[180px] max-w-[220px] justify-between bg-white border-gray-200 hover:border-gray-300 transition-colors ${
            hasValue ? 'border-blue-300 bg-blue-50/30' : ''
          }`}
        >
          <Euro className="w-4 h-4 mr-2 text-gray-500" />
          <span className={`truncate ${hasValue ? 'font-medium' : 'text-gray-600'}`}>
            {getDisplayText()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 shadow-lg border-gray-200">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Snelle selectie</Label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onSalaryMinChange(preset.min)
                    onSalaryMaxChange(preset.max)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Minimum (€)</Label>
              <Input
                type="number"
                placeholder="0"
                value={salaryMin ?? ''}
                onChange={(e) => onSalaryMinChange(e.target.value ? parseInt(e.target.value) : null)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Maximum (€)</Label>
              <Input
                type="number"
                placeholder="10000"
                value={salaryMax ?? ''}
                onChange={(e) => onSalaryMaxChange(e.target.value ? parseInt(e.target.value) : null)}
                className="text-sm"
              />
            </div>
          </div>
          {hasValue && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-gray-500"
              onClick={() => {
                onSalaryMinChange(null)
                onSalaryMaxChange(null)
              }}
            >
              Wis salarisfilter
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Hours Range Filter component
export function HoursRangeFilter({
  hoursMin,
  hoursMax,
  onHoursMinChange,
  onHoursMaxChange,
  label = "Uren per week"
}: {
  hoursMin: number | null
  hoursMax: number | null
  onHoursMinChange: (value: number | null) => void
  onHoursMaxChange: (value: number | null) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const hasValue = hoursMin !== null || hoursMax !== null

  const presets = [
    { label: "Parttime (0-24u)", min: 0, max: 24 },
    { label: "Fulltime (32-40u)", min: 32, max: 40 },
    { label: "24-32 uur", min: 24, max: 32 },
    { label: "Alle uren", min: null, max: null },
  ]

  const getDisplayText = () => {
    if (hoursMin === null && hoursMax === null) return label
    if (hoursMin !== null && hoursMax !== null) {
      return `${hoursMin} - ${hoursMax} uur`
    }
    if (hoursMin !== null) return `${hoursMin}+ uur`
    return `Tot ${hoursMax} uur`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`min-w-[180px] max-w-[220px] justify-between bg-white border-gray-200 hover:border-gray-300 transition-colors ${
            hasValue ? 'border-blue-300 bg-blue-50/30' : ''
          }`}
        >
          <Clock className="w-4 h-4 mr-2 text-gray-500" />
          <span className={`truncate ${hasValue ? 'font-medium' : 'text-gray-600'}`}>
            {getDisplayText()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 shadow-lg border-gray-200">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Snelle selectie</Label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    onHoursMinChange(preset.min)
                    onHoursMaxChange(preset.max)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Minimum uren</Label>
              <Input
                type="number"
                placeholder="0"
                min={0}
                max={40}
                value={hoursMin ?? ''}
                onChange={(e) => onHoursMinChange(e.target.value ? parseInt(e.target.value) : null)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Maximum uren</Label>
              <Input
                type="number"
                placeholder="40"
                min={0}
                max={40}
                value={hoursMax ?? ''}
                onChange={(e) => onHoursMaxChange(e.target.value ? parseInt(e.target.value) : null)}
                className="text-sm"
              />
            </div>
          </div>
          {hasValue && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-gray-500"
              onClick={() => {
                onHoursMinChange(null)
                onHoursMaxChange(null)
              }}
            >
              Wis urenfilter
            </Button>
          )}
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
  actionButtons?: ReactNode
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
  children,
  actionButtons
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
                  {totalCount === 0 ? "Geen resultaten" : `${totalCount.toLocaleString('nl-NL')} ${resultText || "resultaten"}`}
                </Badge>
                {totalCount > 1000 && (
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                    Gebruik filters om resultaten te beperken
                  </Badge>
                )}
                {hasActiveFilters && (
                  <Badge variant="secondary" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                    Filters actief
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {actionButtons}
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
          Pagina {currentPage} van {totalPages} ({totalCount.toLocaleString('nl-NL')} totaal)
        </span>
        <span className="text-gray-500">
          {((currentPage - 1) * itemsPerPage + 1).toLocaleString('nl-NL')} - {Math.min(currentPage * itemsPerPage, totalCount).toLocaleString('nl-NL')} van {totalCount.toLocaleString('nl-NL')}
        </span>
        <div className="flex items-center gap-2">
          <label>Per pagina:</label>
          <Select value={itemsPerPage.toString()} onValueChange={(value) => onItemsPerPageChange(Number(value))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[15, 25, 50, 100, 250, 500].map(num => (
                <SelectItem key={num} value={num.toString()}>{num}</SelectItem>
              ))}
              {totalCount <= 1000 && (
                <SelectItem value={totalCount.toString()}>Alle ({totalCount.toLocaleString('nl-NL')})</SelectItem>
              )}
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
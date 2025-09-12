"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { fuzzySearch } from "@/lib/fuzzy-search"
import { useDebounce } from "@/hooks/use-debounce"

interface Campaign {
  id: string
  name: string
  status: string
}

interface CampaignStatus {
  label: string
  color: string
  icon: string
}

interface CampaignComboboxProps {
  campaigns: Campaign[]
  value: string
  onSelect: (value: string) => void
  placeholder?: string
  campaignStatusMap: Record<string, CampaignStatus>
}

// Status order for grouping (most important first)
const STATUS_ORDER = ['1', '4', '2', '3', '0', '-1', '-2', '-99']

export function SimpleCampaignCombobox({
  campaigns,
  value,
  onSelect,
  placeholder = "Selecteer campagne...",
  campaignStatusMap
}: CampaignComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [selectedIndex, setSelectedIndex] = React.useState(-1)
  
  // Debounce search for better performance
  const debouncedSearchValue = useDebounce(searchValue, 200)

  const selectedCampaign = campaigns.find((campaign) => campaign.id === value)

  // Group and filter campaigns
  const { groupedCampaigns, flatCampaigns } = React.useMemo(() => {
    // Apply fuzzy search
    const searchResults = fuzzySearch(campaigns, debouncedSearchValue, {
      keys: ['name'],
      threshold: 0.2
    })
    
    const filteredCampaigns = searchResults.map(result => result.item)
    
    // Group by status
    const groups = new Map<string, Campaign[]>()
    
    // Initialize groups in order
    STATUS_ORDER.forEach(status => {
      if (campaignStatusMap[status]) {
        groups.set(status, [])
      }
    })
    
    // Add campaigns to groups
    filteredCampaigns.forEach(campaign => {
      const status = campaign.status
      if (!groups.has(status)) {
        groups.set(status, [])
      }
      groups.get(status)?.push(campaign)
    })
    
    // Filter out empty groups
    const nonEmptyGroups = Array.from(groups.entries()).filter(([_, campaigns]) => campaigns.length > 0)
    
    return {
      groupedCampaigns: nonEmptyGroups,
      flatCampaigns: filteredCampaigns
    }
  }, [campaigns, debouncedSearchValue, campaignStatusMap])

  const totalFilteredCampaigns = flatCampaigns.length

  const handleSelect = (campaignId: string) => {
    onSelect(campaignId)
    setOpen(false)
    setSearchValue("")
    setSelectedIndex(-1)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, flatCampaigns.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && flatCampaigns[selectedIndex]) {
          handleSelect(flatCampaigns[selectedIndex].id)
        }
        break
      case 'Escape':
        setOpen(false)
        setSearchValue("")
        setSelectedIndex(-1)
        break
    }
  }

  return (
    <div onKeyDown={handleKeyDown}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-[40px] font-normal"
          >
            {selectedCampaign ? (
              <div className="flex flex-col items-start w-full text-left">
                <span className="truncate w-full font-medium">
                  {selectedCampaign.name}
                </span>
                {campaignStatusMap[selectedCampaign.status] && (
                  <Badge 
                    className={`${campaignStatusMap[selectedCampaign.status].color} text-xs mt-1`}
                  >
                    {campaignStatusMap[selectedCampaign.status].icon} {campaignStatusMap[selectedCampaign.status].label}
                  </Badge>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[450px] p-0 max-h-[500px] overflow-hidden" align="start">
          {/* Search Input */}
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex-1 outline-none text-sm placeholder:text-muted-foreground"
              placeholder="Zoek campagne..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              autoFocus
            />
          </div>

          {/* Scrollable Campaign List */}
          <div 
            className="max-h-[400px] overflow-y-auto overflow-x-hidden"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#d1d5db #f3f4f6'
            }}
          >
            {totalFilteredCampaigns === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                {searchValue ? `Geen campagnes gevonden voor "${searchValue}"` : "Geen campagnes beschikbaar"}
              </div>
            ) : (
              <>
                {groupedCampaigns.map(([statusKey, statusCampaigns], groupIndex) => {
                  const status = campaignStatusMap[statusKey]
                  return (
                    <div key={statusKey}>
                      {groupIndex > 0 && <div className="border-t my-1" />}
                      
                      {/* Group Header */}
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2 bg-gray-50 sticky top-0">
                        {status && (
                          <>
                            <span>{status.icon}</span>
                            <span>{status.label}</span>
                            <Badge variant="secondary" className="ml-auto text-xs px-1.5 h-5">
                              {statusCampaigns.length}
                            </Badge>
                          </>
                        )}
                      </div>

                      {/* Campaign Items */}
                      {statusCampaigns.map((campaign, campaignIndex) => {
                        const globalIndex = flatCampaigns.findIndex(c => c.id === campaign.id)
                        const isSelected = globalIndex === selectedIndex
                        const isActive = value === campaign.id
                        
                        return (
                          <div
                            key={campaign.id}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors",
                              isSelected && "bg-accent",
                              !isSelected && "hover:bg-accent/50",
                              isActive && "bg-accent"
                            )}
                            onClick={() => handleSelect(campaign.id)}
                          >
                            <Check
                              className={cn(
                                "h-4 w-4 flex-shrink-0",
                                isActive ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className="font-medium truncate">
                                {campaign.name}
                              </span>
                              {debouncedSearchValue && (
                                <span className="text-xs text-muted-foreground opacity-60">
                                  Match: {(
                                    fuzzySearch([campaign], debouncedSearchValue, { keys: ['name'] })[0]?.score * 100
                                  ).toFixed(0)}%
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* Footer */}
          {totalFilteredCampaigns > 0 && (
            <div className="border-t px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {totalFilteredCampaigns} {totalFilteredCampaigns === 1 ? 'campagne' : 'campagnes'} gevonden
                {searchValue && ` voor "${searchValue}"`}
              </p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
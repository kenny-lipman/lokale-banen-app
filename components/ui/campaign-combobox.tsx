"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
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

export function CampaignCombobox({
  campaigns,
  value,
  onSelect,
  placeholder = "Selecteer campagne...",
  campaignStatusMap
}: CampaignComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const scrollableRef = React.useRef<HTMLDivElement>(null)
  
  // Debounce search for better performance
  const debouncedSearchValue = useDebounce(searchValue, 200)

  // Handle mouse wheel scrolling
  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    if (scrollableRef.current) {
      scrollableRef.current.scrollTop += e.deltaY
    }
  }, [])

  const selectedCampaign = campaigns.find((campaign) => campaign.id === value)

  // Group and filter campaigns
  const groupedCampaigns = React.useMemo(() => {
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
    
    return nonEmptyGroups
  }, [campaigns, debouncedSearchValue, campaignStatusMap])

  // Calculate total filtered campaigns
  const totalFilteredCampaigns = groupedCampaigns.reduce((sum, [_, campaigns]) => sum + campaigns.length, 0)

  const handleSelect = (campaignId: string) => {
    onSelect(campaignId)
    setOpen(false)
    setSearchValue("")
  }

  return (
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
        <Command shouldFilter={false} className="h-full" onWheel={handleWheel}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Zoek campagne..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>
          <div 
            ref={scrollableRef}
            className="max-h-[400px] overflow-y-auto overflow-x-hidden custom-scrollbar smooth-scroll"
            onWheel={handleWheel}
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#d1d5db #f3f4f6'
            }}
          >
            <CommandList className="max-h-none">
              {totalFilteredCampaigns === 0 ? (
                <CommandEmpty>
                  {searchValue ? `Geen campagnes gevonden voor "${searchValue}"` : "Geen campagnes beschikbaar"}
                </CommandEmpty>
              ) : (
                <>
                  {groupedCampaigns.map(([statusKey, statusCampaigns], groupIndex) => {
                    const status = campaignStatusMap[statusKey]
                    return (
                      <React.Fragment key={statusKey}>
                        {groupIndex > 0 && <CommandSeparator className="my-1" />}
                        <CommandGroup 
                          heading={
                            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5 sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
                          }
                        >
                          {statusCampaigns.map((campaign) => (
                            <CommandItem
                              key={campaign.id}
                              value={campaign.id}
                              onSelect={() => handleSelect(campaign.id)}
                              className="py-2.5 px-2 cursor-pointer data-[selected=true]:bg-accent hover:bg-accent/50 transition-colors"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4 flex-shrink-0",
                                  value === campaign.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-medium truncate">
                                  {campaign.name}
                                </span>
                                {debouncedSearchValue && (
                                  <span className="text-xs text-muted-foreground mt-0.5 opacity-60">
                                    Match: {(
                                      fuzzySearch([campaign], debouncedSearchValue, { keys: ['name'] })[0]?.score * 100
                                    ).toFixed(0)}%
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </React.Fragment>
                    )
                  })}
                </>
              )}
            </CommandList>
          </div>
          {totalFilteredCampaigns > 0 && (
            <div className="border-t px-3 py-2">
              <p className="text-xs text-muted-foreground">
                {totalFilteredCampaigns} {totalFilteredCampaigns === 1 ? 'campagne' : 'campagnes'} gevonden
                {searchValue && ` voor "${searchValue}"`}
              </p>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
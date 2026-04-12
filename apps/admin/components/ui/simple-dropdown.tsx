"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"

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

interface SimpleDropdownProps {
  campaigns: Campaign[]
  value: string
  onSelect: (value: string) => void
  placeholder?: string
  campaignStatusMap: Record<string, CampaignStatus>
}

export function SimpleDropdown({
  campaigns,
  value,
  onSelect,
  placeholder = "Selecteer campagne...",
  campaignStatusMap
}: SimpleDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const dropdownRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const selectedCampaign = campaigns.find(campaign => campaign.id === value)

  // Filter campaigns based on search
  const filteredCampaigns = React.useMemo(() => {
    if (!searchTerm) return campaigns
    return campaigns.filter(campaign =>
      campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [campaigns, searchTerm])

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm("")
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input when dropdown opens
  React.useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSelect = (campaignId: string) => {
    onSelect(campaignId)
    setIsOpen(false)
    setSearchTerm("")
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
    setSearchTerm("")
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[40px]"
      >
        {selectedCampaign ? (
          <div className="flex flex-col items-start text-left w-full">
            <span className="truncate font-medium text-sm">
              {selectedCampaign.name}
            </span>
            {campaignStatusMap[selectedCampaign.status] && (
              <Badge className={`${campaignStatusMap[selectedCampaign.status].color} text-xs mt-1`}>
                {campaignStatusMap[selectedCampaign.status].icon} {campaignStatusMap[selectedCampaign.status].label}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-gray-500 text-sm">{placeholder}</span>
        )}
        <ChevronsUpDown className="ml-2 h-4 w-4 text-gray-400 flex-shrink-0" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-[400px] overflow-hidden">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Zoek campagne..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Scrollable Options */}
          <div 
            className="max-h-[300px] overflow-y-auto"
            style={{
              scrollBehavior: 'smooth'
            }}
          >
            {filteredCampaigns.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-500">
                {searchTerm ? `Geen campagnes gevonden voor "${searchTerm}"` : "Geen campagnes beschikbaar"}
              </div>
            ) : (
              filteredCampaigns.map((campaign) => {
                const status = campaignStatusMap[campaign.status]
                const isSelected = campaign.id === value
                
                return (
                  <div
                    key={campaign.id}
                    onClick={() => handleSelect(campaign.id)}
                    className={`
                      flex items-center px-3 py-2 cursor-pointer hover:bg-gray-100 transition-colors
                      ${isSelected ? 'bg-blue-50 text-blue-600' : 'text-gray-900'}
                    `}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 flex-shrink-0 ${
                        isSelected ? 'text-blue-600' : 'text-transparent'
                      }`}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium truncate text-sm">
                        {campaign.name}
                      </span>
                      {status && (
                        <Badge className={`${status.color} text-xs mt-1 w-fit`}>
                          {status.icon} {status.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {filteredCampaigns.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500">
                {filteredCampaigns.length} {filteredCampaigns.length === 1 ? 'campagne' : 'campagnes'}
                {searchTerm && ` gevonden voor "${searchTerm}"`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
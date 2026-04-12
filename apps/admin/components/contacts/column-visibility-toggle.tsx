"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings2, Eye, EyeOff } from "lucide-react"

export interface ColumnVisibility {
  naam: boolean
  kwalificatiestatus: boolean
  functie: boolean
  telefoon: boolean
  email: boolean
  emailStatus: boolean
  bron: boolean
  bedrijf: boolean
  bedrijfsgrootte: boolean
  companyStatus: boolean
  companyStart: boolean
  linkedin: boolean
  campagne: boolean
  pipedriveStatus: boolean
  instantlyStatus: boolean
  aangemaakt: boolean
}

interface ColumnVisibilityToggleProps {
  visibility: ColumnVisibility
  onVisibilityChange: (visibility: ColumnVisibility) => void
}

export function ColumnVisibilityToggle({
  visibility,
  onVisibilityChange
}: ColumnVisibilityToggleProps) {
  const columnLabels = {
    naam: "Naam",
    kwalificatiestatus: "Kwalificatiestatus",
    functie: "Functie",
    telefoon: "Telefoon",
    email: "Email",
    emailStatus: "Email Status",
    bron: "Bron",
    bedrijf: "Bedrijf",
    bedrijfsgrootte: "Bedrijfsgrootte",
    companyStatus: "Company Status",
    companyStart: "Company Start",
    linkedin: "LinkedIn",
    campagne: "Campagne",
    pipedriveStatus: "Pipedrive",
    instantlyStatus: "Instantly",
    aangemaakt: "Aangemaakt"
  }

  const handleColumnToggle = (columnKey: keyof ColumnVisibility) => {
    onVisibilityChange({
      ...visibility,
      [columnKey]: !visibility[columnKey]
    })
  }

  const visibleCount = Object.values(visibility).filter(Boolean).length
  const totalCount = Object.keys(visibility).length

  const showAllColumns = () => {
    const allVisible = Object.keys(visibility).reduce((acc, key) => ({
      ...acc,
      [key]: true
    }), {} as ColumnVisibility)
    onVisibilityChange(allVisible)
  }

  const hideOptionalColumns = () => {
    const essentialOnly: ColumnVisibility = {
      naam: true,
      kwalificatiestatus: true,
      functie: true,
      telefoon: true,
      email: true,
      emailStatus: false,
      bron: false,
      bedrijf: true,
      bedrijfsgrootte: false,
      companyStatus: false,
      companyStart: false,
      linkedin: false,
      campagne: false,
      pipedriveStatus: true,
      instantlyStatus: true,
      aangemaakt: false
    }
    onVisibilityChange(essentialOnly)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2"
        >
          <Settings2 className="h-4 w-4" />
          Kolommen ({visibleCount}/{totalCount})
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        <DropdownMenuLabel>Kolom Zichtbaarheid</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="flex flex-col gap-1 p-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={showAllColumns}
            className="justify-start text-xs h-7"
          >
            <Eye className="h-3 w-3 mr-2" />
            Toon alle kolommen
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={hideOptionalColumns}
            className="justify-start text-xs h-7"
          >
            <EyeOff className="h-3 w-3 mr-2" />
            Alleen essentieel
          </Button>
        </div>

        <DropdownMenuSeparator />
        
        {Object.entries(columnLabels).map(([key, label]) => (
          <DropdownMenuCheckboxItem
            key={key}
            className="cursor-pointer"
            checked={visibility[key as keyof ColumnVisibility]}
            onCheckedChange={() => handleColumnToggle(key as keyof ColumnVisibility)}
          >
            <span className={`text-sm ${
              ['naam', 'email'].includes(key) ? 'font-medium text-blue-700' : ''
            }`}>
              {label}
              {['naam', 'email'].includes(key) && (
                <span className="ml-1 text-xs text-blue-500">(kern)</span>
              )}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
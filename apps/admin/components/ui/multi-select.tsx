"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface Option {
  value: string
  label: string
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value]
    onChange(newSelected)
  }

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(selected.filter((item) => item !== value))
  }

  const selectedLabels = selected
    .map((value) => options.find((option) => option.value === value)?.label)
    .filter(Boolean)

  // Get display text based on selection
  const getDisplayText = () => {
    if (selected.length === 0) {
      return <span className="text-muted-foreground truncate">{placeholder}</span>
    }
    if (selected.length === 1) {
      const label = selectedLabels[0]
      return (
        <span className="truncate text-sm">
          {label}
        </span>
      )
    }
    return (
      <span className="text-sm font-medium">
        {selected.length} geselecteerd
      </span>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-10 px-3 py-2",
            selected.length > 0 && "border-orange-300 bg-orange-50",
            className
          )}
        >
          <div className="flex-1 min-w-0 text-left">
            {getDisplayText()}
          </div>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {selected.length > 0 && (
              <X
                className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange([])
                }}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Zoeken..." />
          <CommandEmpty>Geen optie gevonden.</CommandEmpty>
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-b bg-muted/50">
            Meerdere opties mogelijk
          </div>
          <CommandGroup className="max-h-64 overflow-auto">
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
                className="cursor-pointer"
              >
                <div className={cn(
                  "mr-2 h-4 w-4 border rounded flex items-center justify-center",
                  selected.includes(option.value)
                    ? "bg-orange-500 border-orange-500"
                    : "border-gray-300"
                )}>
                  {selected.includes(option.value) && (
                    <Check className="h-3 w-3 text-white" />
                  )}
                </div>
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
          {selected.length > 0 && (
            <div className="px-2 py-1.5 text-xs border-t flex items-center justify-between bg-muted/50">
              <span className="text-muted-foreground">{selected.length} geselecteerd</span>
              <button
                className="text-orange-600 hover:text-orange-800 font-medium"
                onClick={(e) => {
                  e.stopPropagation()
                  onChange([])
                }}
              >
                Wissen
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
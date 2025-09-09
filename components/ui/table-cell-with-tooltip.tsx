import React from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface TableCellWithTooltipProps {
  value: string | null | undefined
  className?: string
  href?: string
  hrefClassName?: string
  maxWidth?: string
}

export function TableCellWithTooltip({ 
  value, 
  className = "", 
  href,
  hrefClassName,
  maxWidth = "w-24"
}: TableCellWithTooltipProps) {
  const displayValue = value || '-'
  const needsTooltip = value && value.length > 15
  
  const content = href ? (
    <a 
      href={href}
      className={hrefClassName || "text-blue-600 hover:text-blue-800 hover:underline text-xs"}
    >
      {displayValue}
    </a>
  ) : (
    <span className="text-xs">{displayValue}</span>
  )

  if (!needsTooltip) {
    return (
      <div className={`${maxWidth} ${className}`}>
        {content}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`truncate ${maxWidth} ${className} cursor-help`}>
            {content}
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="break-words">{value}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Zap, Users, X, AlertTriangle } from "lucide-react"

interface BulkActionBarProps {
  selectedCount: number
  enrichableCount: number
  exceedsBatchLimit: boolean
  canEnrich: boolean
  isEnriching: boolean
  validationMessage: string
  onEnrichClick: () => void
  onClearSelection: () => void
  className?: string
}

export function BulkActionBar({
  selectedCount,
  enrichableCount,
  exceedsBatchLimit,
  canEnrich,
  isEnriching,
  validationMessage,
  onEnrichClick,
  onClearSelection,
  className = ""
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <Card className={`p-4 bg-gradient-to-r from-blue-50 to-orange-50 border-l-4 border-l-orange-500 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Badge className="bg-orange-100 text-orange-800 border-orange-200">
              <Users className="w-3 h-3 mr-1" />
              {selectedCount} bedrijven geselecteerd
            </Badge>
            
            {/* All selected companies are now enrichable */}
            
            {exceedsBatchLimit && (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Max 100 bedrijven
              </Badge>
            )}
          </div>
          
          {/* Validation Message */}
          <div className="text-sm text-gray-600">
            {validationMessage}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {/* Apollo Enrichment Button */}
          <Button
            onClick={onEnrichClick}
            disabled={!canEnrich}
            className={`${
              canEnrich 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-gray-400 cursor-not-allowed'
            } text-white font-semibold px-6 py-2 transition-all duration-200`}
            title={
              !canEnrich 
                ? validationMessage
                : `Verrijk ${enrichableCount} bedrijven met Apollo data`
            }
          >
            {isEnriching ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Bezig met verrijken...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Verrijk met Apollo ({enrichableCount})
              </>
            )}
          </Button>

          {/* Clear Selection */}
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="hover:bg-gray-50"
            title="Selectie wissen"
          >
            <X className="w-4 h-4 mr-1" />
            Wissen
          </Button>
        </div>
      </div>
      
      {/* Progress indicator when enriching */}
      {isEnriching && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <Zap className="w-4 h-4 animate-pulse" />
            Apollo verrijkt de geselecteerde bedrijven met contactgegevens...
          </div>
        </div>
      )}
    </Card>
  )
} 
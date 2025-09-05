"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { CheckCircle, XCircle, AlertCircle, Users, X, Target } from "lucide-react"

interface CompanyQualificationBulkBarProps {
  selectedCount: number
  onQualify: (status: 'qualified' | 'disqualified' | 'review') => Promise<void>
  onClearSelection: () => void
  isQualifying?: boolean
  className?: string
}

export function CompanyQualificationBulkBar({
  selectedCount,
  onQualify,
  onClearSelection,
  isQualifying = false,
  className = ""
}: CompanyQualificationBulkBarProps) {
  const hasSelection = selectedCount > 0
  
  return (
    <Card className={`p-4 bg-gradient-to-r from-green-50 to-blue-50 border-l-4 border-l-green-500 ${className}`}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Selection Info */}
        <div className="flex items-center gap-4">
          {hasSelection ? (
            <>
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <Users className="w-3 h-3 mr-1" />
                  {selectedCount} bedrijven geselecteerd
                </Badge>
              </div>
              
              <div className="text-sm text-gray-600">
                Kies een actie om toe te passen op de geselecteerde bedrijven
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                <Target className="w-3 h-3 mr-1" />
                Geen bedrijven geselecteerd
              </Badge>
              <div className="text-sm text-gray-500">
                Selecteer bedrijven om ze te qualificeren
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {hasSelection && (
            <>
              {/* Qualify Button */}
              <Button
                onClick={() => onQualify('qualified')}
                disabled={isQualifying}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 transition-all duration-200"
                title={`Kwalificeer ${selectedCount} geselecteerde bedrijven`}
              >
                {isQualifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Bezig...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Qualify ({selectedCount})
                  </>
                )}
              </Button>

              {/* Review Button */}
              <Button
                onClick={() => onQualify('review')}
                disabled={isQualifying}
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold px-4 py-2 transition-all duration-200"
                title={`Markeer ${selectedCount} geselecteerde bedrijven voor review`}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Review ({selectedCount})
              </Button>

              {/* Disqualify Button */}
              <Button
                onClick={() => onQualify('disqualified')}
                disabled={isQualifying}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 transition-all duration-200"
                title={`Diskwalificeer ${selectedCount} geselecteerde bedrijven`}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Disqualify ({selectedCount})
              </Button>

              {/* Clear Selection */}
              <Button
                variant="outline"
                size="sm"
                onClick={onClearSelection}
                disabled={isQualifying}
                className="hover:bg-gray-50"
                title="Selectie wissen"
              >
                <X className="w-4 h-3 mr-1" />
                Wissen
              </Button>
            </>
          )}
        </div>
      </div>
      
      {/* Progress indicator when qualifying */}
      {isQualifying && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle className="w-4 h-4 animate-pulse" />
            Bezig met het updaten van de qualification status...
          </div>
        </div>
      )}
    </Card>
  )
}
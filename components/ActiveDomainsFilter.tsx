"use client"

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Filter, CheckCircle, Eye } from 'lucide-react'

interface ActiveDomainsFilterProps {
  showActiveOnly: boolean
  onFilterChange: (showActiveOnly: boolean) => void
  totalPlatforms: number
  activePlatforms: number
}

export const ActiveDomainsFilter: React.FC<ActiveDomainsFilterProps> = ({
  showActiveOnly,
  onFilterChange,
  totalPlatforms,
  activePlatforms
}) => {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-lg">Hoofddomeinen Filter</CardTitle>
          </div>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              Toon alleen actieve domeinen
            </span>
            <Switch
              checked={showActiveOnly}
              onCheckedChange={onFilterChange}
              className="data-[state=checked]:bg-orange-500"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                {showActiveOnly ? 'Actieve domeinen' : 'Alle domeinen'}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {showActiveOnly ? activePlatforms : totalPlatforms} platforms
              </Badge>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>{activePlatforms} actief</span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              <span>{totalPlatforms - activePlatforms} inactief</span>
            </div>
          </div>
        </div>

        {showActiveOnly && (
          <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />
              <span>
                Toont alleen platforms met actieve centrale plaatsen
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
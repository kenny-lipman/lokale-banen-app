"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertCircle, RefreshCw, CheckCircle, XCircle, ArrowRightLeft } from 'lucide-react'
import { authenticatedFetch } from '@/lib/authenticated-fetch'
import { toast } from 'sonner'

// ============================================================================
// Types
// ============================================================================

interface Mapping {
  id: string
  type: string
  our_value: string
  their_value: string | null
  created_at: string
  updated_at: string
}

type MappingType = 'domain' | 'sector' | 'employment' | 'education'

interface LBValues {
  domains: string[]
  sectors: string[]
  employments: string[]
  educations: string[]
}

// Default LB values (fetched from their API, cached here as fallback)
const DEFAULT_LB_VALUES: LBValues = {
  domains: [
    'lokale', 'westlandse', 'delftse', 'barse', 'haagse', 'almeerse', 'zwolse',
    'lansingerlandse', 'bollenstreekse', 'schiedamse', 'aalsmeerse', 'alkmaarse',
    'alphense', 'drechtse', 'goudse', 'hoofddorpse', 'oosterhoutse', 'tilburgse',
    'zaanse', 'zoetermeerse', 'apeldoornse', 'weerter', 'harderwijkse', 'leidse',
    'woerdense', 'hoeksche', 'voornse', 'haarlemse', 'rotterdamse', 'vlaardingse',
    'maassluise', 'waterwegse', 'brabantse', 'werkeninaalsmeer', 'wlstages',
    'vacaturewestland', 'vacatureswestland'
  ],
  sectors: [
    'agf', 'beveiliging', 'bouw', 'commercieel', 'facilitair', 'financieel',
    'financieel-administratief', 'grafisch', 'horeca', 'hovenier', 'hrm',
    'human-resource', 'ict', 'inkoop-verkoop', 'it', 'kwaliteit', 'leidinggevende',
    'logistiek-transport', 'makelaardij', 'maritiem', 'marketing',
    'marketing-communicatie', 'onderwijs', 'overig', 'personeel-organisatie',
    'productie', 'recruitment', 'retail', 'techniek', 'tuinbouw', 'veiligheid',
    'verzekeringen', 'zorg', 'zorg-welzijn'
  ],
  employments: [
    'bijbaan', 'freelance', 'fulltime', 'gecombineerd', 'meeloop', 'meewerk',
    'onderzoek', 'oproepbasis', 'parttime', 'scriptie', 'stage', 'vraagstuk',
    'vrijwilliger', 'zzp'
  ],
  educations: [
    'havo-vwo', 'hbo', 'mavo', 'mavo-vmbo', 'mbo', 'overig', 'universitair', 'wo'
  ],
}

// ============================================================================
// Component
// ============================================================================

export function LokaleBanenMappingSection() {
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [lbValues, setLbValues] = useState<LBValues>(DEFAULT_LB_VALUES)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  // Fetch mappings from our API
  const fetchMappings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await authenticatedFetch('/api/lokalebanen/mappings')
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setMappings(data.mappings)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load mappings')
    } finally {
      setLoading(false)
    }
  }, [])

  // Sync fresh values from LB API
  const syncLBValues = async () => {
    try {
      setSyncing(true)
      const res = await authenticatedFetch('/api/lokalebanen/sync')
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      setLbValues(data.data)
      toast.success('Lokale Banen waarden gesynchroniseerd')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync mislukt')
    } finally {
      setSyncing(false)
    }
  }

  // Update a mapping
  const updateMapping = async (type: string, ourValue: string, theirValue: string | null) => {
    const key = `${type}:${ourValue}`
    setSavingId(key)
    try {
      const res = await authenticatedFetch('/api/lokalebanen/mappings', {
        method: 'PUT',
        body: JSON.stringify({ type, our_value: ourValue, their_value: theirValue }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)

      // Update local state
      setMappings(prev => {
        const idx = prev.findIndex(m => m.type === type && m.our_value === ourValue)
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = { ...updated[idx], their_value: theirValue }
          return updated
        }
        return [...prev, data.mapping]
      })
      toast.success(`Mapping bijgewerkt: ${ourValue}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update mislukt')
    } finally {
      setSavingId(null)
    }
  }

  useEffect(() => {
    fetchMappings()
  }, [fetchMappings])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Lokale Banen Mappings
            </CardTitle>
            <CardDescription className="mt-1">
              Koppel onze waarden aan de Lokale Banen categorieën voor het pushen van vacatures
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={syncLBValues}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync LB waarden
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="domain">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="domain">
              Domains {getMappingStats(mappings, 'domain')}
            </TabsTrigger>
            <TabsTrigger value="sector">
              Sectors {getMappingStats(mappings, 'sector')}
            </TabsTrigger>
            <TabsTrigger value="employment">
              Employment {getMappingStats(mappings, 'employment')}
            </TabsTrigger>
            <TabsTrigger value="education">
              Education {getMappingStats(mappings, 'education')}
            </TabsTrigger>
          </TabsList>

          {(['domain', 'sector', 'employment', 'education'] as MappingType[]).map(type => (
            <TabsContent key={type} value={type}>
              <MappingTable
                mappings={mappings.filter(m => m.type === type)}
                lbOptions={getLBOptions(lbValues, type)}
                type={type}
                savingId={savingId}
                onUpdate={updateMapping}
              />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function MappingTable({
  mappings,
  lbOptions,
  type,
  savingId,
  onUpdate,
}: {
  mappings: Mapping[]
  lbOptions: string[]
  type: MappingType
  savingId: string | null
  onUpdate: (type: string, ourValue: string, theirValue: string | null) => void
}) {
  return (
    <div className="mt-4">
      <div className="text-sm text-gray-500 mb-3">
        {mappings.filter(m => m.their_value).length} van {mappings.length} gemapt
        {' · '}
        {lbOptions.length} LB opties beschikbaar
      </div>
      <div className="border rounded-md max-h-[500px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/3">Onze waarde</TableHead>
              <TableHead className="w-1/3">Lokale Banen waarde</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-500 py-8">
                  Geen mappings gevonden voor {type}
                </TableCell>
              </TableRow>
            ) : (
              mappings.map(mapping => {
                const isSaving = savingId === `${type}:${mapping.our_value}`
                return (
                  <TableRow key={mapping.id}>
                    <TableCell className="font-medium">{mapping.our_value}</TableCell>
                    <TableCell>
                      <Select
                        value={mapping.their_value || '__none__'}
                        onValueChange={(val) => onUpdate(type, mapping.our_value, val === '__none__' ? null : val)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecteer..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">
                            <span className="text-gray-400">Niet gemapt</span>
                          </SelectItem>
                          {lbOptions.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {mapping.their_value ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Gemapt
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          <XCircle className="h-3 w-3 mr-1" />
                          Open
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function getMappingStats(mappings: Mapping[], type: string): string {
  const typeMappings = mappings.filter(m => m.type === type)
  const mapped = typeMappings.filter(m => m.their_value).length
  return `(${mapped}/${typeMappings.length})`
}

function getLBOptions(lbValues: LBValues, type: MappingType): string[] {
  switch (type) {
    case 'domain': return lbValues.domains
    case 'sector': return lbValues.sectors
    case 'employment': return lbValues.employments
    case 'education': return lbValues.educations
  }
}

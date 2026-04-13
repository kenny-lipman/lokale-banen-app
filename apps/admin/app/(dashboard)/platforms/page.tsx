"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { authFetch } from "@/lib/authenticated-fetch"
import { toast } from "sonner"
import Link from "next/link"
import {
  Search,
  Globe,
  RefreshCw,
  ExternalLink,
  Loader2,
  Monitor,
} from "lucide-react"

interface PlatformRow {
  id: string
  regio_platform: string
  central_place: string | null
  domain: string | null
  is_public: boolean
  tier: string | null
  logo_url: string | null
  primary_color: string | null
  hero_title: string | null
  hero_subtitle: string | null
  seo_description: string | null
  published_at: string | null
  approved_count: number
}

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<PlatformRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const fetchPlatforms = async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/review/platforms")
      const result = await res.json()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setPlatforms(result.data || [])
    } catch {
      toast.error("Fout bij ophalen platforms")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlatforms()
  }, [])

  const handleTogglePublic = async (platform: PlatformRow) => {
    const newValue = !platform.is_public
    try {
      const res = await authFetch(`/api/review/platforms/${platform.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_public: newValue }),
      })
      const result = await res.json()
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        newValue
          ? `${platform.regio_platform} is nu publiek`
          : `${platform.regio_platform} is nu verborgen`
      )
      setPlatforms((prev) =>
        prev.map((p) =>
          p.id === platform.id ? { ...p, is_public: newValue } : p
        )
      )
    } catch {
      toast.error("Fout bij bijwerken platform")
    }
  }

  const filtered = platforms.filter((p) => {
    const term = search.toLowerCase()
    return (
      p.regio_platform.toLowerCase().includes(term) ||
      (p.central_place || "").toLowerCase().includes(term) ||
      (p.domain || "").toLowerCase().includes(term)
    )
  })

  const publicCount = platforms.filter((p) => p.is_public).length
  const totalApproved = platforms.reduce((sum, p) => sum + p.approved_count, 0)

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Monitor className="h-8 w-8" />
            Platforms
          </h1>
          <p className="text-muted-foreground mt-1">
            Beheer publieke sites en platform-instellingen
          </p>
        </div>
        <Button variant="outline" onClick={fetchPlatforms} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Vernieuwen
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{platforms.length}</div>
            <div className="text-sm text-muted-foreground">Totaal platforms</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{publicCount}</div>
            <div className="text-sm text-muted-foreground">Publieke sites</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-600">
              {totalApproved.toLocaleString("nl-NL")}
            </div>
            <div className="text-sm text-muted-foreground">
              Goedgekeurde vacatures
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Zoek platform..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Hoofdplaats</TableHead>
                <TableHead>Domein</TableHead>
                <TableHead className="text-center">Publiek</TableHead>
                <TableHead className="text-right">Vacatures</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <span className="text-muted-foreground">Laden...</span>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-12 text-muted-foreground"
                  >
                    Geen platforms gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((platform) => (
                  <TableRow key={platform.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {platform.primary_color && (
                          <div
                            className="w-3 h-3 rounded-full border"
                            style={{ backgroundColor: platform.primary_color }}
                          />
                        )}
                        {platform.regio_platform}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {platform.central_place || "-"}
                    </TableCell>
                    <TableCell>
                      {platform.domain ? (
                        <div className="flex items-center gap-1">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{platform.domain}</span>
                          <a
                            href={`https://${platform.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          Niet ingesteld
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={platform.is_public}
                        onCheckedChange={() => handleTogglePublic(platform)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant={
                          platform.approved_count > 0 ? "default" : "secondary"
                        }
                      >
                        {platform.approved_count.toLocaleString("nl-NL")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/platforms/${platform.id}`}>
                        <Button variant="ghost" size="sm">
                          Bewerken
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

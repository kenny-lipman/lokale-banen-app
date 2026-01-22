"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Settings, Save, RotateCcw, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CampaignAssignmentSettings {
  id: string
  max_total_contacts: number
  max_per_platform: number
  is_enabled: boolean
  delay_between_contacts_ms: number
  updated_at: string
}

interface SettingsCardProps {
  onSettingsChange?: (settings: CampaignAssignmentSettings) => void
}

export function CampaignAssignmentSettingsCard({ onSettingsChange }: SettingsCardProps) {
  const [settings, setSettings] = useState<CampaignAssignmentSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalSettings, setOriginalSettings] = useState<CampaignAssignmentSettings | null>(null)

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/campaign-assignment/settings')
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch settings')
      }

      setSettings(data.settings)
      setOriginalSettings(data.settings)
      setHasChanges(false)
    } catch (err) {
      console.error('Error fetching settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!settings) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch('/api/campaign-assignment/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_total_contacts: settings.max_total_contacts,
          max_per_platform: settings.max_per_platform,
          is_enabled: settings.is_enabled,
          delay_between_contacts_ms: settings.delay_between_contacts_ms
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to save settings')
      }

      setSettings(data.settings)
      setOriginalSettings(data.settings)
      setHasChanges(false)
      onSettingsChange?.(data.settings)
    } catch (err) {
      console.error('Error saving settings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (originalSettings) {
      setSettings(originalSettings)
      setHasChanges(false)
    }
  }

  const updateSetting = <K extends keyof CampaignAssignmentSettings>(
    key: K,
    value: CampaignAssignmentSettings[K]
  ) => {
    if (!settings) return

    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    setHasChanges(
      JSON.stringify(newSettings) !== JSON.stringify(originalSettings)
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Could not load settings'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Instellingen</CardTitle>
          </div>
          {hasChanges && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? 'Opslaan...' : 'Opslaan'}
              </Button>
            </div>
          )}
        </div>
        <CardDescription>
          Configureer de automatische campaign assignment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Enable/Disable toggle */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="is-enabled" className="text-base">
              Automatische assignment
            </Label>
            <p className="text-sm text-muted-foreground">
              Schakel de dagelijkse cron job in of uit
            </p>
          </div>
          <Switch
            id="is-enabled"
            checked={settings.is_enabled}
            onCheckedChange={(checked) => updateSetting('is_enabled', checked)}
          />
        </div>

        {/* Max total contacts */}
        <div className="space-y-2">
          <Label htmlFor="max-total">Maximum contacten per run</Label>
          <Input
            id="max-total"
            type="number"
            min={1}
            max={5000}
            value={settings.max_total_contacts}
            onChange={(e) => updateSetting('max_total_contacts', parseInt(e.target.value) || 500)}
            className="max-w-[200px]"
          />
          <p className="text-sm text-muted-foreground">
            Maximaal aantal contacten dat per dag wordt verwerkt (1-5000)
          </p>
        </div>

        {/* Max per platform */}
        <div className="space-y-2">
          <Label htmlFor="max-per-platform">Maximum per platform</Label>
          <Input
            id="max-per-platform"
            type="number"
            min={1}
            max={500}
            value={settings.max_per_platform}
            onChange={(e) => updateSetting('max_per_platform', parseInt(e.target.value) || 30)}
            className="max-w-[200px]"
          />
          <p className="text-sm text-muted-foreground">
            Maximaal aantal contacten per regio-platform per run (1-500)
          </p>
        </div>

        {/* Delay between contacts */}
        <div className="space-y-2">
          <Label htmlFor="delay">Vertraging tussen contacten (ms)</Label>
          <Input
            id="delay"
            type="number"
            min={100}
            max={5000}
            step={100}
            value={settings.delay_between_contacts_ms}
            onChange={(e) => updateSetting('delay_between_contacts_ms', parseInt(e.target.value) || 500)}
            className="max-w-[200px]"
          />
          <p className="text-sm text-muted-foreground">
            Wachttijd tussen het verwerken van contacten in milliseconden (100-5000)
          </p>
        </div>

        {/* Last updated */}
        <div className="pt-4 border-t text-sm text-muted-foreground">
          Laatst bijgewerkt: {new Date(settings.updated_at).toLocaleString('nl-NL')}
        </div>
      </CardContent>
    </Card>
  )
}

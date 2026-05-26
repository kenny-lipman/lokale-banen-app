"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useCallback } from "react"
import { PlatformAutomationSection } from "@/components/PlatformAutomationSection"
import { ActiveRegionsSection } from "@/components/ActiveRegionsSection"
import { CronJobMonitor } from "@/components/CronJobMonitor"
import { MailerLiteGroupSection } from "@/components/MailerLiteGroupSection"
import { LokaleBanenMappingSection } from "@/components/LokaleBanenMappingSection"
import { BrancheMappingClient } from "@/app/admin/instellingen/branche-mapping/branche-mapping-client"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useAuth } from "@/components/auth-provider"

const VALID_TABS = ["platforms", "regions", "mailerlite", "lokalebanen", "cron", "branche-mapping"] as const
type TabValue = (typeof VALID_TABS)[number]

export default function SettingsPage() {
  const { isAdmin } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()

  const tabParam = searchParams.get("tab")
  const initialTab: TabValue =
    tabParam && (VALID_TABS as readonly string[]).includes(tabParam)
      ? (tabParam as TabValue)
      : "platforms"

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(Array.from(searchParams.entries()))
      if (value === "platforms") params.delete("tab")
      else params.set("tab", value)
      const qs = params.toString()
      router.replace(qs ? `/settings?${qs}` : "/settings", { scroll: false })
    },
    [router, searchParams],
  )

  const tabCols = isAdmin ? "grid-cols-6" : "grid-cols-5"

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">
          Configureer applicatie instellingen
        </p>
      </div>

      <ErrorBoundary>
        <Tabs value={initialTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={`grid w-full ${tabCols}`}>
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="regions">Regio&apos;s</TabsTrigger>
            <TabsTrigger value="mailerlite">MailerLite</TabsTrigger>
            <TabsTrigger value="lokalebanen">Lokale Banen</TabsTrigger>
            <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
            {isAdmin && <TabsTrigger value="branche-mapping">Branche-mapping</TabsTrigger>}
          </TabsList>

          <TabsContent value="platforms">
            <PlatformAutomationSection
              onPreferencesChange={(preferences) => {
                console.log('Platform preferences updated:', preferences)
              }}
            />
          </TabsContent>

          <TabsContent value="regions">
            <ActiveRegionsSection
              onRegionsChange={(regions) => {
                console.log('Active regions updated:', regions)
              }}
            />
          </TabsContent>

          <TabsContent value="mailerlite">
            <MailerLiteGroupSection
              onConfigChange={(config) => {
                console.log('MailerLite config updated:', config)
              }}
            />
          </TabsContent>

          <TabsContent value="lokalebanen">
            <LokaleBanenMappingSection />
          </TabsContent>

          <TabsContent value="cron">
            <CronJobMonitor />
          </TabsContent>

          {isAdmin && (
            <TabsContent value="branche-mapping">
              <BrancheMappingClient />
            </TabsContent>
          )}
        </Tabs>
      </ErrorBoundary>
    </div>
  )
}

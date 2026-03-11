"use client"

import { PlatformAutomationSection } from "@/components/PlatformAutomationSection"
import { ActiveRegionsSection } from "@/components/ActiveRegionsSection"
import { CronJobMonitor } from "@/components/CronJobMonitor"
import { MailerLiteGroupSection } from "@/components/MailerLiteGroupSection"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">
          Configureer applicatie instellingen
        </p>
      </div>

      <ErrorBoundary>
        <Tabs defaultValue="platforms" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="platforms">Platforms</TabsTrigger>
            <TabsTrigger value="regions">Regio&apos;s</TabsTrigger>
            <TabsTrigger value="mailerlite">MailerLite</TabsTrigger>
            <TabsTrigger value="cron">Cron Jobs</TabsTrigger>
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

          <TabsContent value="cron">
            <CronJobMonitor />
          </TabsContent>
        </Tabs>
      </ErrorBoundary>
    </div>
  )
}

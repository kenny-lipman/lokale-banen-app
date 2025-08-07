"use client"

import { PlatformAutomationSection } from "@/components/PlatformAutomationSection"
import { ErrorBoundary } from "@/components/ErrorBoundary"

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
        <div className="space-y-8">
          <PlatformAutomationSection 
            onPreferencesChange={(preferences) => {
              console.log('Platform preferences updated:', preferences)
            }}
          />
          
          {/* Future settings sections can be added here */}
        </div>
      </ErrorBoundary>
    </div>
  )
}

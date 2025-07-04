"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Bot, Play } from "lucide-react"
import { JobPostingsTable } from "@/components/job-postings-table"
import { CompanyDrawer } from "@/components/company-drawer"
import { supabaseService } from "@/lib/supabase-service"

export default function AgentsPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<any>(null)
  const [formData, setFormData] = useState({
    locatie: "",
    functie: "",
    platform: "",
  })
  const { toast } = useToast()

  const handleStartOtis = async () => {
    if (!formData.locatie || !formData.functie || !formData.platform) {
      toast({
        title: "Velden vereist",
        description: "Vul alle velden in om Otis te starten.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Create search request in database
      const searchQuery = `${formData.functie} in ${formData.locatie} via ${formData.platform}`
      const searchRequest = await supabaseService.createSearchRequest(searchQuery)

      // Call webhook to start scraping
      const response = await fetch("https://ba.grive-dev.com/webhook/ddb2acdd-5cb7-4a4a-b0e7-30bc4abc7015", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: formData.locatie,
          function: formData.functie,
          platform: formData.platform,
          search_request_id: searchRequest.id,
        }),
      })

      if (response.ok) {
        toast({
          title: "Otis gestart! 🤖",
          description: `Scraping gestart voor ${formData.functie} in ${formData.locatie} via ${formData.platform}`,
        })

        // Reset form
        setFormData({ locatie: "", functie: "", platform: "" })
      } else {
        // Update search request as failed
        await supabaseService.updateSearchRequest(searchRequest.id, "failed")
        throw new Error("Failed to start scraping")
      }
    } catch (error) {
      toast({
        title: "Fout",
        description: "Er is een fout opgetreden bij het starten van Otis.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Otis Agent</h1>
          <p className="text-gray-600 mt-2">Job vacancy scraping and management agent</p>
        </div>
      </div>

      {/* Otis Agent Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Otis</CardTitle>
              <CardDescription>Job vacancy scraping and management agent</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label htmlFor="locatie">Locatie</Label>
              <Input
                id="locatie"
                placeholder="bijv. Rotterdam"
                value={formData.locatie}
                onChange={(e) => setFormData({ ...formData, locatie: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="functie">Functie</Label>
              <Input
                id="functie"
                placeholder="bijv. vrachtwagenchauffeur"
                value={formData.functie}
                onChange={(e) => setFormData({ ...formData, functie: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="platform">Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(value) => setFormData({ ...formData, platform: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer platform" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Indeed">Indeed</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="Andere">Andere</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleStartOtis}
                disabled={isLoading}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Start Otis
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Postings Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Vacatureoverzicht</CardTitle>
          <CardDescription>Alle gescrapte vacatures van Otis</CardDescription>
        </CardHeader>
        <CardContent>
          <JobPostingsTable onCompanyClick={setSelectedCompany} />
        </CardContent>
      </Card>

      {/* Company Detail Drawer */}
      <CompanyDrawer company={selectedCompany} open={!!selectedCompany} onClose={() => setSelectedCompany(null)} />
    </div>
  )
}

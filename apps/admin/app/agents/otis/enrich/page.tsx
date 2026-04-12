"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { 
  Search, 
  Building2, 
  Users, 
  Mail, 
  Phone, 
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  ArrowRight,
  Filter,
  Download,
  RefreshCw
} from "lucide-react"
import Link from "next/link"
import { supabaseService } from "@/lib/supabase-service"

interface Company {
  id: string
  name: string
  website?: string | null
  location?: string | null
  jobCount: number
  apollo_enriched_at?: string | null
  apollo_contacts_count?: number | null
}

interface Contact {
  id: string
  name: string | null
  email: string | null
  title: string | null
  phone: string | null
  company_id: string
  companies?: {
    name: string | null
    location: string | null
  }
}

export default function ApolloEnrichmentPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])
  const [enrichmentProgress, setEnrichmentProgress] = useState(0)
  const [isEnriching, setIsEnriching] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Load companies and contacts from database
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        
        // Load companies from the database
        const companiesData = await supabaseService.getCompanies()
        const companiesWithJobCounts = companiesData.map(company => ({
          id: company.id,
          name: company.name,
          website: company.website,
          location: company.location,
          jobCount: company.job_counts || 0,
          apollo_enriched_at: company.apollo_enriched_at,
          apollo_contacts_count: company.apollo_contacts_count
        }))
        
        setCompanies(companiesWithJobCounts)

        // Load contacts for enriched companies
        const enrichedCompanyIds = companiesWithJobCounts
          .filter(c => c.apollo_enriched_at)
          .map(c => c.id)
        
        if (enrichedCompanyIds.length > 0) {
          const contactsData = await supabaseService.getContacts()
          const contactsForEnrichedCompanies = contactsData.filter(contact => 
            contact.company_id && enrichedCompanyIds.includes(contact.company_id)
          )
          setContacts(contactsForEnrichedCompanies)
        }
      } catch (error) {
        console.error('Error loading data:', error)
        toast({
          title: "Fout bij laden data",
          description: "Er is een fout opgetreden bij het laden van de gegevens",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [toast])

  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase())
    const isEnriched = !!company.apollo_enriched_at
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "enriched" && isEnriched) ||
      (statusFilter === "pending" && !isEnriched)
    return matchesSearch && matchesStatus
  })

  const enrichedCompanies = companies.filter(c => c.apollo_enriched_at)
  const totalContacts = contacts.length

  const handleEnrichSelected = async () => {
    if (selectedCompanies.length === 0) return
    
    setIsEnriching(true)
    setEnrichmentProgress(0)
    
    toast({
      title: "🚀 Apollo verrijking gestart",
      description: `${selectedCompanies.length} bedrijven worden verrijkt met contactgegevens`,
    })

    // Simulate enrichment progress
    for (let i = 0; i <= 100; i += 10) {
      setTimeout(() => setEnrichmentProgress(i), i * 50)
    }
    
    // Simulate API call
    setTimeout(() => {
      setCompanies(prev => prev.map(company => 
        selectedCompanies.includes(company.id) 
          ? { 
              ...company, 
              apollo_enriched_at: new Date().toISOString(),
              apollo_contacts_count: 1
            }
          : company
      ))
      setSelectedCompanies([])
      setIsEnriching(false)
      setEnrichmentProgress(0)
      toast({
        title: "✅ Verrijking voltooid",
        description: "Bedrijfsgegevens zijn succesvol verrijkt met Apollo",
      })
    }, 3000)
  }

  const getStatusBadge = (company: Company) => {
    if (company.apollo_enriched_at) {
      return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />Verrijkt</Badge>
    } else {
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />In wachtrij</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Laden van gegevens...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/agents/otis/enhanced" className="text-orange-600 hover:text-orange-800 text-sm">
              ← Terug naar Otis Agent
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            Apollo Bedrijfsverrijking
          </h1>
          <p className="text-gray-600 mt-2">Verrijk bedrijfsgegevens met contactpersonen voor email campagnes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Vernieuwen
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Totaal Bedrijven</p>
                <p className="text-2xl font-bold">{companies.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Verrijkt</p>
                <p className="text-2xl font-bold text-green-600">{enrichedCompanies.length}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Contacten Gevonden</p>
                <p className="text-2xl font-bold text-blue-600">{totalContacts}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Geselecteerd</p>
                <p className="text-2xl font-bold text-orange-600">{selectedCompanies.length}</p>
              </div>
              <Filter className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar (shown during enrichment) */}
      {isEnriching && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Apollo verrijking in uitvoering...</h3>
                <span className="text-sm text-gray-600">{enrichmentProgress}%</span>
              </div>
              <Progress value={enrichmentProgress} className="w-full" />
              <p className="text-sm text-gray-600">
                Bedrijfsgegevens worden verrijkt met contactinformatie van Apollo
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Bedrijven Verrijken
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Scraped Contacts
          </TabsTrigger>
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Bedrijven uit Otis Scraping Run</CardTitle>
                  <CardDescription>Selecteer bedrijven om te verrijken met Apollo contactgegevens</CardDescription>
                </div>
                <Button 
                  onClick={handleEnrichSelected}
                  disabled={selectedCompanies.length === 0 || isEnriching}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isEnriching ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Verrijken...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Verrijk Geselecteerde ({selectedCompanies.length})
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder="Zoek bedrijven..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter op status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle statussen</SelectItem>
                    <SelectItem value="pending">In wachtrij</SelectItem>
                    <SelectItem value="enriched">Verrijkt</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Companies Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedCompanies.length === filteredCompanies.filter(c => !c.apollo_enriched_at).length}
                          onChange={(e) => {
                            const selectableCompanies = filteredCompanies.filter(c => !c.apollo_enriched_at)
                            setSelectedCompanies(e.target.checked ? selectableCompanies.map(c => c.id) : [])
                          }}
                        />
                      </TableHead>
                      <TableHead>Bedrijf</TableHead>
                      <TableHead>Locatie</TableHead>
                      <TableHead>Vacatures</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Contacten</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCompanies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell>
                          {!company.apollo_enriched_at && (
                            <input
                              type="checkbox"
                              checked={selectedCompanies.includes(company.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCompanies([...selectedCompanies, company.id])
                                } else {
                                  setSelectedCompanies(selectedCompanies.filter(id => id !== company.id))
                                }
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-gray-500" />
                            </div>
                            <div>
                              <div className="font-medium">{company.name}</div>
                              {company.website && (
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {company.website}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{company.location}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{company.jobCount} vacatures</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(company)}</TableCell>
                        <TableCell>
                          {company.apollo_enriched_at ? (
                            <Badge className="bg-blue-100 text-blue-800">
                              <Users className="w-3 h-3 mr-1" />
                              {company.apollo_contacts_count || 0} contacten
                            </Badge>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Scraped Contacts</CardTitle>
                  <CardDescription>Contactpersonen van verrijkte bedrijven</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Geen contacten gevonden</h3>
                  <p className="text-gray-500 mb-4">Verrijk eerst bedrijven in het "Bedrijven Verrijken" tabblad</p>
                  <Button variant="outline" onClick={() => document.querySelector('[value="companies"]')?.click()}>
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Ga naar Bedrijven Verrijken
                  </Button>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Naam</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Titel</TableHead>
                        <TableHead>Telefoon</TableHead>
                        <TableHead>Bedrijf</TableHead>
                        <TableHead>Locatie</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <div className="font-medium">{contact.name || 'Onbekend'}</div>
                          </TableCell>
                          <TableCell>
                            {contact.email ? (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-gray-400" />
                                {contact.email}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>{contact.title || '-'}</TableCell>
                          <TableCell>
                            {contact.phone ? (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-gray-400" />
                                {contact.phone}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell>{contact.companies?.name || '-'}</TableCell>
                          <TableCell>{contact.companies?.location || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 
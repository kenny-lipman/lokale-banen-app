"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { AlertCircle, Loader2, HelpCircle, Search } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { authenticatedGet } from "@/lib/api-client"

// Simplified schema with single block_type selector
const blocklistSchema = z.object({
  block_type: z.enum(["email", "company", "domain", "contact"], {
    required_error: "Selecteer wat je wilt blokkeren",
  }),
  value: z.string().optional(), // For email/domain input
  company_id: z.string().uuid().optional().nullable(),
  contact_id: z.string().uuid().optional().nullable(),
  reason: z.string().min(1, "Reden is verplicht").max(500, "Reden mag maximaal 500 karakters zijn"),
  is_active: z.boolean().default(true),
})

type BlocklistFormData = z.infer<typeof blocklistSchema>

interface BlocklistFormProps {
  initialData?: {
    id?: string
    block_type?: "email" | "company" | "domain" | "contact"
    value?: string
    reason: string
    company_id?: string | null
    contact_id?: string | null
    is_active: boolean
  }
  onSubmit: (data: BlocklistFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

interface Company {
  id: string
  name: string
}

interface Contact {
  id: string
  name: string
  email: string
  company_id: string
}

export function BlocklistForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: BlocklistFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [openCompany, setOpenCompany] = useState(false)
  const [openContact, setOpenContact] = useState(false)
  const [searchCompany, setSearchCompany] = useState("")
  const [searchContact, setSearchContact] = useState("")
  const isEditing = !!initialData?.id

  const form = useForm<BlocklistFormData>({
    resolver: zodResolver(blocklistSchema),
    defaultValues: initialData || {
      block_type: "email",
      value: "",
      reason: "",
      company_id: null,
      contact_id: null,
      is_active: true,
    },
  })

  const watchBlockType = form.watch("block_type")
  const watchCompanyId = form.watch("company_id")

  // Load companies when search changes
  useEffect(() => {
    const loadCompanies = async (searchTerm = '') => {
      setLoadingCompanies(true)
      try {
        const params = new URLSearchParams()
        if (searchTerm) {
          params.append('search', searchTerm)
        }
        params.append('limit', '50')

        console.log('Fetching companies:', `/api/companies/search?${params}`)
        const response = await authenticatedGet(`/api/companies/search?${params}`)
        console.log('Companies response status:', response.status)

        if (response.ok) {
          const data = await response.json()
          console.log('Companies data received:', data)
          setCompanies(data.companies || [])
        } else {
          console.error('Companies API failed with status:', response.status, response.statusText)
          try {
            const errorData = await response.json()
            console.error('Companies API error data:', errorData)
          } catch (jsonError) {
            console.error('Could not parse error response as JSON:', jsonError)
          }
        }
      } catch (err) {
        console.error('Failed to load companies:', err)
      } finally {
        setLoadingCompanies(false)
      }
    }

    // Debounce search
    const timeoutId = setTimeout(() => {
      loadCompanies(searchCompany)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchCompany])

  // Load contacts when company or search changes
  useEffect(() => {
    if (watchCompanyId) {
      const loadContacts = async (searchTerm = '') => {
        setLoadingContacts(true)
        try {
          const params = new URLSearchParams()
          params.append('company_id', watchCompanyId)
          if (searchTerm) {
            params.append('search', searchTerm)
          }
          params.append('limit', '50')

          const response = await authenticatedGet(`/api/contacts/search?${params}`)
          if (response.ok) {
            const data = await response.json()
            setContacts(data.contacts || [])
          }
        } catch (err) {
          console.error('Failed to load contacts:', err)
        } finally {
          setLoadingContacts(false)
        }
      }

      // Debounce search
      const timeoutId = setTimeout(() => {
        loadContacts(searchContact)
      }, 300)

      return () => clearTimeout(timeoutId)
    } else {
      setContacts([])
    }
  }, [watchCompanyId, searchContact])

  // Validation based on block type
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "value" || name === "block_type") {
        const val = value.value?.toLowerCase().trim()
        const blockType = value.block_type

        // Only validate if we have a value and it's a type that uses the value field
        if (!val || (blockType !== "email" && blockType !== "domain")) {
          form.clearErrors("value")
          return
        }

        const currentError = form.formState.errors.value?.message

        if (blockType === "email") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          const isValid = emailRegex.test(val)
          const errorMessage = "Ongeldig e-mailadres formaat"

          if (!isValid && currentError !== errorMessage) {
            form.setError("value", {
              type: "manual",
              message: errorMessage,
            })
          } else if (isValid && currentError === errorMessage) {
            form.clearErrors("value")
          }
        } else if (blockType === "domain") {
          // Allow wildcard domains like *.example.com
          const domainRegex = /^(\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
          const isValid = domainRegex.test(val)
          const errorMessage = "Ongeldig domein formaat. Gebruik bijvoorbeeld: example.com of *.example.com"

          if (!isValid && currentError !== errorMessage) {
            form.setError("value", {
              type: "manual",
              message: errorMessage,
            })
          } else if (isValid && (currentError === errorMessage || currentError === "Ongeldig e-mailadres formaat")) {
            form.clearErrors("value")
          }
        }
      }

      // Validate company selection for company/contact block types
      if (name === "block_type") {
        const blockType = value.block_type
        if (blockType === "company" || blockType === "contact") {
          if (!value.company_id) {
            form.setError("company_id", {
              type: "manual",
              message: "Selecteer een bedrijf",
            })
          }
        } else {
          form.clearErrors("company_id")
        }

        if (blockType === "contact" && value.company_id && !value.contact_id) {
          form.setError("contact_id", {
            type: "manual",
            message: "Selecteer een contact",
          })
        } else if (blockType !== "contact") {
          form.clearErrors("contact_id")
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const handleSubmit = async (data: BlocklistFormData) => {
    try {
      setError(null)

      // Validate required fields based on block type
      if (data.block_type === "email" || data.block_type === "domain") {
        if (!data.value || data.value.trim() === "") {
          setError(`${data.block_type === "email" ? "E-mailadres" : "Domein"} is verplicht`)
          return
        }
      } else if (data.block_type === "company") {
        if (!data.company_id) {
          setError("Selecteer een bedrijf")
          return
        }
      } else if (data.block_type === "contact") {
        if (!data.company_id || !data.contact_id) {
          setError("Selecteer een bedrijf en contact")
          return
        }
      }

      // Submit with cleaned data
      const submitData = {
        ...data,
        value: data.value?.trim() || undefined
      }

      await onSubmit(submitData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Er is een fout opgetreden")
    }
  }

  return (
    <TooltipProvider>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="block_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Wat wil je blokkeren?</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(value)
                  // Clear other fields when changing type
                  form.setValue("value", "")
                  form.setValue("company_id", null)
                  form.setValue("contact_id", null)
                }}
                value={field.value}
                disabled={isEditing}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Maak een keuze..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center">
                      <span>Specifiek e-mailadres</span>
                      <span className="ml-2 text-xs text-muted-foreground">(bijv. jan@bedrijf.nl)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="company">
                    <div className="flex items-center">
                      <span>Heel bedrijf</span>
                      <span className="ml-2 text-xs text-muted-foreground">(selecteer uit lijst)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="domain">
                    <div className="flex items-center">
                      <span>Heel domein</span>
                      <span className="ml-2 text-xs text-muted-foreground">(bijv. @spam.nl)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="contact">
                    <div className="flex items-center">
                      <span>Contact bij bedrijf</span>
                      <span className="ml-2 text-xs text-muted-foreground">(selecteer bedrijf, dan contact)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Kies wat je wilt blokkeren voor e-mailcampagnes
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {(watchBlockType === "company" || watchBlockType === "contact") && (
          <FormField
            control={form.control}
            name="company_id"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Bedrijf</FormLabel>
                <Popover open={openCompany} onOpenChange={setOpenCompany}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? companies.find((company) => company.id === field.value)?.name
                          : "Selecteer een bedrijf..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput
                        placeholder="Zoek bedrijf..."
                        value={searchCompany}
                        onValueChange={setSearchCompany}
                      />
                      <CommandEmpty>
                        {loadingCompanies
                          ? "Bedrijven laden..."
                          : searchCompany
                            ? `Geen bedrijf gevonden voor "${searchCompany}"`
                            : "Typ om bedrijven te zoeken..."
                        }
                      </CommandEmpty>
                      <CommandGroup>
                        {companies
                          .slice(0, 20)
                          .map((company) => (
                            <CommandItem
                              key={company.id}
                              value={company.name}
                              onSelect={() => {
                                form.setValue("company_id", company.id)
                                form.setValue("contact_id", null) // Reset contact when company changes
                                setOpenCompany(false)
                              }}
                            >
                              {company.name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  Selecteer het bedrijf dat geblokkeerd moet worden
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {watchBlockType === "contact" && watchCompanyId && (
          <FormField
            control={form.control}
            name="contact_id"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Contact</FormLabel>
                <Popover open={openContact} onOpenChange={setOpenContact}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={loadingContacts || !watchCompanyId}
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? contacts.find((contact) => contact.id === field.value)?.name ||
                            contacts.find((contact) => contact.id === field.value)?.email ||
                            'Contact geselecteerd'
                          : loadingContacts ? "Contacten laden..." : "Selecteer een contact..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput
                        placeholder="Zoek contact..."
                        value={searchContact}
                        onValueChange={setSearchContact}
                      />
                      <CommandEmpty>
                        {loadingContacts
                          ? "Contacten laden..."
                          : searchContact
                            ? `Geen contact gevonden voor "${searchContact}"`
                            : "Typ om contacten te zoeken..."
                        }
                      </CommandEmpty>
                      <CommandGroup>
                        {contacts
                          .slice(0, 20)
                          .map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={contact.name || contact.email || contact.id}
                              onSelect={() => {
                                form.setValue("contact_id", contact.id)
                                // Auto-fill email if not already set
                                if (!form.getValues("value") && contact.email) {
                                  form.setValue("value", contact.email)
                                }
                                setOpenContact(false)
                              }}
                            >
                              <div className="flex flex-col">
                                <span>{contact.name || contact.email || 'Unnamed Contact'}</span>
                                <span className="text-sm text-muted-foreground">{contact.email}</span>
                              </div>
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormDescription>
                  Selecteer het contact dat geblokkeerd moet worden
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {(watchBlockType === "email" || watchBlockType === "domain") && (
          <FormField
            control={form.control}
            name="value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {watchBlockType === "email" ? "E-mailadres" : "Domein"}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={
                      watchBlockType === "email"
                        ? "bijvoorbeeld@email.com"
                        : "example.com of @example.com"
                    }
                    {...field}
                    disabled={isEditing && initialData?.block_type === "email"}
                  />
                </FormControl>
                <FormDescription>
                  {watchBlockType === "email"
                    ? "Vul het complete e-mailadres in dat geblokkeerd moet worden"
                    : "Vul het domein in (met of zonder @). Gebruik *.domein.com voor subdomeinen"}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reden</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Waarom wordt dit geblokkeerd?"
                  className="resize-none"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Geef een duidelijke reden voor het blokkeren (max 500 karakters)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-1">
                  <FormLabel className="text-base">Actief</FormLabel>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-sm">
                        <strong>Actief:</strong> Entry blokkeert emails/domeinen.<br/>
                        <strong>Inactief:</strong> Entry is uitgeschakeld maar blijft bestaan.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <FormDescription>
                  Wanneer actief, wordt dit item gebruikt voor het filteren van contacten
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={loading}
          >
            Annuleren
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Opslaan" : "Toevoegen"}
          </Button>
        </div>
        </form>
      </Form>
    </TooltipProvider>
  )
}
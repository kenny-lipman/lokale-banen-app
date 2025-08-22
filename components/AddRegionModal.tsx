"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

// Form validation schema
const formSchema = z.object({
  plaats: z.string().min(1, "Plaats is verplicht"),
  postcode: z.string()
    .min(4, "Postcode moet 4 cijfers zijn")
    .max(4, "Postcode moet 4 cijfers zijn")
    .regex(/^[0-9]{4}$/, "Postcode moet het format 1234 hebben"),
  regio_platform: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface AddRegionModalProps {
  onRegionAdded?: () => void
  trigger?: React.ReactNode
}

export function AddRegionModal({ onRegionAdded, trigger }: AddRegionModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [platforms, setPlatforms] = useState<string[]>([])
  const [showNewPlatformField, setShowNewPlatformField] = useState(false)
  const [newPlatformName, setNewPlatformName] = useState("")
  const [centralPlace, setCentralPlace] = useState("")
  const [centralPostcode, setCentralPostcode] = useState("")

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      plaats: "",
      postcode: "",
      regio_platform: "",
    },
  })

  // Fetch available platforms when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchPlatforms()
    }
  }, [isOpen])

  const fetchPlatforms = async () => {
    try {
      const response = await fetch("/api/platforms")
      const result = await response.json()
      if (result.success) {
        setPlatforms(result.data)
      } else {
        console.error("Failed to fetch platforms:", result.error)
        toast.error("Kon platforms niet laden")
      }
    } catch (error) {
      console.error("Error fetching platforms:", error)
      toast.error("Kon platforms niet laden")
    }
  }

  const onSubmit = async (data: FormData) => {
    setIsLoading(true)
    try {
      let finalPlatform = data.regio_platform
      let platformId: string | undefined

      // If creating a new platform, create it first
      if (showNewPlatformField) {
        // Validate new platform fields
        if (!newPlatformName || newPlatformName.trim() === "") {
          toast.error("Platform naam is verplicht")
          setIsLoading(false)
          return
        }
        if (!centralPlace || centralPlace.trim() === "") {
          toast.error("Centrale plaats is verplicht voor nieuwe platforms")
          setIsLoading(false)
          return
        }
        if (!centralPostcode || centralPostcode.trim() === "") {
          toast.error("Centrale postcode is verplicht voor nieuwe platforms")
          setIsLoading(false)
          return
        }

        // Create the new platform first
        const platformResponse = await fetch("/api/platforms", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: newPlatformName,
            central_place: centralPlace,
            central_postcode: centralPostcode,
          }),
        })

        const platformResult = await platformResponse.json()

        if (!platformResult.success) {
          toast.error(platformResult.error || "Fout bij aanmaken platform")
          setIsLoading(false)
          return
        }

        finalPlatform = newPlatformName
        // Store the newly created platform ID for linking
        platformId = platformResult.data.id
        toast.success("Platform succesvol aangemaakt!")
      } else {
        // For existing platforms, fetch the platform ID by name
        const platformsResponse = await fetch("/api/platforms/by-name?name=" + encodeURIComponent(finalPlatform || ""))
        const platformsResult = await platformsResponse.json()
        
        if (platformsResult.success && platformsResult.data) {
          platformId = platformsResult.data.id
        } else {
          console.warn("Could not find platform ID for existing platform:", finalPlatform)
        }
      }

      // Validate platform selection
      if (!finalPlatform || finalPlatform.trim() === "") {
        toast.error("Platform is verplicht")
        setIsLoading(false)
        return
      }

      // Now create the region
      const response = await fetch("/api/regions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plaats: data.plaats,
          postcode: data.postcode,
          regio_platform: finalPlatform,
          platform_id: platformId,
          central_place: showNewPlatformField ? centralPlace : undefined,
          central_postcode: showNewPlatformField ? centralPostcode : undefined,
          is_new_platform: showNewPlatformField,
        }),
      })

      const result = await response.json()

      if (result.success) {
        toast.success("Regio succesvol toegevoegd!")
        
        // Reset form and close modal
        form.reset()
        setShowNewPlatformField(false)
        setNewPlatformName("")
        setCentralPlace("")
        setCentralPostcode("")
        setIsOpen(false)
        
        // Refresh regions list
        if (onRegionAdded) {
          onRegionAdded()
        }
      } else {
        toast.error(result.error || "Er is een fout opgetreden")
      }
    } catch (error) {
      console.error("Error creating region:", error)
      toast.error("Er is een fout opgetreden bij het toevoegen van de regio")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePlatformChange = (value: string) => {
    if (value === "CREATE_NEW") {
      setShowNewPlatformField(true)
      form.setValue("regio_platform", "NEW_PLATFORM_PLACEHOLDER")
    } else {
      setShowNewPlatformField(false)
      form.setValue("regio_platform", value)
    }
  }

  const handleModalClose = () => {
    // Reset form state when modal closes
    form.reset()
    setShowNewPlatformField(false)
    setNewPlatformName("")
    setCentralPlace("")
    setCentralPostcode("")
    setIsOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : handleModalClose()}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Voeg regio toe
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nieuwe regio toevoegen</DialogTitle>
          <DialogDescription>
            Voeg een nieuwe regio toe aan de database. Alle velden zijn verplicht.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="plaats"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plaats</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="bijv. Amsterdam" 
                      {...field} 
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postcode</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="bijv. 1234" 
                      {...field}
                      disabled={isLoading}
                      maxLength={4}
                      onChange={(e) => {
                        // Only allow numbers and limit to 4 digits
                        const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                        field.onChange(value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="regio_platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  
                  {!showNewPlatformField ? (
                    <Select 
                      onValueChange={(value) => {
                        handlePlatformChange(value)
                        field.onChange(value === "CREATE_NEW" ? "" : value)
                      }} 
                      disabled={isLoading}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecteer een platform" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[300px] overflow-y-auto">
                        {platforms.length === 0 ? (
                          <SelectItem value="LOADING" disabled>
                            Platforms laden...
                          </SelectItem>
                        ) : (
                          <>
                            {platforms.map((platform) => (
                              <SelectItem key={platform} value={platform}>
                                {platform}
                              </SelectItem>
                            ))}
                            <Separator className="my-1" />
                            <SelectItem value="CREATE_NEW" className="text-orange-600 font-medium">
                              <Plus className="w-4 h-4 mr-2 inline" />
                              Nieuw platform aanmaken
                            </SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                <div className="space-y-3 p-4 border rounded-lg bg-orange-50">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-orange-900">Nieuw platform aanmaken</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowNewPlatformField(false)
                        setNewPlatformName("")
                        setCentralPlace("")
                        setCentralPostcode("")
                      }}
                      disabled={isLoading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Platform naam</label>
                      <Input
                        placeholder="bijv. AmsterdamseBanen"
                        value={newPlatformName}
                        onChange={(e) => setNewPlatformName(e.target.value)}
                        disabled={isLoading}
                        className="mt-1"
                      />
                      {newPlatformName.trim() === "" && (
                        <p className="text-sm text-red-500 mt-1">Platform naam is verplicht</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Centrale plaats</label>
                      <Input
                        placeholder="bijv. Amsterdam (hoofdlocatie voor scraping)"
                        value={centralPlace}
                        onChange={(e) => setCentralPlace(e.target.value)}
                        disabled={isLoading}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-500 mt-1">Deze locatie wordt gebruikt als centrale plaats voor job scraping</p>
                      {centralPlace.trim() === "" && (
                        <p className="text-sm text-red-500 mt-1">Centrale plaats is verplicht</p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Centrale postcode</label>
                      <Input
                        placeholder="bijv. 1012"
                        value={centralPostcode}
                        onChange={(e) => {
                          // Only allow numbers and limit to 4 digits
                          const value = e.target.value.replace(/\D/g, '').slice(0, 4)
                          setCentralPostcode(value)
                        }}
                        disabled={isLoading}
                        className="mt-1"
                        maxLength={4}
                      />
                      <p className="text-xs text-gray-500 mt-1">Postcode van de centrale locatie voor job scraping (4 cijfers)</p>
                      {centralPostcode.trim() === "" && (
                        <p className="text-sm text-red-500 mt-1">Centrale postcode is verplicht</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <FormMessage />
              </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleModalClose}
                disabled={isLoading}
              >
                Annuleren
              </Button>
              <Button
                type="submit"
                disabled={isLoading || (showNewPlatformField && (
                  newPlatformName.trim() === "" || 
                  centralPlace.trim() === "" || 
                  centralPostcode.trim() === ""
                ))}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isLoading ? "Toevoegen..." : "Regio toevoegen"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
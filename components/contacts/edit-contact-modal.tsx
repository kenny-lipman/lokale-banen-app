"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
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
import { useToast } from "@/hooks/use-toast"
import { Loader2, Save, X } from "lucide-react"
import { ContactUpdateRequest } from "@/types/contact"

// Zod schema voor validatie
const contactEditSchema = z.object({
  first_name: z.string().min(1, "Voornaam is verplicht"),
  last_name: z.string().min(1, "Achternaam is verplicht"),
  qualification_status: z.enum([
    "pending",
    "qualified",
    "disqualified",
    "review",
    "in_campaign"
  ]),
  email: z.string().email("Ongeldig emailadres").or(z.literal("")),
  title: z.string().optional(),
  phone: z.string().regex(
    /^(\+31|0031|06|0[1-9])[0-9\s\-]{7,}$/,
    "Ongeldig Nederlands telefoonnummer"
  ).or(z.literal("")),
})

type ContactEditFormData = z.infer<typeof contactEditSchema>

interface EditContactModalProps {
  contact: any
  isOpen: boolean
  onClose: () => void
  onSuccess: (updatedContact: any) => void
}

export function EditContactModal({
  contact,
  isOpen,
  onClose,
  onSuccess
}: EditContactModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const form = useForm<ContactEditFormData>({
    resolver: zodResolver(contactEditSchema),
    defaultValues: {
      first_name: contact?.first_name || "",
      last_name: contact?.last_name || "",
      qualification_status: contact?.qualification_status || "pending",
      email: contact?.email || "",
      title: contact?.title || "",
      phone: contact?.phone || "",
    },
  })

  // Reset form wanneer contact wijzigt
  useEffect(() => {
    if (contact) {
      form.reset({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        qualification_status: contact.qualification_status || "pending",
        email: contact.email || "",
        title: contact.title || "",
        phone: contact.phone || "",
      })
    }
  }, [contact, form])

  const onSubmit = async (data: ContactEditFormData) => {
    setIsLoading(true)

    try {
      // Build update request with only changed fields
      const updateData: ContactUpdateRequest = {}
      const fields: (keyof ContactEditFormData)[] = [
        'first_name', 'last_name', 'qualification_status',
        'email', 'title', 'phone'
      ]

      fields.forEach(field => {
        const newValue = data[field]
        const oldValue = contact?.[field]
        
        // Only include field if it changed
        if (newValue !== oldValue) {
          updateData[field as keyof ContactUpdateRequest] = newValue as any
        }
      })

      // Only make API call if there are changes
      if (Object.keys(updateData).length === 0) {
        toast({
          title: "Geen wijzigingen",
          description: "Er zijn geen wijzigingen om op te slaan",
          variant: "default"
        })
        setIsLoading(false)
        return
      }

      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update contact')
      }

      toast({
        title: "Succes",
        description: "Contact is succesvol bijgewerkt",
      })

      onSuccess(result.data)
      onClose()
    } catch (error) {
      console.error('Error updating contact:', error)
      toast({
        title: "Fout",
        description: error instanceof Error ? error.message : "Er is een fout opgetreden bij het bijwerken",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contact Bewerken</DialogTitle>
          <DialogDescription>
            Wijzig de essentiële gegevens van het contact. Velden met * zijn verplicht.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Voornaam */}
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voornaam *</FormLabel>
                    <FormControl>
                      <Input placeholder="Jan" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Achternaam */}
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Achternaam *</FormLabel>
                    <FormControl>
                      <Input placeholder="Jansen" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Kwalificatiestatus */}
            <FormField
              control={form.control}
              name="qualification_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kwalificatiestatus *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending">⏳ Pending</SelectItem>
                      <SelectItem value="qualified">✅ Qualified</SelectItem>
                      <SelectItem value="disqualified">❌ Disqualified</SelectItem>
                      <SelectItem value="review">⭕ Review</SelectItem>
                      <SelectItem value="in_campaign">🎯 In Campaign</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="jan@bedrijf.nl" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Telefoonnummer */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefoonnummer</FormLabel>
                    <FormControl>
                      <Input 
                        type="tel" 
                        placeholder="06-12345678" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Nederlands nummer (06, 020, etc.)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Functie */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Functie</FormLabel>
                  <FormControl>
                    <Input placeholder="Sales Manager" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                <X className="w-4 h-4 mr-2" />
                Annuleren
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Opslaan...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Wijzigingen opslaan
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
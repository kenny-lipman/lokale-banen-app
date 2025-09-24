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
import { AlertCircle, Loader2, HelpCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const blocklistSchema = z.object({
  type: z.enum(["email", "domain"], {
    required_error: "Selecteer een type",
  }),
  value: z
    .string()
    .min(1, "Waarde is verplicht")
    .transform((val) => val.toLowerCase().trim())
    .refine(
      (val) => {
        // Basic validation - more detailed validation will be done based on type
        return val.length > 0
      },
      { message: "Ongeldige waarde" }
    ),
  reason: z.string().min(1, "Reden is verplicht").max(500, "Reden mag maximaal 500 karakters zijn"),
  is_active: z.boolean().default(true),
})

type BlocklistFormData = z.infer<typeof blocklistSchema>

interface BlocklistFormProps {
  initialData?: {
    id?: string
    type: "email" | "domain"
    value: string
    reason: string
    is_active: boolean
  }
  onSubmit: (data: BlocklistFormData) => Promise<void>
  onCancel: () => void
  loading?: boolean
}

export function BlocklistForm({
  initialData,
  onSubmit,
  onCancel,
  loading = false,
}: BlocklistFormProps) {
  const [error, setError] = useState<string | null>(null)
  const isEditing = !!initialData?.id

  const form = useForm<BlocklistFormData>({
    resolver: zodResolver(blocklistSchema),
    defaultValues: initialData || {
      type: "email",
      value: "",
      reason: "",
      is_active: true,
    },
  })

  const watchType = form.watch("type")

  // Additional validation based on type
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === "value" || name === "type") {
        const val = value.value?.toLowerCase().trim()
        if (!val) return

        if (value.type === "email") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          if (!emailRegex.test(val)) {
            form.setError("value", {
              type: "manual",
              message: "Ongeldig e-mailadres formaat",
            })
          } else {
            form.clearErrors("value")
          }
        } else if (value.type === "domain") {
          // Allow wildcard domains like *.example.com
          const domainRegex = /^(\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
          if (!domainRegex.test(val)) {
            form.setError("value", {
              type: "manual",
              message: "Ongeldig domein formaat. Gebruik bijvoorbeeld: example.com of *.example.com",
            })
          } else {
            form.clearErrors("value")
          }
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [form])

  const handleSubmit = async (data: BlocklistFormData) => {
    try {
      setError(null)
      await onSubmit(data)
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
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
                disabled={isEditing}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer een type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="domain">Domein</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                Kies of je een specifiek e-mailadres of een volledig domein wilt blokkeren
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="value"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {watchType === "email" ? "E-mailadres" : "Domein"}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    watchType === "email"
                      ? "bijvoorbeeld@email.com"
                      : "example.com of *.example.com"
                  }
                  {...field}
                  disabled={isEditing && initialData?.type === "email"}
                />
              </FormControl>
              <FormDescription>
                {watchType === "email"
                  ? "Het e-mailadres dat geblokkeerd moet worden"
                  : "Het domein dat geblokkeerd moet worden. Gebruik *.domein.com voor wildcard"}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

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
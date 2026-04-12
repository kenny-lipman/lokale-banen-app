"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BlocklistForm } from "./blocklist-form"

interface BlocklistModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "add" | "edit"
  initialData?: {
    id?: string
    block_type?: "email" | "company" | "domain" | "contact"
    value?: string
    reason: string
    company_id?: string | null
    contact_id?: string | null
    is_active: boolean
  }
  onSubmit: (data: any) => Promise<void>
  loading?: boolean
}

export function BlocklistModal({
  open,
  onOpenChange,
  mode,
  initialData,
  onSubmit,
  loading = false,
}: BlocklistModalProps) {
  const handleSubmit = async (data: any) => {
    await onSubmit(data)
    onOpenChange(false)
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "add" ? "Blocklist Entry Toevoegen" : "Blocklist Entry Bewerken"}
          </DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "Voeg een nieuw e-mailadres of domein toe aan de blocklist."
              : "Bewerk de details van deze blocklist entry."}
          </DialogDescription>
        </DialogHeader>
        <BlocklistForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          loading={loading}
        />
      </DialogContent>
    </Dialog>
  )
}
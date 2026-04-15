"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Image as ImageIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * URL-based image picker field.
 *
 * This component is intentionally minimal: it accepts a URL, previews it,
 * and exposes a simple `onChange(url)` callback. Agent B will drop in the
 * real `<ImageUpload>` component with Supabase Storage signed uploads.
 *
 * The contract (`value: string`, `onChange: (url: string) => void`,
 * `onRemove: () => void`) is stable so the swap is mechanical.
 */
export interface ImagePickerFieldProps {
  label: string
  description?: string
  value: string
  onChange: (url: string) => void
  onRemove?: () => void
  placeholder?: string
  previewClassName?: string
  /** Recommended aspect-ratio note for the user. */
  hint?: string
  inputId?: string
  disabled?: boolean
}

export function ImagePickerField({
  label,
  description,
  value,
  onChange,
  onRemove,
  placeholder = "https://...",
  previewClassName,
  hint,
  inputId,
  disabled,
}: ImagePickerFieldProps) {
  const id = inputId ?? `${label.replace(/\s+/g, "-").toLowerCase()}-url`
  const hasValue = value.trim().length > 0

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {description && (
        <p className="text-xs text-muted-foreground -mt-1">{description}</p>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          type="url"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1"
        />
        {hasValue && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => (onRemove ? onRemove() : onChange(""))}
            title="Verwijderen"
            disabled={disabled}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {hasValue ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border bg-muted/30 p-3",
            previewClassName,
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={`${label} preview`}
            className="h-12 w-12 flex-shrink-0 rounded border bg-white object-contain"
            onError={(e) => {
              ;(e.currentTarget as HTMLImageElement).style.display = "none"
            }}
          />
          <span className="flex-1 truncate text-xs text-muted-foreground">{value}</span>
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground",
            previewClassName,
          )}
        >
          <ImageIcon className="h-4 w-4" />
          <span>Nog geen afbeelding — plak URL hierboven.</span>
        </div>
      )}

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

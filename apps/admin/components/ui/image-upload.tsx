"use client"

/**
 * ImageUpload — reusable drag/drop + preview component
 *
 * Flow:
 *  1. User drops/selects a file
 *  2. Client-side validation (size, MIME)
 *  3. POST /api/storage/signed-upload -> { signedUrl, token, path, publicUrl }
 *  4. PUT direct naar Supabase met de signed URL
 *  5. onUpload(publicUrl) zodat de parent de URL kan persisteren
 */

import * as React from "react"
import Image from "next/image"
import { Loader2, UploadCloud, X, ImageOff } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

export type ImageUploadBucket =
  | "platform-assets"
  | "company-logos"
  | "job-images"

export interface ImageUploadProps {
  bucket: ImageUploadBucket
  /** Relative path inside the bucket, e.g. "{platformId}/logo.png". */
  path: string
  currentUrl?: string | null
  aspectRatio?: "1:1" | "16:9" | "auto"
  /** Default 2MB. */
  maxSizeMB?: number
  /** Defaults to common web image types (no x-icon). */
  acceptedFormats?: string[]
  onUpload: (publicUrl: string) => void
  onRemove?: () => void
  label?: string
  /** Optional help text shown below the dropzone. */
  helperText?: string
  disabled?: boolean
  className?: string
}

const DEFAULT_ACCEPTED: string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]

const ASPECT_CLASS: Record<NonNullable<ImageUploadProps["aspectRatio"]>, string> = {
  "1:1": "aspect-square",
  "16:9": "aspect-video",
  auto: "aspect-[3/1]",
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatAccepted(types: string[]): string {
  return types
    .map((t) => t.replace("image/", "").toUpperCase())
    .join(", ")
}

export function ImageUpload({
  bucket,
  path,
  currentUrl = null,
  aspectRatio = "auto",
  maxSizeMB = 2,
  acceptedFormats = DEFAULT_ACCEPTED,
  onUpload,
  onRemove,
  label,
  helperText,
  disabled = false,
  className,
}: ImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isUploading, setIsUploading] = React.useState(false)
  const [progress, setProgress] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(
    currentUrl ?? null
  )

  React.useEffect(() => {
    setPreviewUrl(currentUrl ?? null)
  }, [currentUrl])

  const maxBytes = maxSizeMB * 1024 * 1024
  const acceptAttr = acceptedFormats.join(",")
  const acceptsLabel = formatAccepted(acceptedFormats)

  const validate = React.useCallback(
    (file: File): string | null => {
      if (!acceptedFormats.includes(file.type)) {
        return `Bestandstype niet toegestaan. Gebruik: ${acceptsLabel}`
      }
      if (file.size > maxBytes) {
        return `Bestand te groot (${formatBytes(
          file.size
        )}). Max: ${maxSizeMB} MB.`
      }
      return null
    },
    [acceptedFormats, acceptsLabel, maxBytes, maxSizeMB]
  )

  const uploadFile = React.useCallback(
    async (file: File) => {
      setError(null)

      const validationError = validate(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setIsUploading(true)
      setProgress(5)

      try {
        // 1. Request a signed upload URL from the admin API
        const tokenRes = await fetch("/api/storage/signed-upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            bucket,
            path,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        })

        if (!tokenRes.ok) {
          const payload = await tokenRes.json().catch(() => ({}))
          throw new Error(
            payload?.error ||
              `Signed upload URL aanvraag mislukt (HTTP ${tokenRes.status})`
          )
        }

        const { signedUrl, publicUrl } = (await tokenRes.json()) as {
          signedUrl: string
          publicUrl: string
        }

        setProgress(25)

        // 2. Upload directly to Supabase with progress tracking via XHR
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open("PUT", signedUrl, true)
          xhr.setRequestHeader("Content-Type", file.type)
          // Supabase signed upload URLs also accept x-upsert for overwrite
          xhr.setRequestHeader("x-upsert", "true")

          xhr.upload.onprogress = (evt) => {
            if (evt.lengthComputable) {
              const pct = Math.round((evt.loaded / evt.total) * 70) + 25
              setProgress(Math.min(pct, 95))
            }
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve()
            } else {
              reject(
                new Error(
                  `Upload mislukt (HTTP ${xhr.status}): ${xhr.responseText || ""}`
                )
              )
            }
          }
          xhr.onerror = () => reject(new Error("Netwerk fout tijdens upload"))
          xhr.send(file)
        })

        setProgress(100)

        // Cache-bust so the preview shows the new image even als de path identiek is
        const bustedUrl = `${publicUrl}?v=${Date.now()}`
        setPreviewUrl(bustedUrl)
        onUpload(publicUrl)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Onbekende upload fout"
        setError(message)
      } finally {
        setIsUploading(false)
        // Reset bar after a beat so users see the 100%
        setTimeout(() => setProgress(0), 600)
      }
    },
    [bucket, onUpload, path, validate]
  )

  const handleFiles = React.useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      const file = files[0]
      void uploadFile(file)
    },
    [uploadFile]
  )

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    if (disabled || isUploading) return
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || isUploading) return
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleRemove = () => {
    setPreviewUrl(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ""
    onRemove?.()
  }

  const openFilePicker = () => {
    if (disabled || isUploading) return
    inputRef.current?.click()
  }

  return (
    <div className={cn("w-full space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openFilePicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openFilePicker()
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/30 text-center transition-colors",
          ASPECT_CLASS[aspectRatio],
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/30 hover:border-primary/60",
          (disabled || isUploading) && "cursor-not-allowed opacity-80"
        )}
      >
        {previewUrl ? (
          <div className="relative h-full w-full">
            {/* Use unoptimized <img> - next.config.mjs sets images.unoptimized=true */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={label || "Upload preview"}
              className="h-full w-full object-contain"
              onError={() => setPreviewUrl(null)}
            />
            {!isUploading && !disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute right-2 top-2 h-7 w-7 opacity-90"
                onClick={(e) => {
                  e.stopPropagation()
                  handleRemove()
                }}
                aria-label="Afbeelding verwijderen"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-muted-foreground">
            {isUploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <UploadCloud className="h-8 w-8" />
            )}
            <div className="text-sm font-medium">
              {isUploading
                ? "Bezig met uploaden..."
                : "Sleep een afbeelding hier of klik om te bladeren"}
            </div>
            <div className="text-xs">
              {acceptsLabel} · max {maxSizeMB} MB
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={acceptAttr}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || isUploading}
          className="sr-only"
        />
      </div>

      {isUploading && progress > 0 && (
        <Progress value={progress} className="h-1.5" />
      )}

      {error && (
        <div className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <ImageOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {helperText && !error && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}
    </div>
  )
}

// Keep a default export as well for consumers that prefer it
export default ImageUpload

// Suppress the unused import warning while keeping the namespace available
// for future optimized image usage.
void Image

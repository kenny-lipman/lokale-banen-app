"use client"

/**
 * HeaderImageField — thin wrapper around ImageUpload with vacature-specific
 * defaults (16:9 aspect, 3MB limit, png/jpeg/webp, job-images bucket).
 *
 * Usage:
 *   <HeaderImageField
 *     vacatureId={id}
 *     currentUrl={headerImageUrl}
 *     onUpload={(url) => setHeaderImageUrl(url)}
 *     onRemove={() => setHeaderImageUrl(null)}
 *   />
 */

import { ImageUpload } from "@/components/ui/image-upload"

export interface HeaderImageFieldProps {
  vacatureId: string
  currentUrl?: string | null
  onUpload: (publicUrl: string) => void
  onRemove?: () => void
  label?: string
  helperText?: string
  className?: string
}

export function HeaderImageField({
  vacatureId,
  currentUrl,
  onUpload,
  onRemove,
  label,
  helperText,
  className,
}: HeaderImageFieldProps) {
  return (
    <ImageUpload
      bucket="job-images"
      path={`${vacatureId}/header.jpg`}
      currentUrl={currentUrl}
      aspectRatio="16:9"
      maxSizeMB={3}
      acceptedFormats={["image/png", "image/jpeg", "image/webp"]}
      label={label ?? "Header afbeelding"}
      helperText={
        helperText ??
        "Toont bovenaan de publieke vacature-pagina. Aanbevolen 1600 × 900 px (16:9)."
      }
      onUpload={onUpload}
      onRemove={onRemove}
      className={className}
    />
  )
}

export default HeaderImageField

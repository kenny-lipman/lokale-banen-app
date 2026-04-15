"use client"

import { MarkdownEditor } from "@/components/platform/markdown-editor"

export interface DescriptionEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
}

/**
 * Thin wrapper rond de platform MarkdownEditor voor vacature-beschrijvingen.
 * - Consistente minimum-hoogte (default 300px)
 * - Standaard placeholder
 * - Toont onder de editor een help-tekst met de meest gebruikte markdown-syntax
 */
export function DescriptionEditor({
  value,
  onChange,
  placeholder = "Beschrijf de vacature...",
  minHeight = 300,
}: DescriptionEditorProps) {
  return (
    <div className="space-y-2">
      <MarkdownEditor
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        height={minHeight}
      />
      <p className="text-xs text-muted-foreground">
        Gebruik markdown: <strong>**vet**</strong>, <em>*cursief*</em>, <code>- lijsten</code>,{" "}
        <code>[link](url)</code>
      </p>
    </div>
  )
}

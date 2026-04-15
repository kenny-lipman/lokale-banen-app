"use client"

import dynamic from "next/dynamic"
import { cn } from "@/lib/utils"

// @uiw/react-md-editor pulls in CodeMirror / DOM; load client-side only.
// Using next/dynamic with ssr:false keeps it out of the SSR bundle.
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[320px] rounded-md border bg-muted/30 p-4 text-sm text-muted-foreground">
        Editor laden...
      </div>
    ),
  },
)

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  height?: number
  className?: string
  /** Hide preview tab entirely (edit-only mode). */
  hidePreview?: boolean
}

export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  height = 360,
  className,
  hidePreview = false,
}: MarkdownEditorProps) {
  return (
    <div className={cn("rounded-md border overflow-hidden", className)} data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(next) => onChange(next ?? "")}
        height={height}
        preview={hidePreview ? "edit" : "live"}
        textareaProps={{ placeholder }}
        visibleDragbar={false}
      />
    </div>
  )
}

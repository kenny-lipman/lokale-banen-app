"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MarkdownEditor } from "@/components/platform/markdown-editor"
import { FileText, Type } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PlatformFormValues } from "../types"

export interface ContentTabProps {
  values: PlatformFormValues
  onChange: (patch: Partial<PlatformFormValues>) => void
}

const HERO_TITLE_MAX = 80
const HERO_SUBTITLE_MAX = 200

export function ContentTab({ values, onChange }: ContentTabProps) {
  const heroTitleLen = values.hero_title.length
  const heroSubtitleLen = values.hero_subtitle.length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Hero
          </CardTitle>
          <CardDescription>
            De hoofdkop en ondertitel die bovenaan de homepage getoond worden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="hero_title">Hero title</Label>
              <span
                className={cn(
                  "text-xs",
                  heroTitleLen > HERO_TITLE_MAX
                    ? "text-red-500"
                    : "text-muted-foreground",
                )}
              >
                {heroTitleLen}/{HERO_TITLE_MAX}
              </span>
            </div>
            <Input
              id="hero_title"
              maxLength={HERO_TITLE_MAX + 20}
              placeholder="Vacatures in Utrecht en omgeving"
              value={values.hero_title}
              onChange={(e) => onChange({ hero_title: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="hero_subtitle">Hero subtitle</Label>
              <span
                className={cn(
                  "text-xs",
                  heroSubtitleLen > HERO_SUBTITLE_MAX
                    ? "text-red-500"
                    : "text-muted-foreground",
                )}
              >
                {heroSubtitleLen}/{HERO_SUBTITLE_MAX}
              </span>
            </div>
            <Textarea
              id="hero_subtitle"
              rows={3}
              maxLength={HERO_SUBTITLE_MAX + 50}
              placeholder="Ontdek de beste lokale banen in jouw regio."
              value={values.hero_subtitle}
              onChange={(e) => onChange({ hero_subtitle: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Over ons
          </CardTitle>
          <CardDescription>
            Markdown toegestaan. Wordt getoond op /over-ons.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>About tekst</Label>
          <MarkdownEditor
            value={values.about_text}
            onChange={(v) => onChange({ about_text: v })}
            placeholder="# Over ons..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Privacy
          </CardTitle>
          <CardDescription>
            Privacybeleid — Markdown toegestaan. Wordt getoond op /privacy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Privacy tekst</Label>
          <MarkdownEditor
            value={values.privacy_text}
            onChange={(v) => onChange({ privacy_text: v })}
            placeholder="# Privacybeleid..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Algemene voorwaarden
          </CardTitle>
          <CardDescription>
            Terms of service — Markdown toegestaan. Wordt getoond op /voorwaarden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Voorwaarden tekst</Label>
          <MarkdownEditor
            value={values.terms_text}
            onChange={(v) => onChange({ terms_text: v })}
            placeholder="# Algemene voorwaarden..."
          />
        </CardContent>
      </Card>
    </div>
  )
}

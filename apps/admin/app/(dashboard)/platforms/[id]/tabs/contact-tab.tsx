"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Facebook,
  ExternalLink,
  Instagram,
  Linkedin,
  Mail,
  Phone,
  Share2,
  Twitter,
} from "lucide-react"
import type { PlatformFormValues } from "../types"

export interface ContactTabProps {
  values: PlatformFormValues
  onChange: (patch: Partial<PlatformFormValues>) => void
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.98a8.18 8.18 0 004.76 1.52V7.06a4.84 4.84 0 01-1-.37z" />
    </svg>
  )
}

interface SocialRowProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  placeholder: string
  onChange: (v: string) => void
}

function SocialRow({ icon: Icon, label, value, placeholder, onChange }: SocialRowProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        {label}
      </Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
          type="url"
        />
        {value && (
          <Button type="button" variant="outline" size="icon" asChild>
            <a href={value} target="_blank" rel="noopener noreferrer" title="Open in nieuwe tab">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

export function ContactTab({ values, onChange }: ContactTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Contact
          </CardTitle>
          <CardDescription>
            Contactgegevens die op de publieke site getoond worden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_email" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                E-mailadres
              </Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="info@platform.nl"
                value={values.contact_email}
                onChange={(e) => onChange({ contact_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Telefoonnummer
              </Label>
              <Input
                id="contact_phone"
                type="tel"
                placeholder="+31 20 123 4567"
                value={values.contact_phone}
                onChange={(e) => onChange({ contact_phone: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Social media
          </CardTitle>
          <CardDescription>
            Links naar sociale kanalen. Laat velden leeg om ze op de site te verbergen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SocialRow
            icon={Linkedin}
            label="LinkedIn"
            value={values.social_linkedin}
            placeholder="https://linkedin.com/company/..."
            onChange={(v) => onChange({ social_linkedin: v })}
          />
          <SocialRow
            icon={Instagram}
            label="Instagram"
            value={values.social_instagram}
            placeholder="https://instagram.com/..."
            onChange={(v) => onChange({ social_instagram: v })}
          />
          <SocialRow
            icon={Facebook}
            label="Facebook"
            value={values.social_facebook}
            placeholder="https://facebook.com/..."
            onChange={(v) => onChange({ social_facebook: v })}
          />
          <SocialRow
            icon={TikTokIcon}
            label="TikTok"
            value={values.social_tiktok}
            placeholder="https://tiktok.com/@..."
            onChange={(v) => onChange({ social_tiktok: v })}
          />
          <SocialRow
            icon={Twitter}
            label="Twitter / X"
            value={values.social_twitter}
            placeholder="https://x.com/..."
            onChange={(v) => onChange({ social_twitter: v })}
          />
        </CardContent>
      </Card>
    </div>
  )
}

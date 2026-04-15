"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Check, Copy, Search } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { PlatformDetail, PlatformFormValues } from "../types"

export interface SeoTabProps {
  platform: PlatformDetail
  values: PlatformFormValues
  onChange: (patch: Partial<PlatformFormValues>) => void
}

const SEO_DESC_MAX = 160

export function SeoTab({ platform, values, onChange }: SeoTabProps) {
  const [copied, setCopied] = useState(false)
  const descLen = values.seo_description.length

  const copyIndexnow = async () => {
    if (!platform.indexnow_key) return
    try {
      await navigator.clipboard.writeText(platform.indexnow_key)
      setCopied(true)
      toast.success("IndexNow key gekopieerd")
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error("Kopiëren mislukt")
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            SEO
          </CardTitle>
          <CardDescription>
            Meta description voor zoekmachines en sociale previews.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="seo_description">SEO description</Label>
              <span
                className={cn(
                  "text-xs",
                  descLen > SEO_DESC_MAX ? "text-red-500" : "text-muted-foreground",
                )}
              >
                {descLen}/{SEO_DESC_MAX}
              </span>
            </div>
            <Textarea
              id="seo_description"
              rows={3}
              maxLength={SEO_DESC_MAX + 20}
              placeholder="Vind de beste lokale banen bij jou in de buurt. Dagelijks nieuwe vacatures."
              value={values.seo_description}
              onChange={(e) => onChange({ seo_description: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Google toont ~155–160 tekens. Boven dit getal wordt afgekapt.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>IndexNow</CardTitle>
          <CardDescription>
            Unieke sleutel voor het IndexNow-protocol (Bing/Yandex/Yep crawlers).
            Deze wordt automatisch gegenereerd en kan niet aangepast worden.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>IndexNow key</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={platform.indexnow_key ?? "— nog niet gegenereerd —"}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyIndexnow}
                disabled={!platform.indexnow_key}
                title="Kopieer naar klembord"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            {platform.indexnow_key && platform.domain && (
              <p className="text-xs text-muted-foreground">
                Verwachte locatie:{" "}
                <span className="font-mono">
                  https://{platform.domain}/{platform.indexnow_key}.txt
                </span>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

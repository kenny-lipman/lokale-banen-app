'use client'

import { useState } from 'react'
import { MessageCircle, Linkedin, Link2, Check } from 'lucide-react'

interface ShareButtonsProps {
  url: string
  title: string
  /** Inline (klein, default) of "card" voor sidebar context (groter). */
  variant?: 'inline' | 'card'
}

/**
 * Share-buttons - WhatsApp, LinkedIn, en kopieer-link. Eyeron-styled met
 * primary-tint hover en secondary check-feedback bij gekopieerd.
 */
export function ShareButtons({ url, title, variant = 'inline' }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`
  // shareArticle is robuuster dan share-offsite: title-param zorgt voor
  // gevulde dialog ook als LinkedIn de OG-tags nog niet heeft gecrawld.
  const linkedinUrl = `https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const input = document.createElement('input')
      input.value = url
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const isCard = variant === 'card'

  return (
    <div className="flex items-center gap-2">
      <span className="text-meta font-light text-muted">Delen:</span>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center min-w-11 min-h-11 ${
          isCard ? 'rounded-button border border-primary text-primary' : 'text-primary'
        } hover:bg-primary-tint transition-colors`}
        aria-label="Deel via WhatsApp"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </a>
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center justify-center min-w-11 min-h-11 ${
          isCard ? 'rounded-button border border-primary text-primary' : 'text-primary'
        } hover:bg-primary-tint transition-colors`}
        aria-label="Deel via LinkedIn"
      >
        <Linkedin className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
      </a>
      <button
        type="button"
        onClick={copyLink}
        className={`inline-flex items-center justify-center min-w-11 min-h-11 ${
          isCard ? 'rounded-button border border-primary' : ''
        } ${copied ? 'text-secondary' : 'text-primary'} hover:bg-primary-tint transition-colors`}
        aria-label={copied ? 'Link gekopieerd' : 'Kopieer link'}
      >
        {copied ? (
          <Check className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <Link2 className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

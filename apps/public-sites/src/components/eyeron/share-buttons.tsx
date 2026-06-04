'use client'

import { useState } from 'react'
import { MessageCircle, Link2, Check } from 'lucide-react'

interface ShareButtonsProps {
  url: string
  title: string
  /** Inline (klein, default) of "card" voor sidebar context (groter). */
  variant?: 'inline' | 'card'
}

/**
 * Share-buttons - WhatsApp en kopieer-link. Eyeron-styled met primary-tint
 * hover en secondary check-feedback bij gekopieerd.
 */
export function ShareButtons({ url, title, variant = 'inline' }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`

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
        <MessageCircle className="size-5" strokeWidth={1.75} aria-hidden="true" />
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
          <Check className="size-5" strokeWidth={2.25} aria-hidden="true" />
        ) : (
          <Link2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

'use client'

import { MessageCircle, Linkedin, Link2, Check } from 'lucide-react'
import { useState } from 'react'

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(title + ' ' + url)}`
  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for browsers without clipboard API support
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

  return (
    <div className="flex items-center gap-2">
      <span className="text-meta text-muted">Delen:</span>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg hover:bg-card-hover text-muted hover:text-foreground transition-colors"
        aria-label="Deel via WhatsApp"
      >
        <MessageCircle className="h-4 w-4" />
      </a>
      <a
        href={linkedinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-2 rounded-lg hover:bg-card-hover text-muted hover:text-foreground transition-colors"
        aria-label="Deel via LinkedIn"
      >
        <Linkedin className="h-4 w-4" />
      </a>
      <button
        onClick={copyLink}
        className="p-2 rounded-lg hover:bg-card-hover text-muted hover:text-foreground transition-colors"
        aria-label="Kopieer link"
      >
        {copied ? (
          <Check className="h-4 w-4 text-salary" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
      </button>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'cookie-consent-accepted'

/**
 * Compact cookie consent banner.
 * Fixed to bottom, z-50 (above sticky apply button).
 * Only functional cookies — no tracking.
 */
export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY)
      if (!accepted) {
        setVisible(true)
      }
    } catch {
      // localStorage unavailable (SSR, private mode)
    }
  }, [])

  function handleAccept() {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[60] bg-surface px-4 py-3 sm:px-6"
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <p className="text-meta text-muted">
          Deze site gebruikt functionele cookies. Geen tracking.{' '}
          <Link
            href="/privacy"
            className="underline transition-colors hover:text-foreground"
          >
            Meer info
          </Link>
        </p>
        <button
          onClick={handleAccept}
          className="shrink-0 inline-flex items-center justify-center h-8 px-4 rounded-md text-meta font-medium text-primary-foreground transition-colors cursor-pointer"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Accepteren
        </button>
      </div>
    </div>
  )
}

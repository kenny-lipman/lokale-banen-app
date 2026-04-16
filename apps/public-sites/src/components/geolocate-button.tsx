"use client"

import { useState, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Geolocate button — captures browser geolocation and adds ?lat=X&lng=Y to the URL.
 * Shown in the FilterBar; disappears when geolocation is active (already in URL).
 */
export function GeolocateButton() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasLocation = searchParams.has('lat') && searchParams.has('lng')

  const handleClick = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geen locatietoegang in deze browser.')
      return
    }
    setLoading(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('lat', pos.coords.latitude.toFixed(5))
        params.set('lng', pos.coords.longitude.toFixed(5))
        router.push(`/?${params.toString()}`)
        setLoading(false)
      },
      () => {
        setError('Locatie geweigerd.')
        setLoading(false)
      },
      { timeout: 8000 }
    )
  }, [router, searchParams])

  const handleClear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('lat')
    params.delete('lng')
    router.push(`/?${params.toString()}`)
  }, [router, searchParams])

  if (hasLocation) {
    return (
      <button
        type="button"
        onClick={handleClear}
        title="Verwijder locatiefilter"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-button transition-colors"
        style={{
          background: 'var(--primary-tint)',
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          fontSize: '0.8125rem',
          fontWeight: 500,
        }}
      >
        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Bij mij in de buurt</span>
        <span className="sm:hidden">Buurt</span>
        <span aria-label="verwijder locatiefilter">×</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        title="Toon vacatures bij mij in de buurt"
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-button transition-colors disabled:opacity-60"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          fontSize: '0.8125rem',
          fontWeight: 500,
        }}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{loading ? 'Locatie ophalen...' : 'Bij mij in de buurt'}</span>
        <span className="sm:hidden">{loading ? '...' : 'Buurt'}</span>
      </button>
      {error && (
        <p className="text-xs mt-1" style={{ color: 'var(--danger, #A3281D)' }}>
          {error}
        </p>
      )}
    </div>
  )
}

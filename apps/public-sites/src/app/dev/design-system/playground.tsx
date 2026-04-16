'use client'

import { useState } from 'react'
import { MOCK_TENANTS } from './tenants'
import { MOCK_JOBS } from './mock-jobs'
import { ContextStrip } from '@/components/context-strip'
import { EditorialJobCard } from '@/components/editorial-job-card'
import { EditorialFilterChips } from '@/components/editorial-filter-chips'
import { Wegwijzer } from '@/components/wegwijzer'
import { RuleBreak } from '@/components/rule-break'
import { DistanceChip } from '@/components/distance-chip'
import { CityHero } from '@/components/city-hero'
import { SectorTile } from '@/components/sector-tile'
import { NeighbourhoodCard } from '@/components/neighbourhood-card'
import { EmployerChip } from '@/components/employer-chip'

/**
 * Visual QA playground — switch tenant theme via top-of-page <select>,
 * see every editorial component render through realistic data.
 *
 * Theme is applied by writing CSS variables to `:root` so all components
 * pick them up exactly as in production.
 */
export function DesignSystemPlayground() {
  const [tenantIdx, setTenantIdx] = useState(0)
  const tenant = MOCK_TENANTS[tenantIdx]

  // Inject tenant theme as CSS variables on root
  const themeStyle: React.CSSProperties & Record<string, string> = {
    '--primary': tenant.primary,
    '--primary-ink': '#FFFFFF',
    '--primary-hover': darken(tenant.primary, 10),
    '--primary-tint': mix(tenant.primary, '#FFFFFF', 0.92),
    '--primary-muted': mix(tenant.primary, '#FFFFFF', 0.85),
    '--primary-dark': darken(tenant.primary, 25),
    '--primary-light': mix(tenant.primary, '#FFFFFF', 0.92),
    '--secondary': tenant.secondary || tenant.primary,
    '--secondary-ink': '#FFFFFF',
    '--secondary-tint': mix(tenant.secondary || tenant.primary, '#FFFFFF', 0.92),
    '--secondary-dark': darken(tenant.secondary || tenant.primary, 25),
    '--tertiary': tenant.tertiary || '#F6F1E3',
    '--bg': '#FAF8F4',
    '--surface': '#FFFFFF',
    '--text': '#1A1815',
    '--text-2': '#3E3A34',
    '--text-muted': '#78716A',
    '--text-faint': '#A8A29B',
    '--border': '#E8E3DA',
    '--border-strong': '#D4CCBF',
    '--success': '#2D7D46',
    '--max': '1440px',
    '--pad': 'clamp(16px, 2.4vw, 32px)',
    '--r-md': '10px',
    '--r-lg': '14px',
  }

  return (
    <div style={themeStyle}>
      <div
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: '0.7rem',
            background: 'var(--text)',
            color: 'var(--bg)',
            padding: '3px 8px',
            borderRadius: 4,
            letterSpacing: '0.05em',
          }}
        >
          DESIGN SYSTEM · DEV
        </span>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.875rem',
          }}
        >
          Tenant:
          <select
            value={tenantIdx}
            onChange={(e) => setTenantIdx(Number(e.target.value))}
            style={{
              padding: '4px 24px 4px 8px',
              borderRadius: 4,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            {MOCK_TENANTS.map((t, i) => (
              <option key={t.id} value={i}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Primary <span style={{ display: 'inline-block', width: 10, height: 10, background: tenant.primary, borderRadius: 2, verticalAlign: 'middle' }} />{' '}
          {tenant.primary}{' '}
          {tenant.secondary && (
            <>
              · Secondary <span style={{ display: 'inline-block', width: 10, height: 10, background: tenant.secondary, borderRadius: 2, verticalAlign: 'middle' }} /> {tenant.secondary}
            </>
          )}
        </span>
      </div>

      <main style={{ background: 'var(--bg)', minHeight: '100vh', paddingBottom: 80 }}>
        <Section title="ContextStrip">
          <ContextStrip
            region={tenant.centralPlace}
            emphasis={tenant.centralPlace}
            jobCount={247}
            updatedLabel="Bijgewerkt 3 min geleden"
            subLabel="12 nieuw vandaag"
          />
        </Section>

        <Section title="Wegwijzer (detail breadcrumb)">
          <div style={{ background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <Wegwijzer
              back={{ label: 'Overzicht', href: '/' }}
              items={[
                { id: 'city', label: tenant.centralPlace, icon: 'map' },
                { id: 'distance', label: '0.8 km van jou', mono: true },
                { id: 'time', label: 'Geplaatst 2 uur geleden', icon: 'clock' },
              ]}
            />
          </div>
        </Section>

        <Section title="EditorialFilterChips">
          <EditorialFilterChips
            items={[
              { id: 'r15', label: 'Binnen 15 km', isActive: true, dismissHref: '/dev/design-system' },
              { id: 'new', label: 'Nieuw deze week', count: 47, isActive: true, dismissHref: '/dev/design-system' },
              { id: 'fulltime', label: 'Fulltime' },
              { id: 'mbo', label: 'MBO' },
              { id: 'salary', label: 'Salaris vanaf €2.500' },
              { id: 'remote', label: 'Thuiswerk mogelijk' },
            ]}
            onAddFilterHref="/dev/design-system?addfilter=1"
          />
        </Section>

        <Section title="DistanceChip (3 sizes)">
          <div style={{ display: 'flex', gap: 12, padding: '0 var(--pad)' }}>
            <DistanceChip km={0.8} />
            <DistanceChip km={3.2} />
            <DistanceChip km={14.6} />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>↑ km=null returns null:</span>
            <DistanceChip km={null} />
          </div>
        </Section>

        <Section title="EditorialJobCard (list variant)">
          <div
            style={{
              padding: '0 var(--pad)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              maxWidth: 480,
            }}
          >
            {MOCK_JOBS.slice(0, 3).map((job, i) => (
              <EditorialJobCard
                key={job.id}
                job={job}
                variant="list"
                distanceKm={[0.8, 2.3, 14][i]}
                isActive={i === 0}
                isSaved={i === 0}
              />
            ))}
          </div>
        </Section>

        <RuleBreak label="◇ City landing components" />

        <Section title="CityHero">
          <CityHero
            eyebrow="Vacatures in"
            name={tenant.centralPlace}
            accent={tenant.centralPlace}
            description="Het kloppend hart van de regio. 65.000 inwoners. De arbeidsmarkt groeit — 12% meer vacatures dan een jaar geleden."
            stats={[
              { value: '247', label: 'Open vacatures' },
              { value: '156', label: 'Werkgevers' },
              { value: '€ 3.4k', label: 'Gem. salaris p/m' },
            ]}
          />
        </Section>

        <Section title="SectorTile grid">
          <div
            style={{
              padding: '0 var(--pad)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 8,
            }}
          >
            <SectorTile name="Zorg & Welzijn" description="IC, SEH, thuiszorg, GGZ" count={58} href="#" />
            <SectorTile name="Techniek" description="Elektro, mechatronica" count={41} href="#" />
            <SectorTile name="Logistiek" description="Magazijn, chauffeur, planner" count={34} href="#" />
            <SectorTile name="Onderwijs" description="Basis, VO, MBO, kinderopvang" count={22} href="#" />
          </div>
        </Section>

        <Section title="NeighbourhoodCard horizontal scroll">
          <div
            style={{
              padding: '0 var(--pad)',
              display: 'flex',
              gap: 10,
              overflowX: 'auto',
            }}
          >
            <NeighbourhoodCard postcode="7001" name="Centrum-Zuid" count={47} href="#" />
            <NeighbourhoodCard postcode="7002" name="Schöneveld" count={28} href="#" />
            <NeighbourhoodCard postcode="7004" name="De Huet" count={19} href="#" />
            <NeighbourhoodCard postcode="7007" name="IJsselzicht" count={33} href="#" />
            <NeighbourhoodCard postcode="7009" name="Lookwartier" count={41} href="#" />
          </div>
        </Section>

        <Section title="EmployerChip grid">
          <div
            style={{
              padding: '0 var(--pad)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: 10,
            }}
          >
            <EmployerChip name="Slingeland Ziekenhuis" count={12} href="#" />
            <EmployerChip name="Nedap" count={8} href="#" />
            <EmployerChip name="ROC Graafschap" count={7} href="#" />
            <EmployerChip name="Zozijn" count={6} href="#" />
            <EmployerChip name="Bol.com Zutphen" count={5} href="#" />
          </div>
        </Section>
      </main>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          padding: '24px var(--pad) 8px',
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

// ---- Color helpers (no external deps) ---------------------------------

function clamp(n: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, n))
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const v = h.length === 3
    ? h.split('').map((c) => parseInt(c + c, 16))
    : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
  return [v[0] || 0, v[1] || 0, v[2] || 0]
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function darken(hex: string, percent: number): string {
  const [r, g, b] = hexToRgb(hex)
  const f = 1 - percent / 100
  return rgbToHex(r * f, g * f, b * f)
}

function mix(a: string, b: string, weight: number): string {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return rgbToHex(
    r1 * (1 - weight) + r2 * weight,
    g1 * (1 - weight) + g2 * weight,
    b1 * (1 - weight) + b2 * weight
  )
}

'use client'

import { useState } from 'react'
import {
  Wordmark,
  ArrowRight,
  PillButton,
  Radio,
  Checkbox,
  PortalLogo,
  MasterLogo,
} from '@/components/eyeron'
import { resolveTheme } from '@/lib/theme'

/**
 * Vier brand-varianten — Achterhoek/Alkmaar/Assen/Bollenstreek — uit de
 * Eyeron PSDs. Elke variant rendert dezelfde primitives onder verschillende
 * `--primary`/`--secondary` CSS vars, zodat we visueel kunnen valideren of
 * de tokens correct doorpropageren.
 */
const VARIANTS = [
  { id: 'achterhoek',   name: 'AchterhoekseBanen',   primary: '#0A6333', secondary: '#7BC142' },
  { id: 'alkmaar',      name: 'AlkmaarseBanen',      primary: '#222222', secondary: '#D72421' },
  { id: 'assen',        name: 'AssenseBanen',        primary: '#1F3D75', secondary: '#1D9ED9' },
  { id: 'bollenstreek', name: 'BollenstreekseBanen', primary: '#22366D', secondary: '#CA2F54' },
] as const

function VariantBlock({ variant }: { variant: typeof VARIANTS[number] }) {
  const t = resolveTheme({ primary: variant.primary, secondary: variant.secondary })
  const cssVars = {
    '--primary': t.primary,
    '--primary-hover': t.primaryHover,
    '--primary-active': t.primaryActive,
    '--primary-tint-08': t.primaryTint08,
    '--primary-tint-16': t.primaryTint16,
    '--primary-ink': t.primaryInk,
    '--secondary': t.secondary,
    '--secondary-hover': t.secondaryHover,
    '--secondary-active': t.secondaryActive,
    '--secondary-ink': t.secondaryInk,
  } as React.CSSProperties

  return (
    <section
      style={cssVars}
      className="bg-surface p-8 border border-divider-subtle"
    >
      <header className="flex items-baseline gap-4 mb-6 pb-4 border-b border-divider-subtle">
        <h3 className="text-h2 font-bold text-primary">{variant.name}</h3>
        <span className="text-meta text-body font-light">
          {variant.primary} · {variant.secondary}
        </span>
      </header>

      <div className="grid gap-8">
        {/* Wordmark */}
        <Row label="Wordmark">
          <Wordmark name={variant.name} className="text-2xl" />
        </Row>

        {/* PortalLogo */}
        <Row label="PortalLogo (SVG)">
          <PortalLogo tenantName={variant.name} height={43} />
        </Row>

        {/* PillButton */}
        <Row label="PillButton">
          <div className="flex flex-wrap gap-3 items-center">
            <PillButton>
              Toon nieuwste eerst
              <ArrowDown />
            </PillButton>
            <PillButton variant="primary">
              Toon 35 vacatures
              <ArrowRight />
            </PillButton>
            <PillButton disabled>
              Disabled state
            </PillButton>
          </div>
        </Row>

        {/* ArrowRight + sizes */}
        <Row label="ArrowRight (custom filled)">
          <div className="flex items-center gap-4 text-secondary">
            <ArrowRight width={13} height={13} />
            <ArrowRight width={19} height={13} />
            <ArrowRight width={24} height={24} />
          </div>
        </Row>

        {/* Radio */}
        <Row label="Radio (Afstand)">
          <RadioGroupDemo name={`afstand-${variant.id}`} />
        </Row>

        {/* Checkbox */}
        <Row label="Checkbox (Vakgebied)">
          <CheckboxGroupDemo prefix={variant.id} />
        </Row>
      </div>
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-6 items-start">
      <span className="text-small uppercase tracking-wider font-bold text-body">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function RadioGroupDemo({ name }: { name: string }) {
  const [value, setValue] = useState('all')
  return (
    <div className="grid gap-1">
      {[
        ['5km',  'Binnen 5 km'],
        ['15km', 'Binnen 15 km'],
        ['25km', 'Binnen 25 km'],
        ['all',  'Heel de regio'],
      ].map(([v, label]) => (
        <Radio
          key={v}
          name={name}
          value={v}
          checked={value === v}
          onChange={(e) => setValue(e.target.value)}
        >
          {label}
        </Radio>
      ))}
    </div>
  )
}

function CheckboxGroupDemo({ prefix }: { prefix: string }) {
  const [active, setActive] = useState<Set<string>>(new Set(['techniek', 'logistiek']))
  const toggle = (v: string) => {
    setActive((prev) => {
      const next = new Set(prev)
      if (next.has(v)) next.delete(v); else next.add(v)
      return next
    })
  }
  return (
    <div className="grid gap-1">
      {[
        ['productie', 'Productie/Uitvoerend'],
        ['techniek',  'Techniek'],
        ['logistiek', 'Inkoop/Logistiek/Transport'],
        ['horeca',    'Horeca/Detailhandel'],
        ['zorg',      'Medisch/Zorg'],
      ].map(([v, label]) => (
        <Checkbox
          key={v}
          name={`vakgebied-${prefix}`}
          value={v}
          checked={active.has(v)}
          onChange={() => toggle(v)}
        >
          {label}
        </Checkbox>
      ))}
    </div>
  )
}

function ArrowDown() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="text-secondary"
      aria-hidden="true"
    >
      <path d="M18.7071 8.29289C19.0976 8.68342 19.0976 9.31658 18.7071 9.70711L12.7071 15.7071C12.3166 16.0976 11.6834 16.0976 11.2929 15.7071L5.29289 9.70711C4.90237 9.31658 4.90237 8.68342 5.29289 8.29289C5.68342 7.90237 6.31658 7.90237 6.70711 8.29289L12 13.5858L17.2929 8.29289C17.6834 7.90237 18.3166 7.90237 18.7071 8.29289Z" />
    </svg>
  )
}

export function EyeronShowcase() {
  return (
    <main className="min-h-screen bg-page py-12">
      <div className="max-w-content mx-auto px-pad">
        <header className="mb-12">
          <h1 className="text-h1 font-bold text-primary mb-2">Eyeron primitives</h1>
          <p className="text-body text-body font-light max-w-prose">
            Atomic componenten van het Eyeron design-system, gerendered onder
            de 4 originele brand-paletten uit de PSDs. Iedere sectie injecteert
            zijn eigen <code className="text-meta">--primary</code>/<code className="text-meta">--secondary</code>{' '}
            via inline CSS vars.
          </p>
        </header>

        <section className="mb-12 bg-surface p-8 border border-divider-subtle">
          <h2 className="text-h2 font-bold text-primary mb-4">MasterLogo (LokaleBanen)</h2>
          <p className="text-meta text-body font-light mb-4">
            Het master-logo behoudt eigen kleuren — geen tenant-theming. Gebruikt voor de
            footer-attribution en lokalebanen.nl zelf.
          </p>
          <div className="bg-primary p-6 inline-flex">
            <MasterLogo height={42} />
          </div>
        </section>

        <div className="grid gap-8">
          {VARIANTS.map((v) => (
            <VariantBlock key={v.id} variant={v} />
          ))}
        </div>
      </div>
    </main>
  )
}

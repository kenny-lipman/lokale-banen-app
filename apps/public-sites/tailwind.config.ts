import type { Config } from 'tailwindcss'

/**
 * Tailwind theme for the public-sites app.
 *
 * All colors reference CSS custom properties so per-tenant theming happens
 * purely at runtime via `buildTenantThemeCss()` in `src/lib/theme.ts`.
 *
 * Typography scale mirrors the editorial-regional design prototype in
 * `.branding-staging/design-prototype/styles.css` (t-mega/display/h1/h2/card/
 * body/meta/label/mono).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Primary body font — Source Sans 3 via next/font
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        // Editorial display serif — Newsreader via next/font, variable opsz.
        display: ['var(--font-display)', 'Iowan Old Style', 'Charter', 'Georgia', 'serif'],
        // Monospace for numeric data (salary, distance, counts).
        mono: ['var(--font-mono)', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // ── Editorial typography scale (prototype-authoritative) ────────
        // t-mega: city-hero headline
        't-mega': ['clamp(3rem, 7.5vw, 6rem)', { lineHeight: '0.95', letterSpacing: '-0.025em', fontWeight: '500' }],
        // t-display: section hero headline
        't-display': ['clamp(1.75rem, 3.2vw, 2.5rem)', { lineHeight: '1.08', letterSpacing: '-0.018em', fontWeight: '500' }],
        // t-h1: primary page headline
        't-h1': ['2.8rem', { lineHeight: '1.1', letterSpacing: '-0.015em', fontWeight: '700' }],
        // t-h2: sub-section head
        't-h2': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.008em', fontWeight: '700' }],
        // t-card: card title
        't-card': ['1rem', { lineHeight: '1.3', fontWeight: '700' }],
        // t-body: prose paragraphs
        't-body': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        // t-meta: tertiary info
        't-meta': ['0.875rem', { lineHeight: '1.45', fontWeight: '400' }],
        // t-label: section eyebrows
        't-label': ['0.75rem', { lineHeight: '1.3', fontWeight: '400', letterSpacing: '0.09em' }],
        // t-mono: numeric data
        't-mono': ['0.75rem', { lineHeight: '1.4', fontWeight: '400', letterSpacing: '0' }],

        // ── Back-compat aliases (used by existing components) ──────────
        'display': ['clamp(1.75rem, 3.2vw, 2.5rem)', { lineHeight: '1.08', letterSpacing: '-0.018em', fontWeight: '500' }],
        'h1': ['2.8rem', { lineHeight: '1.1', letterSpacing: '-0.015em', fontWeight: '700' }],
        'h2': ['1.5rem', { lineHeight: '1.25', letterSpacing: '-0.008em', fontWeight: '700' }],
        'card-title': ['1rem', { lineHeight: '1.3', fontWeight: '700' }],
        'body': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-medium': ['0.9375rem', { lineHeight: '1.55', fontWeight: '500' }],
        'meta': ['0.8125rem', { lineHeight: '1.4', fontWeight: '400', letterSpacing: '0.01em' }],
        'salary': ['0.9375rem', { lineHeight: '1.4', fontWeight: '500' }],
        'caption': ['0.75rem', { lineHeight: '1.4', fontWeight: '400', letterSpacing: '0.02em' }],
        'button': ['0.9375rem', { lineHeight: '1.4', fontWeight: '600', letterSpacing: '0.01em' }],
      },
      colors: {
        // Paper canvas
        background: 'var(--bg)',
        'bg-tint': 'var(--bg-tint)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',

        // Ink
        foreground: 'var(--text)',
        'text-2': 'var(--text-2)',
        muted: 'var(--text-muted)',
        'muted-foreground': 'var(--text-faint)',

        // Lines
        border: 'var(--border)',
        'border-strong': 'var(--border-strong)',
        'border-ink': 'var(--border-ink)',
        'border-subtle': 'var(--border-subtle)',

        // Brand — primary
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-ink)',
          ink: 'var(--primary-ink)',
          hover: 'var(--primary-hover)',
          light: 'var(--primary-tint)',
          tint: 'var(--primary-tint)',
          muted: 'var(--primary-muted)',
          dark: 'var(--primary-dark)',
        },
        // Brand — secondary (editorial accent)
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-ink)',
          ink: 'var(--secondary-ink)',
          tint: 'var(--secondary-tint)',
          dark: 'var(--secondary-dark)',
        },
        // Brand — tertiary (warm cream)
        tertiary: {
          DEFAULT: 'var(--tertiary)',
        },

        // Semantic tokens
        salary: 'var(--text)',
        'card-hover': 'var(--surface-2)',
        'card-selected': 'var(--primary-tint)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        'sm': 'var(--r-sm)',
        'md': 'var(--r-md)',
        'lg': 'var(--r-lg)',
        'xl': 'var(--r-xl)',
      },
      maxWidth: {
        'content': '640px',
        'max': 'var(--max)',
      },
      spacing: {
        'pad': 'var(--pad)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config

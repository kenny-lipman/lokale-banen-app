import type { Config } from 'tailwindcss'

/**
 * Tailwind theme - Eyeron design system.
 *
 * Alle kleuren mappen op CSS custom properties zodat per-tenant theming
 * zuiver via runtime CSS-vars gebeurt (zie `lib/theme.ts` →
 * `buildTenantThemeCss()`).
 *
 * Type-schaal en spacing volgen de Eyeron brand-spec
 * (`.branding-staging/eyeron-mockups/tokens.css`).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Tomica', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        // Eyeron type-scale (gekoppeld aan CSS vars voor flexibele clamp)
        'h1':    ['var(--fs-h1)',  { lineHeight: '1.15', letterSpacing: '-0.025em' }],
        'h2':    ['var(--fs-h2)',  { lineHeight: '1.4',  letterSpacing: '-0.012em' }],
        'h3':    ['var(--fs-h3)',  { lineHeight: '1.4' }],
        'lead':  ['var(--fs-lead)',{ lineHeight: '1.55' }],
        'body':  ['1rem',          { lineHeight: '1.6' }],
        'meta':  ['0.875rem',      { lineHeight: '1.5' }],
        'small': ['0.75rem',       { lineHeight: '1.4' }],
        'input': ['1.125rem',      { lineHeight: '1.4' }],
      },
      // NB: GEEN lineHeight extend hier - Tailwind defaults (tight=1.25, snug=1.375,
      // relaxed=1.625) blijven gelden zodat bestaande utilities niet onbedoeld
      // van waarde veranderen. De Eyeron --lh-* CSS-vars zijn beschikbaar via
      // arbitrary value: `leading-[var(--lh-tight)]` waar nodig.
      colors: {
        // ── Brand: per-tenant ─────────────────────────────────────────
        primary: {
          DEFAULT:      'var(--primary)',
          hover:        'var(--primary-hover)',
          active:       'var(--primary-active)',
          ink:          'var(--primary-ink)',
          foreground:   'var(--primary-ink)',
          tint:         'var(--primary-tint-08)',
          'tint-strong':'var(--primary-tint-16)',
        },
        secondary: {
          DEFAULT:      'var(--secondary)',
          hover:        'var(--secondary-hover)',
          active:       'var(--secondary-active)',
          ink:          'var(--secondary-ink)',
          foreground:   'var(--secondary-ink)',
        },

        // ── Neutralen (statisch) ──────────────────────────────────────
        page:         'var(--bg-page)',
        surface:      'var(--bg-surface)',
        muted:        'var(--text-body)',
        placeholder:  'var(--text-placeholder)',
        'on-dark':    'var(--text-on-dark)',
        divider:      'var(--border-medium)',
        'divider-subtle': 'var(--border-subtle)',
      },
      borderRadius: {
        'card':   '0',
        'input':  '1.5rem',     /* 24px */
        'button': '1.25rem',    /* 20px */
        'pill':   '0.9375rem',  /* 15px */
      },
      boxShadow: {
        'card':       'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      maxWidth: {
        'content': 'var(--max-content-width)',
        'main':    'var(--content-main-width)',
        'sidebar': 'var(--content-sidebar-width)',
      },
      spacing: {
        'pad':          'var(--container-pad)',
        'header-desk':  'var(--header-height-desk)',
        'header-mob':   'var(--header-height-mob)',
        'gap-content':  'var(--content-gap)',
        // Eyeron spacing-schaal
        's1':           'var(--space-1)',  /*  8px */
        's2':           'var(--space-2)',  /* 12px */
        's3':           'var(--space-3)',  /* 18px */
        's4':           'var(--space-4)',  /* 30px */
        's5':           'var(--space-5)',  /* 44px */
        's6':           'var(--space-6)',  /* 60px */
      },
      transitionTimingFunction: {
        'eyeron': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config

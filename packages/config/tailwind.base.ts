import type { Config } from 'tailwindcss'

/**
 * Shared Tailwind preset for Lokale Banen apps.
 * Design tokens from DESIGN.md section 8.
 */
const baseConfig: Partial<Config> = {
  theme: {
    extend: {
      fontSize: {
        display: [
          'clamp(28px, 1.5rem + 1vw, 36px)',
          { lineHeight: '1.15', letterSpacing: '-0.02em' },
        ],
        h1: [
          'clamp(24px, 1.3rem + 0.8vw, 32px)',
          { lineHeight: '1.2', letterSpacing: '-0.02em' },
        ],
        h2: [
          'clamp(18px, 1.05rem + 0.4vw, 20px)',
          { lineHeight: '1.35' },
        ],
        h3: [
          'clamp(16px, 0.95rem + 0.3vw, 17px)',
          { lineHeight: '1.4' },
        ],
        body: [
          'clamp(15px, 0.9rem + 0.2vw, 16px)',
          { lineHeight: '1.55' },
        ],
        meta: ['13px', { lineHeight: '1.5' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        full: '9999px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        md: '0 2px 6px -1px rgb(0 0 0 / 0.08), 0 1px 4px -1px rgb(0 0 0 / 0.04)',
        lg: '0 8px 24px -4px rgb(0 0 0 / 0.12)',
      },
      colors: {
        salary: 'hsl(160 84% 39%)',
        new: 'hsl(38 92% 50%)',
      },
    },
  },
}

export default baseConfig

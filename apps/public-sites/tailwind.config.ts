import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-source-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display': ['24px', { lineHeight: '32px', fontWeight: '600', letterSpacing: '-0.02em' }],
        'h1': ['20px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.01em' }],
        'h2': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'card-title': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-medium': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'meta': ['13px', { lineHeight: '18px', fontWeight: '400', letterSpacing: '0.01em' }],
        'salary': ['13px', { lineHeight: '18px', fontWeight: '600' }],
        'caption': ['12px', { lineHeight: '16px', fontWeight: '400', letterSpacing: '0.02em' }],
        'button': ['14px', { lineHeight: '20px', fontWeight: '600', letterSpacing: '0.01em' }],
      },
      colors: {
        background: 'var(--background)',
        surface: 'var(--surface)',
        foreground: 'var(--foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        border: 'var(--border)',
        'border-subtle': 'var(--border-subtle)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
          hover: 'var(--primary-hover)',
          light: 'var(--primary-light)',
          muted: 'var(--primary-muted)',
        },
        salary: 'var(--salary)',
        'card-hover': 'var(--card-hover)',
        'card-selected': 'var(--card-selected)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
      },
      maxWidth: {
        'content': '640px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config

import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: {
        '2xl': '1280px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        surface: 'hsl(var(--surface))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        salary: 'hsl(var(--salary))',
        new: 'hsl(var(--new))',
      },
      fontSize: {
        /* Display: hero/page titles */
        'display': ['28px', { lineHeight: '32px', letterSpacing: '-0.03em', fontWeight: '700' }],
        /* H1: job title in detail */
        'h1': ['22px', { lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: '700' }],
        /* H2: section headings */
        'h2': ['17px', { lineHeight: '24px', fontWeight: '600' }],
        /* H3: sub-section */
        'h3': ['15px', { lineHeight: '20px', fontWeight: '600' }],
        /* Body: main text — compact like Indeed */
        'body': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        /* Meta: timestamps, secondary info */
        'meta': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        /* Salary display */
        'salary': ['14px', { lineHeight: '20px', fontWeight: '600' }],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        full: '9999px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        'md': '0 2px 6px -1px rgb(0 0 0 / 0.08), 0 1px 4px -1px rgb(0 0 0 / 0.04)',
        'lg': '0 8px 24px -4px rgb(0 0 0 / 0.12)',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config

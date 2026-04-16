import { notFound } from 'next/navigation'
import { DesignSystemPlayground } from './playground'

/**
 * Dev-only design-system playground.
 *
 * Lists every editorial component with realistic mock data, and swaps
 * tenant themes (primary/secondary/tertiary colors + logo) via a top-of-page
 * <select>. Acts as a Storybook-light for Phase 1 visual QA.
 *
 * Only accessible in development (NODE_ENV !== 'production'). In production
 * the route returns 404.
 */
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return <DesignSystemPlayground />
}

export const metadata = {
  title: 'Design System · dev only',
  robots: { index: false, follow: false },
}

import { notFound } from 'next/navigation'
import { EyeronShowcase } from './showcase'

/**
 * Eyeron design-system showcase - fase 2 visual QA.
 * Toont alle primitives in 4 brand-varianten zodat we per-portal-theming
 * kunnen valideren. Alleen beschikbaar in development.
 */
export default function EyeronPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <EyeronShowcase />
}

export const metadata = {
  title: 'Eyeron primitives · dev',
  robots: { index: false, follow: false },
}

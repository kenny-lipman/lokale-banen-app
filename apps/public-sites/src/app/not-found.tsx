import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Custom 404 page.
 * Must not call headers() or getTenant() to avoid blocking
 * static prerendering of /_not-found.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-display mb-2">404</h1>
        <p className="text-body text-muted-foreground mb-6">
          Deze pagina bestaat niet of is verwijderd.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-primary-foreground font-semibold text-body transition-colors hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar vacatures
        </Link>
      </div>
    </div>
  )
}

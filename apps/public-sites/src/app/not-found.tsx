import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Deze pagina bestaat niet of is verwijderd.
        </p>
        <Button asChild>
          <Link href="/" className="inline-flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Terug naar vacatures
          </Link>
        </Button>
      </div>
    </div>
  )
}

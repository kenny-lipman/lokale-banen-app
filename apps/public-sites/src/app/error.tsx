'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <h2 className="text-h1 font-semibold text-foreground mb-2">Er ging iets mis</h2>
      <p className="text-body text-muted mb-6">
        We konden deze pagina niet laden. Probeer het opnieuw.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-button hover:opacity-90 transition-opacity"
      >
        Opnieuw proberen
      </button>
    </div>
  )
}

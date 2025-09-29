'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md mx-auto p-6">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Fout</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Er is iets misgegaan
        </h2>
        <p className="text-gray-600 mb-6">
          Er is een onverwachte fout opgetreden. Probeer het opnieuw.
        </p>
        <div className="space-y-2">
          <button
            onClick={reset}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Probeer opnieuw
          </button>
          <a
            href="/"
            className="block w-full px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center"
          >
            Terug naar Home
          </a>
        </div>
      </div>
    </div>
  )
}
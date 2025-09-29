export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center max-w-md mx-auto p-6">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Pagina niet gevonden
        </h2>
        <p className="text-gray-600 mb-6">
          De pagina die je zoekt bestaat niet of is verplaatst.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Terug naar Home
        </a>
      </div>
    </div>
  )
}
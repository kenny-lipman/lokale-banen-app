"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
import { Loader2, AlertCircle, CheckCircle, Lock, ChevronLeft } from "lucide-react"
import { Logo } from "@/components/ui/logo"

type ValidationState =
  | { state: 'checking' }
  | { state: 'valid' }
  | { state: 'invalid'; reason: 'missing' | 'invalid' | 'used' | 'expired' }

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validation, setValidation] = useState<ValidationState>({ state: 'checking' })

  useEffect(() => {
    if (!token) {
      setValidation({ state: 'invalid', reason: 'missing' })
      return
    }
    void (async () => {
      try {
        const res = await fetch('/api/auth/reset/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const body = (await res.json()) as { valid: boolean; reason?: 'missing' | 'invalid' | 'used' | 'expired' }
        if (body.valid) {
          setValidation({ state: 'valid' })
        } else {
          setValidation({ state: 'invalid', reason: body.reason ?? 'invalid' })
        }
      } catch {
        setValidation({ state: 'invalid', reason: 'invalid' })
      }
    })()
  }, [token])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("Wachtwoord moet minimaal 8 tekens bevatten")
      return
    }
    if (password !== confirm) {
      setError("Wachtwoorden komen niet overeen")
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setSuccess(true)
      setTimeout(() => router.push("/login"), 2000)
    } catch (err) {
      setError((err as Error).message || "Wachtwoord wijzigen mislukt")
    } finally {
      setLoading(false)
    }
  }

  if (validation.state === 'checking') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto mb-4" />
          <p className="text-gray-600">Reset-link controleren...</p>
        </div>
      </div>
    )
  }

  if (validation.state === 'invalid') {
    const reasons: Record<typeof validation.reason, string> = {
      missing: 'Geen reset-token gevonden in de URL.',
      invalid: 'Deze reset-link is ongeldig.',
      used: 'Deze reset-link is al gebruikt.',
      expired: 'Deze reset-link is verlopen (na 15 minuten).',
    }
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center pb-6">
            <div className="flex flex-col items-center space-y-4 mb-2">
              <Logo size="xl" className="text-gray-900" />
              <CardTitle className="text-xl font-semibold text-gray-900">Link niet bruikbaar</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-left">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm">{reasons[validation.reason]}</p>
            </div>
            <Link href="/forgot-password" className="block">
              <Button variant="outline" className="w-full">Nieuwe reset-link aanvragen</Button>
            </Link>
            <Link href="/login" className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
              <ChevronLeft className="w-3 h-3" />
              Terug naar inloggen
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="flex flex-col items-center space-y-4 mb-6">
            <Logo size="xl" className="text-gray-900" />
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">Nieuw wachtwoord</CardTitle>
              <p className="text-gray-600 mt-2 text-sm">Kies een nieuw wachtwoord voor je account.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Nieuw wachtwoord
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  placeholder="Minimaal 8 tekens"
                  required
                  minLength={8}
                  disabled={loading || success}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-sm font-medium text-gray-700">
                Bevestig wachtwoord
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <PasswordInput
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-10"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  disabled={loading || success}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                <p className="text-green-700 text-sm">Wachtwoord gewijzigd. Je wordt doorverwezen naar inloggen...</p>
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading || success}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Wijzigen...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Gewijzigd
                </>
              ) : (
                "Wachtwoord opslaan"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}

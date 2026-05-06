"use client"

import { useState } from "react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Logo } from "@/components/ui/logo"
import { ChevronLeft, Mail, CheckCircle, AlertCircle, Loader2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    try {
      const res = await fetch("/api/auth/reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      setSuccess(true)
    } catch (err) {
      setError((err as Error).message || "Fout bij versturen e-mail")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="pb-6">
          <Link href="/login" className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-4">
            <ChevronLeft className="w-3 h-3" />
            Terug naar inloggen
          </Link>
          <div className="flex flex-col items-center space-y-4">
            <Logo size="xl" className="text-gray-900" />
            <div className="text-center">
              <CardTitle className="text-2xl font-bold text-gray-900">Wachtwoord vergeten</CardTitle>
              <p className="text-gray-600 mt-2 text-sm">We sturen een reset-link naar je e-mail.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgot} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                E-mailadres
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  placeholder="naam@bedrijf.nl"
                  required
                  disabled={loading || success}
                  autoComplete="email"
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
              <div className="flex items-start space-x-2 p-3 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-green-700 text-sm">
                  Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een reset-link. De link is 15 minuten geldig.
                </p>
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading || success}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Versturen...
                </>
              ) : (
                "Reset-link versturen"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

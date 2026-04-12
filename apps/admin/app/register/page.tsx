"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { supabaseService } from "@/lib/supabase-service"
import { PasswordInput } from "@/components/ui/password-input"
import { Logo } from "@/components/ui/logo"

function validateEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    if (!validateEmail(email)) {
      setError("Ongeldig e-mailadres")
      setLoading(false)
      return
    }
    if (password.length < 6) {
      setError("Wachtwoord moet minimaal 6 tekens zijn")
      setLoading(false)
      return
    }
    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen")
      setLoading(false)
      return
    }
    try {
      // Supabase Auth signUp
      const { data, error } = await supabaseService.client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          user_metadata: { full_name: fullName }
        }
      })
      if (error) throw error
      setSuccess(true)
      // Optionally: router.push("/dashboard")
    } catch (err: any) {
      setError(err.message || "Registratie mislukt")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (success) {
      router.push("/dashboard")
    }
  }, [success, router])

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="flex flex-col items-center space-y-4 mb-6">
            <Logo size="xl" className="text-gray-900" />
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">Account aanmaken</CardTitle>
              <p className="text-gray-600 mt-2">Maak uw account aan</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Naam</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required disabled={loading || success} />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading || success} />
            </div>
            <div>
              <Label htmlFor="password">Wachtwoord</Label>
              <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} disabled={loading || success} />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Bevestig wachtwoord</Label>
              <PasswordInput id="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} disabled={loading || success} />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">Registratie gelukt! Check je inbox voor verificatie.</div>}
            <Button type="submit" className="w-full" disabled={loading || success}>{loading ? "Registreren..." : success ? "Geregistreerd" : "Registreren"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 
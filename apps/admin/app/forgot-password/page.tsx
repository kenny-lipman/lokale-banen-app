"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { supabaseService } from "@/lib/supabase-service"
import { Logo } from "@/components/ui/logo"

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
      const { error } = await supabaseService.client.auth.resetPasswordForEmail(email)
      if (error) throw error
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Fout bij versturen e-mail")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="flex flex-col items-center space-y-4 mb-6">
            <Logo size="xl" className="text-gray-900" />
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">Wachtwoord vergeten</CardTitle>
              <p className="text-gray-600 mt-2">Reset uw wachtwoord</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">Check je inbox voor de reset-link.</div>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Versturen..." : "Verstuur reset-link"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 
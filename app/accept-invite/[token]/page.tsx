"use client"

import { useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"

export default function AcceptInvitePage() {
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const params = useParams<{ token: string }>()
  const token = params.token

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    if (password.length < 6) {
      setError("Wachtwoord moet minimaal 6 tekens zijn")
      setLoading(false)
      return
    }
    try {
      const res = await fetch("/api/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Uitnodiging accepteren mislukt")
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Uitnodiging accepteren mislukt")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Uitnodiging accepteren</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Naam</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required disabled={loading || success} />
            </div>
            <div>
              <Label htmlFor="password">Wachtwoord</Label>
              <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} disabled={loading || success} />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">Account aangemaakt! Je kunt nu inloggen.</div>}
            <Button type="submit" className="w-full" disabled={loading || success}>{loading ? "Aanmaken..." : success ? "Account aangemaakt" : "Account aanmaken"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 
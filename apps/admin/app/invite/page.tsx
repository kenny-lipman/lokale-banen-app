"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { Logo } from "@/components/ui/logo"

function validateEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

export default function InvitePage() {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("member")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { isAdmin, loading: authLoading } = useAuth()

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(false)
    if (!validateEmail(email)) {
      setError("Ongeldig e-mailadres")
      setLoading(false)
      return
    }
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Uitnodigen mislukt")
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "Uitnodigen mislukt")
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen">Laden...</div>
  }

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Geen toegang</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-red-600">Alleen admins mogen collega’s uitnodigen.</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <div className="flex flex-col items-center space-y-4 mb-6">
            <Logo size="xl" className="text-gray-900" />
            <div>
              <CardTitle className="text-2xl font-bold text-gray-900">Nodig collega uit</CardTitle>
              <p className="text-gray-600 mt-2">Stuur een uitnodiging</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={loading} />
            </div>
            <div>
              <Label htmlFor="role">Rol</Label>
              <select id="role" value={role} onChange={e => setRole(e.target.value)} className="w-full border rounded px-2 py-2" disabled={loading}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">Uitnodiging verstuurd!</div>}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Uitnodigen..." : "Uitnodigen"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 
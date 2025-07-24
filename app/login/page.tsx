"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { supabaseService } from "@/lib/supabase-service"
import Link from "next/link"
import { PasswordInput } from "@/components/ui/password-input"
import { useAuth } from "@/components/auth-provider"
import { Loader2, Mail, Lock, AlertCircle, CheckCircle } from "lucide-react"

function validateEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const { isAuthenticated, loading: authLoading, authState } = useAuth()

  // Clear error when user starts typing
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (error) setError(null)
  }, [error])

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    if (error) setError(null)
  }, [error])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!validateEmail(email)) {
      setError("Voer een geldig e-mailadres in")
      return
    }
    if (password.length < 6) {
      setError("Wachtwoord moet minimaal 6 tekens bevatten")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const { data, error } = await supabaseService.client.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      setSuccess(true)
      // Auth provider will handle the redirect automatically
      
    } catch (err: any) {
      console.error('Login error:', err)
      
      // User-friendly error messages
      if (err.message?.includes('Invalid login credentials')) {
        setError("Ongeldige inloggegevens. Controleer uw e-mail en wachtwoord.")
      } else if (err.message?.includes('Email not confirmed')) {
        setError("E-mailadres nog niet bevestigd. Controleer uw inbox.")
      } else if (err.message?.includes('Too many requests')) {
        setError("Te veel pogingen. Probeer het later opnieuw.")
      } else {
        setError("Inloggen mislukt. Probeer het opnieuw.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Show loading state if auth is initializing
  if (authLoading || authState === 'INITIALIZING') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Bezig met laden...</p>
        </div>
      </div>
    )
  }

  // If already authenticated, show redirect message
  if (isAuthenticated) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-4" />
          <p className="text-gray-600">U wordt doorverwezen...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold text-gray-900">Welkom terug</CardTitle>
          <p className="text-gray-600 mt-2">Log in op uw account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
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
                  onChange={handleEmailChange}
                  className="pl-10"
                  placeholder="naam@bedrijf.nl"
                  required 
                  disabled={loading || success}
                  autoComplete="email"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Wachtwoord
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <PasswordInput 
                  id="password" 
                  value={password} 
                  onChange={handlePasswordChange}
                  className="pl-10"
                  placeholder="••••••••"
                  required 
                  minLength={6} 
                  disabled={loading || success}
                  autoComplete="current-password"
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
                <p className="text-green-600 text-sm">Succesvol ingelogd!</p>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-11" 
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Inloggen...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Ingelogd
                </>
              ) : (
                "Inloggen"
              )}
            </Button>
          </form>
          
          <div className="mt-8 text-center">
            <p className="text-gray-600 text-sm">
              Nog geen account?{" "}
              <Link 
                href="/register" 
                className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
              >
                Registreer hier
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 
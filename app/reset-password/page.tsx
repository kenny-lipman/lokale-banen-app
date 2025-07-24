"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { supabaseService } from "@/lib/supabase-service"
import { PasswordInput } from "@/components/ui/password-input"
import { Loader2, AlertCircle, CheckCircle } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [processing, setProcessing] = useState(true)
  const router = useRouter()

  // Handle access token from URL hash or query params
  useEffect(() => {
    const processAccessToken = async () => {
      try {
        // Check for hash fragment first (Supabase recovery links)
        const hash = window.location.hash
        if (hash) {
          const params = new URLSearchParams(hash.substring(1))
          const accessToken = params.get('access_token')
          const refreshToken = params.get('refresh_token')
          
          if (accessToken && refreshToken) {
            console.log('Processing recovery tokens from hash...')
            const { data, error } = await supabaseService.client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            })
            
            if (error) {
              console.error('Session error:', error)
              setError('Ongeldige of verlopen recovery link')
            } else {
              console.log('Session set successfully')
            }
          }
        }
        
        setProcessing(false)
      } catch (err) {
        console.error('Error processing access token:', err)
        setError('Er is een fout opgetreden bij het verwerken van de recovery link')
        setProcessing(false)
      }
    }

    processAccessToken()
  }, [])

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password.length < 6) {
      setError("Wachtwoord moet minimaal 6 tekens bevatten")
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(false)
    
    try {
      const { data, error } = await supabaseService.client.auth.updateUser({ 
        password: password 
      })
      
      if (error) throw error
      
      setSuccess(true)
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/login")
      }, 2000)
      
    } catch (err: any) {
      console.error('Password reset error:', err)
      setError(err.message || "Wachtwoord resetten mislukt")
    } finally {
      setLoading(false)
    }
  }

  if (processing) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Recovery link verwerken...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl font-bold text-gray-900">Nieuw wachtwoord instellen</CardTitle>
          <p className="text-gray-600 mt-2">Voer uw nieuwe wachtwoord in</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                Nieuw wachtwoord
              </Label>
              <PasswordInput 
                id="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                required 
                minLength={6}
                disabled={loading || success}
                autoComplete="new-password"
              />
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
                <p className="text-green-600 text-sm">Wachtwoord succesvol gewijzigd. U wordt doorverwezen naar de login pagina.</p>
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
                  Wachtwoord wijzigen...
                </>
              ) : success ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Gewijzigd
                </>
              ) : (
                "Wachtwoord wijzigen"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 
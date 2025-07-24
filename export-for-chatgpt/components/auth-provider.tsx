"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { supabaseService } from "@/lib/supabase-service"

interface AuthContextType {
  user: any | null
  profile: any | null
  isAuthenticated: boolean
  isAdmin: boolean
  loading: boolean
  refresh: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshIndex, setRefreshIndex] = useState(0)

  const refresh = () => setRefreshIndex(i => i + 1)

  const logout = async () => {
    // Eerst de state clearen om onmiddellijk uit te loggen
    setUser(null)
    setProfile(null)
    
    // Dan Supabase auth uitloggen
    await supabaseService.client.auth.signOut()
  }

  useEffect(() => {
    let mounted = true
    setLoading(true)
    supabaseService.client.auth.getUser().then(async ({ data, error }) => {
      if (!mounted) return
      if (error || !data?.user) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }
      setUser(data.user)
      // Haal profiel op
      const { data: profileData } = await supabaseService.client
        .from("profiles")
        .select("*")
        .eq("id", data.user.id)
        .single()
      setProfile(profileData)
      setLoading(false)
    })
    return () => { mounted = false }
  }, [refreshIndex])

  const isAuthenticated = !!user
  const isAdmin = profile?.role === "admin"

  return (
    <AuthContext.Provider value={{ user, profile, isAuthenticated, isAdmin, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
} 
"use client"

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { User, Session } from "@supabase/supabase-js"

// Auth state machine
type AuthState = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'ERROR'

interface AuthContextType {
  user: User | null
  profile: any | null
  session: Session | null
  isAuthenticated: boolean
  isAdmin: boolean
  loading: boolean
  authState: AuthState
  refresh: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authState, setAuthState] = useState<AuthState>('INITIALIZING')
  const [refreshIndex, setRefreshIndex] = useState(0)

  // Refs to prevent race conditions
  const mountedRef = useRef(true)
  const initializationRef = useRef(false)
  const profileFetchRef = useRef<Promise<any> | null>(null)

  const refresh = useCallback(() => {
    console.log('Force refreshing auth state...')
    setRefreshIndex(i => i + 1)
    // Reset initialization flag to force re-initialization
    initializationRef.current = false
  }, [])

  // Optimized logout with immediate UI feedback
  const logout = useCallback(async () => {
    console.log('Logging out...')
    // Immediate UI update
    setUser(null)
    setProfile(null)
    setSession(null)
    setAuthState('UNAUTHENTICATED')
    setLoading(false)
    
    // Background cleanup
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }, [])

  // Optimized profile fetching with caching
  const fetchProfile = useCallback(async (userId: string) => {
    // Prevent duplicate profile fetches
    if (profileFetchRef.current) {
      return profileFetchRef.current
    }

    const profilePromise = (async () => {
      try {
        const supabase = createClient()
        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            // Profile doesn't exist, create one
            const { data: { user: currentUser } } = await supabase.auth.getUser()

            const { data: newProfile, error: createError } = await supabase
              .from("profiles")
              .insert({
                id: userId,
                email: currentUser?.email || '',
                full_name: currentUser?.user_metadata?.full_name || currentUser?.email || '',
                role: 'member'
              })
              .select()
              .single()

            if (createError) {
              console.error('Error creating profile:', createError)
              return null
            }

            return newProfile
          }

          console.error('Error fetching profile:', error)
          return null
        }

        return profileData
      } catch (error) {
        console.error('Error in profile fetch:', error)
        return null
      } finally {
        profileFetchRef.current = null
      }
    })()

    profileFetchRef.current = profilePromise
    return profilePromise
  }, [])

  // Initialize authentication with improved session handling
  useEffect(() => {
    if (initializationRef.current) return
    initializationRef.current = true

    let mounted = true
    setLoading(true)
    setAuthState('INITIALIZING')

    console.log('Starting auth initialization...')

    const initializeAuth = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Auth initialization timeout')), 10000) // 10 second timeout
        })

        // First, try to get the current session with timeout
        const supabase = createClient()
        const sessionPromise = supabase.auth.getSession()
        const { data: { session }, error: sessionError } = await Promise.race([sessionPromise, timeoutPromise]) as any
        
        if (!mounted) return

        if (sessionError) {
          console.error('Session error:', sessionError)
          // Don't set error state for session errors, just set as unauthenticated
          setAuthState('UNAUTHENTICATED')
          setLoading(false)
          return
        }

        console.log('Session check result:', { 
          hasSession: !!session, 
          hasUser: !!session?.user,
          sessionExpiresAt: session?.expires_at,
          currentTime: Math.floor(Date.now() / 1000)
        })

        if (session?.user) {
          console.log('User found, setting authenticated state')
          setUser(session.user)
          setSession(session)
          setAuthState('AUTHENTICATED')
          
          // Fetch profile in background (non-blocking)
          fetchProfile(session.user.id).then(profileData => {
            if (mounted) {
              setProfile(profileData)
            }
          }).catch(error => {
            console.error('Profile fetch error:', error)
            // Continue without profile
          })
        } else {
          console.log('No session found, setting unauthenticated state')
          setAuthState('UNAUTHENTICATED')
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          // Don't set error state for general errors, just set as unauthenticated
          setAuthState('UNAUTHENTICATED')
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Set up auth state listener with improved error handling
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        console.log('Auth state change:', event, session?.user?.id)
        
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user) {
              console.log('User signed in, updating state')
              setUser(session.user)
              setSession(session)
              setAuthState('AUTHENTICATED')
              setLoading(false)
              
              // Fetch profile in background
              fetchProfile(session.user.id).then(profileData => {
                if (mounted) {
                  setProfile(profileData)
                }
              })
            }
            break
            
          case 'SIGNED_OUT':
            console.log('User signed out, clearing state')
            setUser(null)
            setProfile(null)
            setSession(null)
            setAuthState('UNAUTHENTICATED')
            setLoading(false)
            break
            
          case 'TOKEN_REFRESHED':
            if (session?.user) {
              console.log('Token refreshed, updating session')
              setUser(session.user)
              setSession(session)
            }
            break
            
          case 'USER_UPDATED':
            if (session?.user) {
              console.log('User updated, updating state')
              setUser(session.user)
              setSession(session)
            }
            break
        }
      }
    )

    return () => {
      mounted = false
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // Reset initialization flag on refresh
  useEffect(() => {
    initializationRef.current = false
  }, [refreshIndex])

  // Improved authentication check - more reliable
  const isAuthenticated = authState === 'AUTHENTICATED' && !!user && !!session
  const isAdmin = profile?.role === "admin"

  // Debug logging
  useEffect(() => {
    console.log('Auth state updated:', {
      user: user?.id,
      profile: profile?.id,
      isAuthenticated,
      loading,
      authState,
      session: session?.user?.id,
      sessionExpiresAt: session?.expires_at
    })
  }, [user, profile, isAuthenticated, loading, authState, session])

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      session, 
      isAuthenticated, 
      isAdmin, 
      loading, 
      authState,
      refresh, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
} 
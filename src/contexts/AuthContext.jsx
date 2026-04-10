// src/contexts/AuthContext.jsx
// Global auth context — provides user, role, restaurant_id, impersonation
// Real-time force-kick via direct DB polling on profiles + restaurants

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../supabase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]                     = useState(undefined) // undefined = loading
  const [impersonating, setImpersonating]   = useState(null)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [kicked, setKicked]                 = useState(false)
  const signOutInProgressRef = useRef(false)

  // Force sign-out helper
  const forceSignOut = useCallback(async (reason) => {
    if (signOutInProgressRef.current) return
    signOutInProgressRef.current = true
    console.warn('[Auth] Force sign-out triggered:', reason)
    setImpersonating(null)
    setKicked(true)
    try {
      await supabase.auth.signOut()
    } catch {
      setUser(null)
    }
    signOutInProgressRef.current = false
  }, [])

  // ── Initial auth setup ──────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    
    // Check for impersonation state in localStorage on mount
    const backup = localStorage.getItem('sa_session_backup')
    setIsImpersonating(!!backup)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (!session) {
        setImpersonating(null)
        // If we log out and have no backup, we aren't impersonating
        if (!localStorage.getItem('sa_session_backup')) setIsImpersonating(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ══════════════════════════════════════════════════════════════════════
  // INSTANT REAL-TIME KICK: Listen for profiles.is_disabled + restaurants.is_active
  // ══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!user) return

    const myRole = user.user_metadata?.role
    if (myRole === 'super_admin') return // Super admins are immune

    const myUserId = user.id
    const myRestaurantId = user.user_metadata?.restaurant_id

    // ── Function to check status (Manual verify) ─────────────────────
    const checkStatus = async () => {
      try {
        const { data: profile } = await supabase.from('profiles').select('is_disabled').eq('id', myUserId).single()
        if (profile?.is_disabled) return forceSignOut('Account disabled')

        if (myRestaurantId) {
          const { data: rest } = await supabase.from('restaurants').select('is_active').eq('id', myRestaurantId).single()
          if (rest && rest.is_active === false) return forceSignOut('Restaurant disabled')
        }
      } catch (err) { console.warn('[Auth] Check failed:', err) }
    }

    // ── 1. Real-time Profile Listener ────────────────────────────────
    const profChannel = supabase.channel(`auth-prof-${myUserId}`)
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${myUserId}` },
        (payload) => {
          console.log('[Auth] Profile changed instantly:', payload.new)
          if (payload.new.is_disabled) forceSignOut('Account disabled by administrator')
        }
      )
      .subscribe()

    // ── 2. Real-time Restaurant Listener ─────────────────────────────
    let restChannel = null
    if (myRestaurantId) {
      restChannel = supabase.channel(`auth-rest-${myRestaurantId}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'restaurants', filter: `id=eq.${myRestaurantId}` },
          (payload) => {
            console.log('[Auth] Restaurant changed instantly:', payload.new)
            if (payload.new.is_active === false) forceSignOut('Restaurant disabled by administrator')
          }
        )
        .subscribe()
    }

    // ── 3. Periodic Fallback (every 30s instead of 5s) ────────────────
    const interval = setInterval(checkStatus, 30000)
    checkStatus() // check once on mount

    return () => {
      supabase.removeChannel(profChannel)
      if (restChannel) supabase.removeChannel(restChannel)
      clearInterval(interval)
    }
  }, [user, forceSignOut])

  // ── Broadcast channel backup (instant when it works) ────────────────
  useEffect(() => {
    if (!user) return

    const userMeta = user.user_metadata || {}
    const myUserId = user.id
    const myRestaurantId = userMeta.restaurant_id
    const myRole = userMeta.role

    if (myRole === 'super_admin') return

    const channel = supabase.channel('force-logout-signals')
    channel.on('broadcast', { event: 'force-logout' }, (msg) => {
      const { user_id, restaurant_id } = msg.payload || {}
      const targetMe =
        (user_id && user_id === myUserId) ||
        (restaurant_id && restaurant_id === myRestaurantId)
      if (targetMe) {
        forceSignOut('Super Admin force-logout')
      }
    })
    channel.subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, forceSignOut])

  // ── Derived role info ───────────────────────────────────────────────
  const meta = user?.user_metadata || {}
  const parseMetadataId = (id) => {
    if (!id || id === 'undefined' || id === 'null') return null
    return id
  }

  const realRole      = meta.role || null
  const realRestId    = parseMetadataId(meta.restaurant_id)
  const role          = impersonating ? 'admin' : realRole
  const restaurantId  = impersonating ? impersonating.restaurant_id : realRestId
  const isSuperAdmin  = realRole === 'super_admin'
  const isAdmin       = role === 'admin'
  const isWaiter      = role === 'waiter'

  const startImpersonation = useCallback(async (restaurant, getLinkFn) => {
    try {
      // 1. Get the current Super Admin session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('No active Super Admin session found')

      // 2. Back it up to localStorage
      localStorage.setItem('sa_session_backup', JSON.stringify(session))
      setIsImpersonating(true)

      // 3. Get the magic link for the target admin
      const link = await getLinkFn(restaurant.id)
      
      // 4. Navigate to the link (browser handles verified login)
      window.location.href = link
    } catch (err) {
      console.error('[Auth] Failed to start impersonation:', err)
      setIsImpersonating(false)
      localStorage.removeItem('sa_session_backup')
      throw err
    }
  }, [])

  const stopImpersonation = useCallback(async () => {
    const backupStr = localStorage.getItem('sa_session_backup')
    if (!backupStr) {
      setImpersonating(null)
      setIsImpersonating(false)
      return
    }

    try {
      const backup = JSON.parse(backupStr)
      
      // 1. Sign out of the Admin account
      await supabase.auth.signOut()
      
      // 2. Restore the Super Admin session
      const { error } = await supabase.auth.setSession({
        access_token: backup.access_token,
        refresh_token: backup.refresh_token,
      })

      if (error) throw error

      // 3. Clean up
      localStorage.removeItem('sa_session_backup')
      setIsImpersonating(false)
      setImpersonating(null)
      
      // 4. Redirect to Super Admin dashboard
      window.location.href = '/superadmin'
    } catch (err) {
      console.error('[Auth] Failed to restore Super Admin session:', err)
      localStorage.removeItem('sa_session_backup')
      setIsImpersonating(false)
      window.location.href = '/login/superadmin'
    }
  }, [])

  const signOut = useCallback(async () => {
    setImpersonating(null)
    setKicked(false)
    await supabase.auth.signOut()
  }, [])

  const dismissKicked = useCallback(() => setKicked(false), [])

  const value = {
    user, role, realRole, restaurantId, realRestId,
    isSuperAdmin, isAdmin, isWaiter,
    impersonating, isImpersonating, startImpersonation, stopImpersonation,
    signOut, kicked, dismissKicked,
    loading: user === undefined,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

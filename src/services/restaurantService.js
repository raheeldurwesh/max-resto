// src/services/restaurantService.js
// Restaurant CRUD + user management RPCs

import { supabase } from '../supabase/client'
import { deleteMenuImage } from './menuService'

const TABLE = 'restaurants'

// ── Fetch all restaurants ─────────────────────────────────────────────────────
export async function fetchRestaurants() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Fetch restaurant by slug ──────────────────────────────────────────────────
export async function fetchRestaurantBySlug(slug) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) throw error
  return data
}

// ── Fetch restaurant by ID ────────────────────────────────────────────────────
export async function getRestaurantById(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ── Check if slug is taken ────────────────────────────────────────────────────
export async function isSlugAvailable(slug) {
  if (!slug) return true
  const target = slug.toLowerCase().trim()
  
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, name, slug')
    .eq('slug', target)
    .limit(1)
  
  if (error) {
    console.error('[isSlugAvailable] DB Error:', error)
    return false // Assume taken on error for safety
  }
  
  const isAvailable = !data || data.length === 0
  console.log(`[isSlugAvailable] Slug "${target}" Check: ${isAvailable ? 'AVAILABLE' : 'TAKEN'}`)
  return isAvailable
}

// ── Create restaurant ─────────────────────────────────────────────────────────
export async function createRestaurant({ name, slug }) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name, slug: slug.toLowerCase().trim() })
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Toggle restaurant active/inactive ─────────────────────────────────────────
export async function toggleRestaurantStatus(restaurantId, setActive) {
  const { error } = await supabase.functions.invoke('admin-handler', {
    body: { action: 'toggleRestaurantStatus', params: { restaurantId, setActive } }
  })
  if (error) throw error
  
  // Broadcast real-time force-logout signal if disabling
  if (!setActive) {
    await broadcastForceLogout(null, restaurantId)
  }
}


export async function isEmailAvailable(email) {
  if (!email) return true
  const cleanEmail = email.trim().toLowerCase()

  // 1. Check via Admin Handler Edge Function (Primary - covers Auth)
  try {
    const { data, error } = await supabase.functions.invoke('admin-handler', {
      body: { action: 'isEmailAvailable', params: { email: cleanEmail } }
    })
    if (error) throw error
    if (data?.available === false) {
      console.log(`[isEmailAvailable] Found in Auth via Edge Function: ${cleanEmail}`)
      return false
    }
  } catch (err) {
    console.error('[isEmailAvailable] Edge Function Error:', err)
  }

  // 2. Fallback: Check via Public Profiles table (Secondary)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle()

    if (data) {
      console.log(`[isEmailAvailable] Found in Profiles: ${cleanEmail}`)
      return false
    }
    if (error) console.error('[isEmailAvailable] Profiles Error:', error)
  } catch (err) {
    console.error('[isEmailAvailable] Profiles catch:', err)
  }

  return true
}

// ── Create user (admin/waiter) via Edge Function ───────────────────────────
export async function createUser({ email, password, role, restaurantId }) {
  const { data, error } = await supabase.functions.invoke('admin-handler', {
    body: { action: 'createUser', params: { email, password, role, restaurantId } }
  })

  if (error) throw error
  return data.userId
}

// ── Get users for a restaurant ────────────────────────────────────────────────
export async function getRestaurantUsers(restaurantId = null) {
  const { data, error } = await supabase.rpc('get_restaurant_users', {
    p_restaurant_id: restaurantId,
  })
  if (error) throw error
  return data || []
}

// ── Reset password ────────────────────────────────────────────────────────────
export async function resetUserPassword(userId, newPassword) {
  const { error } = await supabase.functions.invoke('admin-handler', {
    body: { action: 'resetPassword', params: { userId, newPassword } }
  })
  if (error) throw error
}

// ── Broadcast a force-logout signal via Supabase Realtime ─────────────────────
// Target clients listen on this channel and sign out when they receive the signal
async function broadcastForceLogout(targetUserId, targetRestaurantId) {
  const channel = supabase.channel('force-logout-signals')
  await channel.subscribe()
  await channel.send({
    type: 'broadcast',
    event: 'force-logout',
    payload: {
      user_id: targetUserId || null,
      restaurant_id: targetRestaurantId || null,
      timestamp: Date.now(),
    },
  })
  // Small delay to ensure delivery, then cleanup
  setTimeout(() => supabase.removeChannel(channel), 2000)
}

// ── Disable / Enable individual user ──────────────────────────────────────────
export async function toggleUserStatus(userId, disable) {
  const { error } = await supabase.functions.invoke('admin-handler', {
    body: { action: 'toggleUserStatus', params: { userId, disable } }
  })
  if (error) throw error

  // 3. Broadcast as backup for real-time kick
  if (disable) {
    await broadcastForceLogout(userId, null)
  }
}

// ── Force logout ──────────────────────────────────────────────────────────────
export async function forceLogout({ userId, restaurantId }) {
  const { error } = await supabase.functions.invoke('admin-handler', {
    body: { action: 'forceLogout', params: { userId, restaurantId } }
  })
  if (error) throw error
  
  // Broadcast real-time signals
  if (userId) await broadcastForceLogout(userId, null)
  else if (restaurantId) await broadcastForceLogout(null, restaurantId)
  
  return 1 // Simplified count
}

// ── Delete user (auth + profiles table) ───────────────────────────────────────
export async function deleteUser(userId) {
  const { error } = await supabase.functions.invoke('admin-handler', {
    body: { action: 'deleteUser', params: { userId } }
  })
  if (error) throw error
}

// ── Delete restaurant (full cascade) ──────────────────────────────────────────
export async function deleteRestaurant(restaurantId) {
  // 1. Delete menu images from storage locally (Edge functions can't always access private buckets easily without work)
  const { data: menuItems } = await supabase
    .from('menu')
    .select('image_url')
    .eq('restaurant_id', restaurantId)

  if (menuItems) {
    for (const item of menuItems) {
      if (item.image_url) {
        try { await deleteMenuImage(item.image_url) } catch { /* best-effort */ }
      }
    }
  }

  // 2. Call admin-handler to perform Auth & Table deletions
  const { error } = await supabase.functions.invoke('admin-handler', {
    body: { action: 'deleteRestaurant', params: { restaurantId } }
  })
  if (error) throw error
}

/**
 * ── Real-time subscription to Restaurants ─────────────────────────────────────
 * Listens for INSERT, UPDATE, DELETE on the 'restaurants' table.
 */
export function subscribeToRestaurants(onChange) {
  const channelName = `realtime-restaurants-${Date.now()}`
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload) => {
      console.log('[Supabase] REALTIME restaurant change:', payload)
      onChange(payload)
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}

/**
 * ── Real-time subscription to Profiles (Users) ────────────────────────────────
 * Useful for Super Admin to see instant changes in user roles or status.
 */
export function subscribeToProfiles(onChange, restaurantId = null) {
  const channelName = `realtime-profiles-${Date.now()}`
  const filter = restaurantId
    ? { event: '*', schema: 'public', table: 'profiles', filter: `restaurant_id=eq.${restaurantId}` }
    : { event: '*', schema: 'public', table: 'profiles' }

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', filter, (payload) => {
      console.log('[Supabase] REALTIME profile change:', payload)
      onChange(payload)
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}

/**
 * ── Generate a secure impersonation link for a restaurant's admin ─────────────
 * Finds the admin user for the given restaurant and creates a magic link
 * restricted for Super Admin use.
 */
export async function getImpersonationLink(restaurantId, targetPath = 'admin') {
  const { data, error } = await supabase.functions.invoke('admin-handler', {
    body: { action: 'getImpersonationLink', params: { restaurantId, targetPath } }
  })
  
  if (error) {
    // Attempt to extract detailed error from body
    const details = await error.context?.json?.().catch(() => null)
    throw new Error(details?.error || error.message)
  }
  return data.link
}

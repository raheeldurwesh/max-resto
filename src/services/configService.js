// src/services/configService.js
// Per-restaurant configuration — stored in `config` table
// UPDATED: restaurant_id scoping for multi-tenant SaaS

import { supabase } from '../supabase/client'

const TABLE = 'config'

export const DEFAULT_CONFIG = {
  restaurant_name: 'TableServe',
  tagline:         'Restaurant Management System',
  address:         '',
  phone:           '',
  gst_number:      '',
  tax_percentage:  8,
  currency:        '₹',
  total_tables:    20,
  categories:      'Pizza, Burger, Pasta, Drinks, Desserts, Other',
}

// ── Fetch config (by restaurant_id) ───────────────────────────────────────────
export async function fetchConfig(restaurantId) {
  let query = supabase.from(TABLE).select('*')

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId)
  }

  // Use limit(1) instead of single() to avoid 406/PGRST116 errors
  const { data, error } = await query.limit(1)

  if (error) {
    console.error('[fetchConfig] Error:', error)
    return { ...DEFAULT_CONFIG }
  }

  if (!data || data.length === 0) {
    return { ...DEFAULT_CONFIG }
  }

  return { ...DEFAULT_CONFIG, ...data[0] }
}

// ── Save config ───────────────────────────────────────────────────────────────
export async function saveConfig(updates, restaurantId) {
  if (!restaurantId) {
    // Legacy support for id: 1
    const { error } = await supabase.from(TABLE).upsert({ id: 1, ...updates })
    if (error) throw error
    return
  }

  // Multi-tenant: Upsert by restaurant_id
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { ...updates, restaurant_id: restaurantId },
      { onConflict: 'restaurant_id' }
    )
  
  if (error) throw error
}

// ── Real-time subscription ────────────────────────────────────────────────────
export function subscribeToConfig(onChange, restaurantId) {
  const channelName = `config-changes-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const filter = restaurantId
    ? { event: '*', schema: 'public', table: TABLE, filter: `restaurant_id=eq.${restaurantId}` }
    : { event: '*', schema: 'public', table: TABLE }

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', filter, onChange)
    .subscribe()

  return () => supabase.removeChannel(channel)
}

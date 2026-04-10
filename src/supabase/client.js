// src/supabase/client.js
// Single Supabase client instance — import this everywhere instead of firebase/config

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Supabase URL or Anon Key missing from .env')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    timeout: 30000,           // Give it more time to establish
    heartbeatIntervalMs: 2500, // Keep connection alive more aggressively
  },
})

export default supabase

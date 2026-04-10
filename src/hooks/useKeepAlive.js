// src/hooks/useKeepAlive.js
// Supabase free tier pauses after 7 days of inactivity.
// This hook:
//   1. Pings the DB every 4 minutes when the app is open (prevents pause)
//   2. Detects "project is paused / offline" errors
//   3. Returns { isWakingUp, retryNow } so the UI can show a "Waking up…" screen

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabase/client'

const PING_INTERVAL_MS = 4 * 60 * 1000   // 4 minutes

// Messages returned by Supabase when the project is paused
const PAUSE_PATTERNS = [
  'project is paused',
  'project paused',
  'service_unavailable',
  'failed to fetch',
  '503',
]

function isPauseError(err) {
  const msg = (err?.message || err?.toString() || '').toLowerCase()
  return PAUSE_PATTERNS.some(p => msg.includes(p))
}

export function useKeepAlive() {
  const [isWakingUp, setIsWakingUp] = useState(false)
  const retryTimeout = useRef(null)

  // Lightweight ping — just selects a single row from config
  const ping = useCallback(async () => {
    try {
      await supabase.from('config').select('id').limit(1)
      if (isWakingUp) setIsWakingUp(false)
    } catch (err) {
      if (isPauseError(err)) {
        setIsWakingUp(true)
        // Auto-retry after 8 seconds
        retryTimeout.current = setTimeout(() => ping(), 8000)
      }
    }
  }, [isWakingUp])

  // Start interval ping when app mounts
  useEffect(() => {
    ping()
    const interval = setInterval(ping, PING_INTERVAL_MS)
    return () => {
      clearInterval(interval)
      if (retryTimeout.current) clearTimeout(retryTimeout.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const retryNow = () => {
    if (retryTimeout.current) clearTimeout(retryTimeout.current)
    ping()
  }

  return { isWakingUp, retryNow }
}

// ── Expose error detector so service calls can trigger wake-up state ────────
// Usage: if (isSupabasePauseError(err)) { /* show wake-up screen */ }
export { isPauseError as isSupabasePauseError }

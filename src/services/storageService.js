// src/services/storageService.js
// Storage bucket monitoring — list files, calculate usage vs. free-tier limits

import { supabase } from '../supabase/client'

const BUCKET = 'menu-images'
const FREE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024 // 1 GB

// ── Get storage stats globally ────────────────────────────────────────────────
export async function getStorageStats() {
  try {
    const { data, error } = await supabase.functions.invoke('admin-handler', {
      body: { action: 'getStorageStats' }
    })
    
    if (error) {
      const details = await error.context?.json?.().catch(() => null)
      throw new Error(details?.error || error.message)
    }

    const usedBytes = data.usedBytes
    const usedMB  = usedBytes / (1024 * 1024)
    const limitMB = FREE_LIMIT_BYTES / (1024 * 1024)
    const usedPct = Math.min((usedBytes / FREE_LIMIT_BYTES) * 100, 100)

    return {
      usedBytes,
      limitBytes: FREE_LIMIT_BYTES,
      usedMB:     parseFloat(usedMB.toFixed(2)),
      limitMB:    parseFloat(limitMB.toFixed(2)),
      usedPct:    parseFloat(usedPct.toFixed(1)),
      fileCount:  data.fileCount,
    }
  } catch (err) {
    console.error('[getStorageStats] Error:', err)
    return { usedBytes: 0, limitBytes: FREE_LIMIT_BYTES, usedMB: 0, limitMB: 1024, usedPct: 0, fileCount: 0 }
  }
}

// ── Get storage stats broken down by restaurant ──────────────────────────────
export async function getStorageStatsByRestaurant() {
  try {
    const { data, error } = await supabase.functions.invoke('admin-handler', {
      body: { action: 'getStorageStatsByRestaurant' }
    })
    if (error) throw error

    // Transform raw stats into UI format
    const result = {}
    for (const rid in data) {
      const usedBytes = data[rid].usedBytes
      const usedMB = usedBytes / (1024 * 1024)
      result[rid] = {
        usedMB: parseFloat(usedMB.toFixed(2)),
        fileCount: data[rid].fileCount,
        usedPct: parseFloat(((usedBytes / FREE_LIMIT_BYTES) * 100).toFixed(2))
      }
    }
    return result
  } catch (err) {
    console.error('[getStorageStatsByRestaurant] Error:', err)
    return {}
  }
}

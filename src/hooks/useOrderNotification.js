// src/hooks/useOrderNotification.js
// Plays a notification sound when new orders arrive.
// Uses Web Audio API — no external sound files needed.

import { useRef, useEffect, useState } from 'react'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    // Tone 1: D5
    const o1 = ctx.createOscillator(), g1 = ctx.createGain()
    o1.type = 'sine'; o1.frequency.value = 587
    g1.gain.setValueAtTime(0.25, now)
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
    o1.connect(g1).connect(ctx.destination)
    o1.start(now); o1.stop(now + 0.25)
    // Tone 2: A5 (delayed)
    const o2 = ctx.createOscillator(), g2 = ctx.createGain()
    o2.type = 'sine'; o2.frequency.value = 880
    g2.gain.setValueAtTime(0.25, now + 0.12)
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
    o2.connect(g2).connect(ctx.destination)
    o2.start(now + 0.12); o2.stop(now + 0.4)
    setTimeout(() => ctx.close(), 600)
  } catch { /* silent fail */ }
}

/**
 * Watches orders array length. When it increases → plays sound + returns toast message.
 * Usage: const { toast } = useOrderNotification(orders)
 */
export function useOrderNotification(orders) {
  const prevCount = useRef(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (prevCount.current === null) {
      prevCount.current = orders.length
      return
    }
    const diff = orders.length - prevCount.current
    if (diff > 0) {
      playBeep()
      const msg = diff === 1 ? '🔔 New order received!' : `🔔 ${diff} new orders!`
      setToast(msg)
      const t = setTimeout(() => setToast(''), 4000)
      prevCount.current = orders.length
      return () => clearTimeout(t)
    }
    prevCount.current = orders.length
  }, [orders.length])

  return { toast }
}

// src/utils/helpers.js — shared utility functions

// ── Currency: Indian Rupees ───────────────────────────────────────────────────
// All prices displayed as ₹ throughout the app
export const fmt = (n) => `₹${Number(n).toFixed(2)}`

// ── Timestamp helpers ─────────────────────────────────────────────────────────
// Works with both Firestore Timestamps and plain JS Date objects / ISO strings
function toDate(ts) {
  if (!ts) return null
  if (ts instanceof Date) return ts
  if (typeof ts.toDate === 'function') return ts.toDate()  // Firestore compat shim
  return new Date(ts)
}

export function fmtTime(ts) {
  const d = toDate(ts)
  if (!d) return '—'
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function fmtDate(ts) {
  const d = toDate(ts)
  if (!d) return '—'
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtDateTime(ts) {
  return `${fmtDate(ts)}, ${fmtTime(ts)}`
}

// Time elapsed: "3m ago"
export function timeAgo(ts) {
  const d = toDate(ts)
  if (!d) return ''
  const sec = Math.floor((Date.now() - d.getTime()) / 1000)
  if (sec < 60)   return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  return `${Math.floor(sec / 3600)}h ago`
}

// ── Status badge metadata ─────────────────────────────────────────────────────
export const STATUS = {
  pending:   { label: 'Pending',   cls: 'badge-pending',   dot: 'bg-pending'   },
  preparing: { label: 'Preparing', cls: 'badge-preparing', dot: 'bg-preparing' },
  done:      { label: 'Done',      cls: 'badge-done',      dot: 'bg-done'      },
}

// ── Order totals ──────────────────────────────────────────────────────────────
export function calcTotals(cart, taxPct) {
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const tax      = subtotal * (taxPct / 100)
  const total    = subtotal + tax
  return { subtotal, tax, total }
}

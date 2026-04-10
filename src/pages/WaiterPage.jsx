// src/pages/WaiterPage.jsx
// Real-time waiter dashboard — see orders, update status
// UPDATED: Auth + restaurant_id scoping

import { useMemo, useState, useEffect } from 'react'
import { useAuth }         from '../contexts/AuthContext'
import { useOrders }       from '../hooks/useOrders'
import { useOrderNotification } from '../hooks/useOrderNotification'
import OrderCard           from '../components/OrderCard'
import EditOrderModal      from '../components/EditOrderModal'
import Spinner             from '../components/Spinner'

import { useParams, useNavigate } from 'react-router-dom'
import { fetchRestaurantBySlug } from '../services/restaurantService'
import Footer from '../components/Footer'

const FILTERS = ['All', 'Pending', 'Preparing', 'Done']

// ── Impersonation Banner ──────────────────────────────────────────────────────
function ImpersonationBanner({ onExit }) {
  return (
    <div className="bg-amber/20 border-b border-amber/40 px-4 py-2.5
                    flex items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <div>
          <p className="text-amber text-sm font-body font-semibold">
            Administrative Session
          </p>
          <p className="text-amber/70 text-[10px] uppercase font-bold tracking-wider">
            Verified Impersonation Active
          </p>
        </div>
      </div>
      <button
        onClick={onExit}
        className="px-4 py-1.5 rounded-lg text-xs font-body font-semibold
                   bg-base/30 border border-amber/40 text-amber
                   hover:bg-base/50 transition-all"
      >
        ← Exit Impersonation
      </button>
    </div>
  )
}

export default function WaiterPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const { 
    user, role, restaurantId, isImpersonating, 
    stopImpersonation, signOut, loading: authLoading 
  } = useAuth()

  const { orders, loading, updateStatus, updateItems } = useOrders(restaurantId)
  const [filter, setFilter] = useState('All')
  const [editingOrder, setEditingOrder] = useState(null)
  const [slugResolving, setSlugResolving] = useState(false)
  const [restaurantDisabled, setRestaurantDisabled] = useState(false)
  const [restaurantName, setRestaurantName] = useState('')
  const { toast } = useOrderNotification(orders)

  const handleExitImpersonation = async () => {
    await stopImpersonation()
  }

  // Check restaurant is_active for waiter/admin
  useEffect(() => {
    if (!slug) return

    // If super admin is here without backup, redirect
    if (role === 'super_admin' && !isImpersonating && !authLoading) {
      navigate('/superadmin')
      return
    }

    if (role !== 'super_admin') {
      fetchRestaurantBySlug(slug).then(r => {
        if (r && r.is_active === false) {
          setRestaurantDisabled(true)
          setRestaurantName(r.name)
        }
      }).catch(() => {})
    }
  }, [role, slug, isImpersonating, authLoading, navigate])

  // Sort: pending first → preparing → done
  const sorted = useMemo(() => {
    const order = { pending: 0, preparing: 1, done: 2 }
    return [...orders].sort((a, b) => {
      const statusDiff = (order[a.status] ?? 3) - (order[b.status] ?? 3)
      if (statusDiff !== 0) return statusDiff
      const aT = a.createdAt?.getTime?.() ?? 0
      const bT = b.createdAt?.getTime?.() ?? 0
      return bT - aT
    })
  }, [orders])

  const filtered = filter === 'All'
    ? sorted
    : sorted.filter(o => o.status === filter.toLowerCase())

  const counts = {
    pending:   orders.filter(o => o.status === 'pending').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    done:      orders.filter(o => o.status === 'done').length,
  }

  // Auth loading & Redirection
  useEffect(() => {
    if (!authLoading && !user) navigate('/login/waiter')
  }, [user, authLoading, navigate])

  if (authLoading || !user) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-emerald border-t-transparent animate-spin" />
    </div>
  )

  // Restaurant disabled by Super Admin
  if (restaurantDisabled) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-6">
        <div className="text-center space-y-4 max-w-sm animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-danger/10 border-2 border-danger/30
                          flex items-center justify-center text-4xl mx-auto">
            🔒
          </div>
          <h1 className="font-display text-bright text-2xl">Restaurant Disabled</h1>
          <p className="text-mid text-sm font-body leading-relaxed">
            <strong className="text-bright">{restaurantName || 'This restaurant'}</strong> has been
            temporarily disabled by the administrator. Waiter operations are paused.
          </p>
          <button onClick={signOut} className="btn-ghost">Sign Out</button>
        </div>
      </div>
    )
  }

  // Super Admins MUST have an active session backup to view dashboards
  if (role === 'super_admin' && !isImpersonating) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center px-4 space-y-4">
        <p className="text-5xl">🏢</p>
        <p className="text-bright font-body text-center max-w-sm">
          Please select a specific restaurant from your control panel to manage its live Waiter Board.
        </p>
        <button onClick={() => navigate('/superadmin')} className="btn-amber">
          Go To Super Admin Panel
        </button>
      </div>
    )
  }

  // Only waiter, admin, or super_admin can access
  if (!['waiter', 'admin', 'super_admin'].includes(role)) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-4xl">🔒</p>
          <p className="text-bright font-body">You don't have waiter access.</p>
          <button onClick={signOut} className="btn-ghost">Sign Out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Impersonation banner */}
      {isImpersonating && (
        <ImpersonationBanner
          onExit={handleExitImpersonation}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display italic text-amber text-xl">Waiter Dashboard</h1>
            <p className="text-faint text-xs font-body">
              Live orders {isImpersonating ? ` · (Verified Session)` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isImpersonating ? (
              <button 
                onClick={handleExitImpersonation} 
                className="btn-amber text-xs py-1.5 px-3 shadow-amber"
              >
                ← Return to Super Admin
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full
                                bg-done/10 border border-done/30">
                  <span className="w-2 h-2 rounded-full bg-done animate-pulse-dot" />
                  <span className="text-done text-xs font-semibold">Live</span>
                </div>
                <button onClick={signOut} className="btn-ghost text-xs py-1.5 px-3">
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Notification toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-5 py-3 bg-card border border-amber/30
                        rounded-xl text-bright text-sm font-body shadow-lifted animate-slide-up">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Stats strip ──────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Pending',   count: counts.pending,   color: 'text-pending',   bg: 'bg-pending/10   border-pending/25'   },
            { label: 'Preparing', count: counts.preparing, color: 'text-preparing', bg: 'bg-preparing/10 border-preparing/25' },
            { label: 'Done',      count: counts.done,      color: 'text-done',      bg: 'bg-done/10      border-done/25'      },
          ].map(s => (
            <div key={s.label} className={`card p-4 text-center border ${s.bg}`}>
              <p className={`font-display font-bold text-3xl ${s.color}`}>{s.count}</p>
              <p className="text-mid text-xs font-body mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Filter tabs ──────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-body font-semibold
                         border transition-all duration-200
                         ${filter === f
                           ? 'bg-amber text-base border-amber'
                           : 'border-border text-mid hover:border-amber/40 hover:text-bright'
                         }`}
            >
              {f}
              {f !== 'All' && (
                <span className="ml-2 text-xs opacity-70">
                  {counts[f.toLowerCase()] ?? 0}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Orders ───────────────────────────────────────────────── */}
        {loading ? (
          <Spinner text="Loading orders…" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-2">
            <p className="text-5xl">🎉</p>
            <p className="text-mid font-body">
              {filter === 'All' ? 'No orders yet.' : `No ${filter.toLowerCase()} orders.`}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(order => (
              <div key={order.id} className="animate-fade-in">
                <OrderCard
                  order={order}
                  onUpdateStatus={updateStatus}
                  onEdit={setEditingOrder}
                />
              </div>
            ))}
          </div>
        )}

        <Footer />
      </div>

      {/* Edit order modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          onSave={updateItems}
          onClose={() => setEditingOrder(null)}
        />
      )}
    </div>
  )
}

// src/pages/admin/AdminPage.jsx
// Auth wrapper + tabbed admin layout
// UPDATED: Role-based auth, impersonation banner, waiter management tab

import { useState, useEffect } from 'react'
import { supabase }      from '../../supabase/client'
import { useAuth }       from '../../contexts/AuthContext'
import { useKeepAlive }  from '../../hooks/useKeepAlive'
import MenuManager       from './MenuManager'
import OrdersManager     from './OrdersManager'
import Analytics         from './Analytics'
import Settings          from './Settings'
import WaiterManager     from './WaiterManager'
import Spinner           from '../../components/Spinner'
import WakeUp            from '../../components/WakeUp'
import Footer            from '../../components/Footer'

const TABS = [
  { id: 'menu',      label: '🍽️ Menu',      component: MenuManager   },
  { id: 'orders',    label: '📋 Orders',     component: OrdersManager },
  { id: 'analytics', label: '📊 Analytics',  component: Analytics     },
  { id: 'waiters',   label: '👤 Waiters',    component: WaiterManager },
  { id: 'settings',  label: '⚙️ Settings',   component: Settings      },
]


import { useParams, useNavigate } from 'react-router-dom'
import { fetchRestaurantBySlug, fetchRestaurants } from '../../services/restaurantService'

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

// ── Main AdminPage ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { slug } = useParams()
  const navigate = useNavigate()

  const {
    user, role, restaurantId, isImpersonating,
    stopImpersonation, signOut, loading: authLoading,
  } = useAuth()

  const [tab, setTab] = useState('menu')
  const [slugResolving, setSlugResolving] = useState(false)
  const { isWakingUp, retryNow } = useKeepAlive()

  const handleExitImpersonation = async () => {
    await stopImpersonation()
  }

  // Auto-redirect if Super Admin is here without a session backup (they should be in /superadmin)
  useEffect(() => {
    if (role === 'super_admin' && !isImpersonating && !authLoading) {
      navigate('/superadmin')
    }
  }, [role, isImpersonating, authLoading, navigate])

  // Auto-resolve slug if accessed via global /admin
  useEffect(() => {
    if (!slug && restaurantId && role === 'admin') {
      setSlugResolving(true)
      fetchRestaurants().then(all => {
        const mine = all.find(r => r.id === restaurantId)
        if (mine) navigate(`/${mine.slug}/admin`, { replace: true })
        setSlugResolving(false)
      }).catch(() => setSlugResolving(false))
    }
  }, [slug, restaurantId, role, navigate])

  // Auth loading & Redirection
  useEffect(() => {
    if (!authLoading && !user) navigate('/login/admin')
  }, [user, authLoading, navigate])

  if (authLoading || slugResolving || !user) return (
    <div className="min-h-screen bg-base flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-amber border-t-transparent animate-spin" />
    </div>
  )

  // Super Admins MUST have an active scope to view the dash (no global unstructured views)
  if (role === 'super_admin' && !isImpersonating) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center px-4 space-y-4">
        <p className="text-5xl">🏢</p>
        <p className="text-bright font-body text-center max-w-sm">
          Please select a specific restaurant from your control panel to manage it.
        </p>
        <button onClick={() => navigate('/superadmin')} className="btn-amber">
          Go To Super Admin Panel
        </button>
      </div>
    )
  }

  // Only admin (or super_admin impersonating) can access
  if (role !== 'admin' && role !== 'super_admin') {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-4xl">🔒</p>
          <p className="text-bright font-body">You don't have admin access.</p>
          <button onClick={signOut} className="btn-ghost">Sign Out</button>
        </div>
      </div>
    )
  }

  const ActiveTab = TABS.find(t => t.id === tab)?.component ?? MenuManager

  return (
    <div className="min-h-screen bg-base">
      {isWakingUp && <WakeUp onRetry={retryNow} />}

      {/* Impersonation banner */}
      {isImpersonating && (
        <ImpersonationBanner
          onExit={handleExitImpersonation}
        />
      )}

      {/* ── Topbar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-display italic text-amber text-xl">TableServe</span>
            <span className="hidden sm:block text-border text-lg">|</span>
            <span className="hidden sm:block text-faint text-xs font-body">
              Admin{isImpersonating ? ` · (Verified Session)` : ''}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-faint text-xs font-body truncate max-w-[160px]">
              {user.email}
            </span>
            {isImpersonating ? (
              <button
                onClick={handleExitImpersonation}
                className="btn-amber text-xs py-1.5 px-3 shadow-amber"
              >
                ← Return to Super Admin
              </button>
            ) : (
              <button
                onClick={signOut}
                className="btn-ghost text-xs py-1.5 px-3"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Tab nav ──────────────────────────────────────────────────── */}
      <div className="border-b border-border bg-surface">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-0 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-shrink-0 px-4 py-3.5 text-sm font-body font-semibold
                           border-b-2 transition-all duration-200 whitespace-nowrap
                           ${tab === t.id
                             ? 'border-amber text-amber'
                             : 'border-transparent text-mid hover:text-bright hover:border-border'
                           }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        <ActiveTab restaurantId={restaurantId} />
        
        <Footer />
      </main>
    </div>
  )
}

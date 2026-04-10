// src/pages/LoginPage.jsx
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase/client'
import { useAuth } from '../contexts/AuthContext'
import { MiniSpinner } from '../components/Spinner'
import { getRestaurantById } from '../services/restaurantService'

function useLoginContext(roleParam) {
  const role = roleParam?.toLowerCase()

  if (role === 'superadmin') {
    return {
      role: 'super_admin',
      icon: '🛡️',
      title: 'Command Center',
      subtitle: 'Super Admin Access',
      accent: '#8b5cf6',
      accentLight: 'rgba(139, 92, 246, 0.1)',
      accentBorder: 'rgba(139, 92, 246, 0.3)',
      placeholder: 'superadmin@tableserve.com',
      footerText: 'Platform-level management console',
      showForgotPassword: true,
    }
  }

  if (role === 'waiter') {
    return {
      role: 'waiter',
      icon: '👨‍🍳',
      title: 'Waiter Dashboard',
      subtitle: 'Staff Access',
      accent: '#10b981',
      accentLight: 'rgba(16, 185, 129, 0.1)',
      accentBorder: 'rgba(16, 185, 129, 0.3)',
      placeholder: 'waiter@restaurant.com',
      footerText: 'Contact your admin for login credentials',
      showForgotPassword: false,
    }
  }

  return {
    role: 'admin',
    icon: '⚙️',
    title: 'Admin Panel',
    subtitle: 'Restaurant Management',
    accent: '#f59e0b',
    accentLight: 'rgba(245, 158, 11, 0.1)',
    accentBorder: 'rgba(245, 158, 11, 0.3)',
    placeholder: 'admin@yourrestaurant.com',
    footerText: 'Manage your restaurant menu, orders & settings',
    showForgotPassword: true,
  }
}

export default function LoginPage() {
  const { role: roleParam } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const ctx = useLoginContext(roleParam)
  
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent]   = useState(false)

  // ── Auth Listeners ───────────────────────────────────────────
  useEffect(() => {
    // Catch recovery/invite links and redirect to the setup page
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password')
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  // Redirection logic AFTER successful login
  useEffect(() => {
    if (user) {
      const handleRedirect = async () => {
        const userRole = user.user_metadata?.role
        const restaurantId = user.user_metadata?.restaurant_id

        // 1. Role verification
        // Super admins can login from anywhere and will be redirected to their panel
        if (userRole !== 'super_admin' && userRole !== ctx.role) {
          setError(`❌ Access Denied: Your account does not have ${ctx.role} privileges.`)
          await signOut()
          return
        }

        // 2. Redirection based on role
        if (userRole === 'super_admin') {
          navigate('/superadmin')
        } else if (restaurantId) {
          try {
            const restaurant = await getRestaurantById(restaurantId)
            if (restaurant?.slug) {
              navigate(`/${restaurant.slug}/${userRole === 'admin' ? 'admin' : 'waiter'}`)
            } else {
              setError('❌ Restaurant configuration not found.')
              await signOut()
            }
          } catch (err) {
            setError('❌ Failed to resolve restaurant details.')
            await signOut()
          }
        }
      }
      handleRedirect()
    }
  }, [user, ctx.role, navigate, signOut])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
      if (authErr) throw authErr
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex items-center justify-center px-4 relative overflow-hidden font-body">
       {/* Background decoration */}
       <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-[600px] h-[600px] rounded-full blur-[120px] opacity-30"
             style={{ background: `radial-gradient(circle, ${ctx.accent}33 0%, transparent 70%)`, top: '-200px', right: '-100px' }} />
        <div className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-20"
             style={{ background: `radial-gradient(circle, ${ctx.accent}22 0%, transparent 70%)`, bottom: '-150px', left: '-100px' }} />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="flex justify-center mb-6 animate-scale-in">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl border-2 shadow-2xl"
               style={{ background: ctx.accentLight, borderColor: ctx.accentBorder }}>
            {ctx.icon}
          </div>
        </div>

        <div className="text-center mb-6 animate-scale-in">
          <h1 className="font-display italic text-4xl mb-1" style={{ color: ctx.accent }}>TableServe</h1>
          <p className="text-bright text-lg font-semibold">{ctx.title}</p>
          <p className="text-mid text-xs mt-1">{ctx.subtitle}</p>
        </div>

        <div className="rounded-2xl border shadow-2xl p-8 space-y-6 animate-scale-in bg-surface/80 backdrop-blur-xl"
             style={{ borderColor: `${ctx.accent}15` }}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-mid text-xs font-semibold uppercase tracking-wider mb-2">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                     placeholder={ctx.placeholder} className="input" required />
            </div>
            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-mid text-xs font-semibold uppercase tracking-wider">Password</label>
              </div>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                       placeholder="••••••••" className="input pr-12" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-bright transition-colors">
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-3 bg-danger/10 border border-danger/25 rounded-xl text-danger text-sm animate-shake">
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: ctx.accent, color: '#000' }}>
              {loading ? <MiniSpinner /> : 'Sign In'}
            </button>
          </form>
          
          <button onClick={() => navigate('/')} className="w-full text-faint text-[10px] uppercase font-bold tracking-widest hover:text-bright transition-colors">
            ← Exit Portal
          </button>
        </div>

        <div className="text-center mt-6">
          <p className="text-faint text-xs">{ctx.footerText}</p>
        </div>
      </div>
    </div>
  )
}

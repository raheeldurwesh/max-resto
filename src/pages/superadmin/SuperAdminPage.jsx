// src/pages/superadmin/SuperAdminPage.jsx
// Super Admin control panel — organized by restaurant with expandable details

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth }     from '../../contexts/AuthContext'
import Spinner, { MiniSpinner } from '../../components/Spinner'
import {
  fetchRestaurants, createRestaurant, createUser,
  getRestaurantUsers, resetUserPassword, toggleUserStatus,
  forceLogout, deleteUser, deleteRestaurant, toggleRestaurantStatus,
  subscribeToRestaurants, subscribeToProfiles, isSlugAvailable, isEmailAvailable,
  getImpersonationLink,
} from '../../services/restaurantService'
import { getStorageStatsByRestaurant } from '../../services/storageService'
import { saveConfig } from '../../services/configService'
import { useConfig } from '../../hooks/useConfig'
import Footer from '../../components/Footer'

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-card border border-border
                    rounded-xl text-bright text-sm font-body shadow-lifted animate-slide-up">
      {msg}
    </div>
  )
}

// ── Real-time Indicator for Email availability ───────────────────────────────
function EmailCheckIndicator({ email }) {
  const [status, setStatus] = useState('idle') // idle | checking | available | taken

  useEffect(() => {
    if (!email || !email.includes('@')) { setStatus('idle'); return }
    setStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const available = await isEmailAvailable(email)
        setStatus(available ? 'available' : 'taken')
      } catch {
        setStatus('idle')
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [email])

  if (status === 'checking') return <MiniSpinner />
  if (status === 'available') return <span className="text-done text-xs animate-scale-in">✅</span>
  if (status === 'taken') return <span className="text-danger text-xs animate-scale-in" title="Email already in use">❌</span>
  return null
}

// ── User Row inside a restaurant dropdown ──────────────────────────────────────
function UserRow({ u, showToast, onReload }) {
  const [resetMode, setResetMode] = useState(false)
  const [newPass, setNewPass]     = useState('')
  const [resetting, setResetting] = useState(false)

  const handleResetPassword = async () => {
    if (!newPass || newPass.length < 6) {
      showToast('❌ Password must be at least 6 characters')
      return
    }
    setResetting(true)
    try {
      await resetUserPassword(u.user_id, newPass)
      showToast('✓ Password reset successfully')
      setResetMode(false)
      setNewPass('')
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  const handleToggle = async () => {
    try {
      await toggleUserStatus(u.user_id, !u.banned)
      showToast(u.banned ? '✓ User enabled' : '✓ User disabled & logged out')
      onReload()
    } catch (err) {
      showToast('❌ ' + err.message)
    }
  }

  const handleForceLogout = async () => {
    try {
      const count = await forceLogout({ userId: u.user_id })
      showToast(`✓ Logged out ${u.email} (${count} session(s))`)
    } catch (err) {
      showToast('❌ ' + err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete user "${u.email}"? This cannot be undone.`)) return
    try {
      await deleteUser(u.user_id)
      showToast(`✓ User ${u.email} deleted`)
      onReload()
    } catch (err) {
      showToast('❌ ' + err.message)
    }
  }

  const roleColor = u.role === 'admin' ? 'text-amber' : 'text-done'
  const roleBg = u.role === 'admin'
    ? 'bg-amber/10 border-amber/25 text-amber'
    : 'bg-done/10 border-done/25 text-done'

  return (
    <div className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl
                    bg-raised/50 border border-border/50 flex-wrap">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center
                         text-xs font-bold flex-shrink-0 border ${roleBg}`}>
          {u.email?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="min-w-0">
          <p className="text-bright text-xs font-body font-semibold truncate">{u.email}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-semibold uppercase ${roleColor}`}>{u.role}</span>
            {u.banned && (
              <span className="text-danger text-[10px] font-semibold">• Disabled</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {resetMode ? (
          <div className="flex gap-1.5 items-center">
            <input
              type="password" value={newPass}
              onChange={e => setNewPass(e.target.value)}
              placeholder="New password" className="input text-[11px] py-1 w-28"
              minLength={6}
            />
            <button onClick={handleResetPassword} disabled={resetting}
                    className="btn-amber text-[11px] py-1 px-2.5">
              {resetting ? <MiniSpinner /> : '✓'}
            </button>
            <button onClick={() => { setResetMode(false); setNewPass('') }}
                    className="btn-ghost text-[11px] py-1 px-1.5">✕</button>
          </div>
        ) : (
          <button onClick={() => setResetMode(true)}
                  className="btn-ghost text-[11px] py-1 px-2.5" title="Reset password">
            🔑
          </button>
        )}

        <button
          onClick={handleToggle}
          className={`text-[11px] py-1 px-2.5 rounded-lg font-body font-semibold border transition-all
                      ${u.banned
                        ? 'bg-done/10 border-done/30 text-done hover:bg-done/20'
                        : 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20'
                      }`}
          title={u.banned ? 'Enable user' : 'Disable user'}
        >
          {u.banned ? '✓ Enable' : '🚫 Disable'}
        </button>

        <button onClick={handleForceLogout}
                className="btn-ghost text-[11px] py-1 px-2.5" title="Force logout">
          🔓
        </button>

        <button onClick={handleDelete}
                className="btn-danger text-[11px] py-1 px-2.5" title="Delete user">
          🗑️
        </button>
      </div>
    </div>
  )
}

// ── Expandable Restaurant Card ────────────────────────────────────────────────
function RestaurantCard({ restaurant, showToast, onImpersonate, onReloadAll, storageStats }) {
  const r = restaurant
  const [expanded, setExpanded]   = useState(false)
  const [users, setUsers]         = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [toggling, setToggling]   = useState(false)
  const isActive = r.is_active !== false // default true if column doesn't exist yet
  
  // Configuration editing state
  const [editingConfig, setEditingConfig] = useState(false)
  const [tempCategories, setTempCategories] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)

  // Fetch real-time config for this restaurant
  const { config, loading: configLoading } = useConfig(r.id)

  // Add user form state
  const [showAddUser, setShowAddUser] = useState(false)
  const [newEmail, setNewEmail]       = useState('')
  const [newPass, setNewPass]         = useState('')
  const [newRole, setNewRole]         = useState('admin') // or 'waiter'
  const [addingUser, setAddingUser]   = useState(false)

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    try {
      const data = await getRestaurantUsers(r.id)
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users for', r.name, err)
    } finally {
      setLoadingUsers(false)
    }
  }, [r.id, r.name])

  useEffect(() => {
    if (expanded && users.length === 0) loadUsers()
  }, [expanded, loadUsers, users.length])

  const admins  = users.filter(u => u.role === 'admin')
  const waiters = users.filter(u => u.role === 'waiter')

  const handleToggleActive = async () => {
    setToggling(true)
    try {
      await toggleRestaurantStatus(r.id, !isActive)
      showToast(isActive
        ? `✓ "${r.name}" disabled — customer & waiter pages blocked`
        : `✓ "${r.name}" enabled — customer & waiter pages restored`)
      onReloadAll()
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`⚠️ Delete restaurant "${r.name}"?\n\nThis will permanently remove ALL data: menu items, orders, users, and settings. This cannot be undone.`)) return
    try {
      await deleteRestaurant(r.id)
      showToast(`✓ Restaurant "${r.name}" and all its data deleted`)
      onReloadAll()
    } catch (err) { showToast('❌ ' + err.message) }
  }

  const handleForceLogoutAll = async () => {
    try {
      const count = await forceLogout({ restaurantId: r.id })
      showToast(`✓ Logged out ${count} session(s) from ${r.name}`)
    } catch (err) { showToast('❌ ' + err.message) }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const customerUrl = `${baseUrl}/${r.slug}?table=1`
  const waiterUrl = `${baseUrl}/${r.slug}/waiter`
  const adminUrl = `${baseUrl}/${r.slug}/admin`

  return (
    <div className={`card overflow-hidden transition-all duration-300
                     ${!isActive ? 'opacity-60 border-danger/30' : ''}`}>
      {/* ── Header bar (always visible) ───────────────────────── */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between gap-3 p-4 cursor-pointer
                   hover:bg-raised/50 transition-colors duration-200"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg
                           flex-shrink-0 border
                           ${isActive
                             ? 'bg-amber/10 border-amber/25'
                             : 'bg-danger/10 border-danger/25'}`}>
            {isActive ? '🏪' : '🔒'}
          </div>
          <div className="min-w-0">
            <h3 className="text-bright font-body font-semibold text-base truncate">
              {r.name}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-faint text-xs font-body">/{r.slug}</span>
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full
                                ${isActive
                                  ? 'bg-done/15 text-done'
                                  : 'bg-danger/15 text-danger'}`}>
                {isActive ? 'Active' : 'Disabled'}
              </span>
              
              {/* Restaurant specific storage stat */}
              {storageStats && (
                <div className="flex items-center gap-2 ml-1">
                  <div className="w-12 h-1 bg-raised rounded-full overflow-hidden border border-border/30">
                    <div 
                      className={`h-full ${storageStats.usedMB > 9 ? 'bg-danger' : storageStats.usedMB > 5 ? 'bg-amber' : 'bg-done'}`}
                      style={{ width: `${Math.min(storageStats.usedMB * 10, 100)}%` }} // Relative to 10MB soft target for dot
                    />
                  </div>
                  <span className="text-faint text-[9px] font-body">{storageStats.usedMB} MB</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick action buttons (visible even when collapsed) */}
          <button
            onClick={(e) => { e.stopPropagation(); handleToggleActive() }}
            disabled={toggling}
            className={`text-xs py-1.5 px-3 rounded-xl font-body font-semibold border transition-all
                        ${isActive
                          ? 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20'
                          : 'bg-done/10 border-done/30 text-done hover:bg-done/20'}`}
            title={isActive ? 'Disable restaurant' : 'Enable restaurant'}
          >
            {toggling ? <MiniSpinner /> : isActive ? '🚫 Disable' : '✓ Enable'}
          </button>

          {/* Expand chevron */}
          <span className={`text-mid text-sm transition-transform duration-300
                           ${expanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </div>

      {/* ── Expanded content ──────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border px-4 pb-4 space-y-4 animate-fade-in">

          {/* ── Quick Actions ──────────────────────────────────── */}
          <div className="flex gap-2 flex-wrap pt-3">
            <button
              onClick={() => onImpersonate(r)}
              className="btn-amber text-xs py-2 px-4"
            >
              👤 Login as Admin
            </button>
            <button
              onClick={handleForceLogoutAll}
              className="btn-ghost text-xs py-2 px-3"
              title="Force logout all users"
            >
              🔓 Logout All
            </button>
            <button
              onClick={handleDelete}
              className="btn-danger text-xs py-2 px-3"
              title="Delete restaurant and all data"
            >
              🗑️ Delete
            </button>
          </div>

          {/* ── Configuration Preview ──────────────────────────── */}
          <div className="bg-amber/5 rounded-xl p-3 border border-amber/20">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] uppercase font-bold text-amber flex items-center gap-1.5">
                ⚙️ Configuration
              </h4>
              <div className="flex items-center gap-2">
                {!editingConfig ? (
                  <button 
                    onClick={() => {
                      setTempCategories(config.categories || '')
                      setEditingConfig(true)
                    }}
                    className="text-[9px] text-amber hover:text-bright font-bold uppercase tracking-wider"
                  >
                    Edit
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={async () => {
                        setSavingConfig(true)
                        try {
                          await saveConfig({ categories: tempCategories }, r.id)
                          setEditingConfig(false)
                        } catch (err) {
                          showToast('❌ Failed to update: ' + err.message)
                        } finally {
                          setSavingConfig(false)
                        }
                      }}
                      disabled={savingConfig}
                      className="text-[9px] text-done hover:text-bright font-bold uppercase tracking-wider"
                    >
                      {savingConfig ? 'Saving...' : 'Save'}
                    </button>
                    <button 
                      onClick={() => setEditingConfig(false)}
                      disabled={savingConfig}
                      className="text-[9px] text-danger hover:text-bright font-bold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <span className="text-[9px] text-amber/60 font-medium font-body bg-amber/10 px-1.5 py-0.5 rounded">
                  Live
                </span>
              </div>
            </div>
            {configLoading ? (
              <div className="py-2 flex items-center gap-2">
                <MiniSpinner /> <span className="text-faint text-[10px]">Syncing settings...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div>
                  <p className="text-amber/70 text-[9px] uppercase tracking-wider font-semibold">Categories</p>
                  {editingConfig ? (
                    <textarea
                      value={tempCategories}
                      onChange={(e) => setTempCategories(e.target.value)}
                      placeholder="Pizza, Burger, etc."
                      className="input text-xs py-1.5 mt-1 bg-black/20 border-amber/20 focus:border-amber/50 min-h-[60px]"
                    />
                  ) : (
                    <p className="text-bright text-xs font-medium leading-relaxed">
                      {config.categories || 'Using defaults'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-mid text-xs font-semibold uppercase tracking-wider">Pages</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <a href={customerUrl} target="_blank" rel="noopener noreferrer"
                 className="flex items-center gap-2 px-3 py-2.5 rounded-xl
                            bg-raised border border-border text-xs font-body
                            hover:border-amber/40 hover:text-bright transition-all">
                <span className="text-base">🍽️</span>
                <div className="min-w-0">
                  <p className="text-bright font-semibold">Customer Menu</p>
                  <p className="text-faint text-[10px] truncate">/{r.slug}?table=1</p>
                </div>
              </a>
              <button 
                 onClick={() => onImpersonate(r, 'waiter')}
                 className="flex items-center text-left gap-2 px-3 py-2.5 rounded-xl
                            bg-raised border border-border text-xs font-body
                            hover:border-amber/40 hover:text-bright transition-all">
                <span className="text-base">👨‍🍳</span>
                <div className="min-w-0">
                  <p className="text-bright font-semibold">Waiter Dashboard</p>
                  <p className="text-faint text-[10px] truncate">Live View</p>
                </div>
              </button>
              <button 
                 onClick={() => onImpersonate(r, 'admin')}
                 className="flex items-center text-left gap-2 px-3 py-2.5 rounded-xl
                            bg-raised border border-border text-xs font-body
                            hover:border-amber/40 hover:text-bright transition-all">
                <span className="text-base">⚙️</span>
                <div className="min-w-0">
                  <p className="text-bright font-semibold">Admin Panel</p>
                  <p className="text-faint text-[10px] truncate">Settings View</p>
                </div>
              </button>
            </div>
          </div>

          {/* ── Users ──────────────────────────────────────────── */}
          {loadingUsers ? (
            <div className="py-4 flex justify-center">
              <MiniSpinner /> <span className="text-mid text-xs ml-2">Loading users…</span>
            </div>
          ) : (
            <>
              {/* Users List */}
              <div className="space-y-4">
                {/* Admins */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-amber text-xs font-semibold uppercase tracking-wider">Admins</span>
                      <span className="text-faint text-[10px]">({admins.length})</span>
                    </div>
                    {!showAddUser && (
                      <button onClick={() => { setShowAddUser(true); setNewRole('admin') }}
                              className="text-[10px] text-amber hover:text-bright font-bold uppercase tracking-wider">
                        + Add Admin
                      </button>
                    )}
                  </div>
                  {admins.length === 0 ? (
                    <p className="text-faint text-xs pl-2">No admin users</p>
                  ) : (
                    <div className="grid gap-1.5">
                      {admins.map(u => (
                        <UserRow key={u.user_id} u={u} showToast={showToast} onReload={loadUsers} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Waiters */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-done text-xs font-semibold uppercase tracking-wider">Waiters</span>
                      <span className="text-faint text-[10px]">({waiters.length})</span>
                    </div>
                    {!showAddUser && (
                      <button onClick={() => { setShowAddUser(true); setNewRole('waiter') }}
                              className="text-[10px] text-done hover:text-bright font-bold uppercase tracking-wider">
                        + Add Waiter
                      </button>
                    )}
                  </div>
                  {waiters.length === 0 ? (
                    <p className="text-faint text-xs pl-2">No waiter users</p>
                  ) : (
                    <div className="grid gap-1.5">
                      {waiters.map(u => (
                        <UserRow key={u.user_id} u={u} showToast={showToast} onReload={loadUsers} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Add User Inline Form */}
                {showAddUser && (
                  <div className="bg-raised/80 rounded-xl p-4 border border-border/50 animate-slide-up space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-bright text-xs font-semibold uppercase tracking-wider">
                        Create New {newRole === 'admin' ? 'Admin' : 'Waiter'}
                      </h5>
                      <button onClick={() => setShowAddUser(false)} className="text-faint hover:text-bright">✕</button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="relative">
                        <input 
                          type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                          placeholder="Email address" className="input text-xs pr-8" required 
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                          {newEmail.includes('@') && <EmailCheckIndicator email={newEmail} />}
                        </div>
                      </div>
                      <input 
                        type="password" value={newPass} onChange={e => setNewPass(e.target.value)}
                        placeholder="Password (6+ chars)" className="input text-xs" minLength={6} required 
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        if (!newEmail || newPass.length < 6) return
                        setAddingUser(true)
                        try {
                          await createUser({
                            email: newEmail.trim(),
                            password: newPass.trim(),
                            role: newRole,
                            restaurantId: r.id
                          })
                          showToast(`✓ Created ${newRole} account for ${newEmail}`)
                          setNewEmail(''); setNewPass(''); setShowAddUser(false)
                          loadUsers()
                        } catch (err) {
                          showToast('❌ ' + err.message)
                        } finally {
                          setAddingUser(false)
                        }
                      }}
                      disabled={addingUser}
                      className={`w-full py-2 rounded-lg text-xs font-bold transition-all
                                 ${newRole === 'admin' ? 'btn-amber' : 'bg-done text-base hover:bg-done/90'}`}
                    >
                      {addingUser ? <><MiniSpinner /> Creating...</> : `+ Create ${newRole}`}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Create Restaurant Form ────────────────────────────────────────────────────
function CreateRestaurantForm({ showToast, onCreated }) {
  const [name, setName]           = useState('')
  const [slug, setSlug]           = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [categories, setCategories] = useState('Pizza, Burger, Pasta, Drinks, Desserts, Other')
  const [slugStatus, setSlugStatus] = useState('idle') // idle | checking | available | taken
  const [emailStatus, setEmailStatus] = useState('idle') // idle | checking | available | taken
  const [saving, setSaving]       = useState(false)

  // ── Debounced Slug Check ──────────────────────────────────────────
  useEffect(() => {
    if (!slug) { setSlugStatus('idle'); return }
    
    setSlugStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const available = await isSlugAvailable(slug)
        setSlugStatus(available ? 'available' : 'taken')
      } catch {
        setSlugStatus('idle')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [slug])

  // ── Debounced Email Check ──────────────────────────────────────────
  useEffect(() => {
    if (!adminEmail || !adminEmail.includes('@')) { setEmailStatus('idle'); return }
    
    setEmailStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const available = await isEmailAvailable(adminEmail)
        setEmailStatus(available ? 'available' : 'taken')
      } catch {
        setEmailStatus('idle')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [adminEmail])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name || !slug || !adminEmail || slugStatus === 'taken' || emailStatus === 'taken') return
    setSaving(true)
    try {
      const rest = await createRestaurant({ name: name.trim(), slug: slug.trim().toLowerCase() })
      
      // Initialize config with custom categories
      try {
        await saveConfig({ 
          restaurant_name: name.trim(),
          categories: categories.trim() || 'Pizza, Burger, Pasta, Drinks, Desserts, Other'
        }, rest.id)
      } catch (err) {
        console.warn('Config initialization failed:', err)
        showToast('⚠️ Restaurant created, but categories failed (Did you run the SQL migration?)')
      }

      // Create the Admin user directly with a manual password
      await createUser({
        email: adminEmail.trim(),
        password: adminPassword.trim(),
        role: 'admin',
        restaurantId: rest.id,
      })
      showToast(`✓ Restaurant "${rest.name}" created! Admin account ready for ${adminEmail}`)
      setName(''); setSlug(''); setAdminEmail(''); setAdminPassword('')
      setCategories('Pizza, Burger, Pasta, Drinks, Desserts, Other')
      onCreated()
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleCreate} className="card p-6 space-y-4">
      <h3 className="section-title text-base">🏪 Onboard New Restaurant</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Restaurant Name *</label>
          <input value={name} onChange={e => setName(e.target.value)}
                 placeholder="Bella Cucina" className="input" required />
        </div>
        <div>
          <label className="label">Slug (URL) *</label>
          <div className="relative">
            <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                   placeholder="bella-cucina" className={`input pr-10 ${
                     slugStatus === 'taken' ? 'border-danger/50 focus:border-danger' : 
                     slugStatus === 'available' ? 'border-done/50 focus:border-done' : ''
                   }`} required />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {slugStatus === 'checking' && <MiniSpinner />}
              {slugStatus === 'available' && <span className="text-done text-sm animate-scale-in">✅</span>}
              {slugStatus === 'taken' && <span className="text-danger text-sm animate-scale-in">❌</span>}
            </div>
          </div>
          <p className={`text-[10px] mt-1 font-medium transition-colors ${
            slugStatus === 'taken' ? 'text-danger' : 
            slugStatus === 'available' ? 'text-done' : 'text-faint'
          }`}>
            {slugStatus === 'taken' ? 'This URL is already taken' : 
             slugStatus === 'available' ? 'URL is available!' : 
             `URL: /${slug || 'slug'}?table=1`}
          </p>
        </div>
        <div>
          <label className="label">Admin Email *</label>
          <div className="relative">
            <input type="email" value={adminEmail} onChange={e => setAdminEmail(e.target.value)}
                   placeholder="admin@bellacucina.com" className={`input pr-10 ${
                     emailStatus === 'taken' ? 'border-danger/50 focus:border-danger' : 
                     emailStatus === 'available' ? 'border-done/50 focus:border-done' : ''
                   }`} required />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              {emailStatus === 'checking' && <MiniSpinner />}
              {emailStatus === 'available' && <span className="text-done text-sm animate-scale-in">✅</span>}
              {emailStatus === 'taken' && <span className="text-danger text-sm animate-scale-in">❌</span>}
            </div>
          </div>
          {emailStatus === 'taken' && (
            <p className="text-danger text-[10px] mt-1 font-medium">Email already in use</p>
          )}
        </div>
        <div>
          <label className="label">Initial Admin Password *</label>
          <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                 placeholder="6+ characters" className="input" minLength={6} required />
        </div>
      </div>

      <div>
        <label className="label">Menu Categories (Comma separated)</label>
        <textarea 
          value={categories} onChange={e => setCategories(e.target.value)}
          placeholder="Starters, Main Course, Drinks, Desserts..." 
          className="input min-h-[80px]" 
        />
        <p className="text-faint text-[10px] mt-1">
          These will be the available sections in the restaurant's menu.
        </p>
      </div>

      <button 
        type="submit" 
        disabled={saving || slugStatus !== 'available' || emailStatus !== 'available'} 
        className="btn-amber py-2.5 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? <><MiniSpinner /> Creating…</> : '🚀 Create Restaurant + Admin'}
      </button>
    </form>
  )
}

// ── Main SuperAdminPage ───────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const navigate = useNavigate()
  const {
    user, isSuperAdmin, signOut, loading: authLoading,
    startImpersonation,
  } = useAuth()

  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [toast, setToast]             = useState('')
  const [search, setSearch]           = useState('')
  const [storageStats, setStorageStats] = useState(null)
  const [loadingStorage, setLoadingStorage] = useState(false)
  const [swapping, setSwapping]       = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadRestaurants = useCallback(async () => {
    try {
      const data = await fetchRestaurants()
      setRestaurants(data)
    } catch (err) {
      console.error('Failed to load restaurants:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadStorage = useCallback(async () => {
    setLoadingStorage(true)
    try {
      const stats = await getStorageStatsByRestaurant()
      setStorageStats(stats)
    } catch (err) {
      console.error('Failed to load storage stats:', err)
    } finally {
      setLoadingStorage(false)
    }
  }, [])

  useEffect(() => { 
    loadRestaurants()
    loadStorage() 

    // ── Real-time: Restaurants ───────────────────────────────────────
    const unsubRest = subscribeToRestaurants((payload) => {
      if (payload.eventType === 'INSERT') {
        setRestaurants(prev => [payload.new, ...prev])
      } else if (payload.eventType === 'UPDATE') {
        setRestaurants(prev => prev.map(r => r.id === payload.new.id ? payload.new : r))
      } else if (payload.eventType === 'DELETE') {
        setRestaurants(prev => prev.filter(r => r.id === payload.old.id))
      }
    })

    // ── Real-time: Profiles (Optional, for instant user stats) ──────────
    const unsubProf = subscribeToProfiles(() => {
    })

    return () => {
      unsubRest()
      unsubProf()
    }
  }, [loadRestaurants, loadStorage])

  // Auth loading & Redirection
  useEffect(() => {
    if (!authLoading && !user) navigate('/login/superadmin')
  }, [user, authLoading, navigate])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-amber border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-4xl">🔒</p>
          <p className="text-bright font-body">Super Admin access only.</p>
          <button onClick={signOut} className="btn-ghost">Sign Out</button>
        </div>
      </div>
    )
  }

  const handleImpersonate = async (restaurant, targetPath = 'admin') => {
    setSwapping(true)
    try {
      await startImpersonation(restaurant, (id) => getImpersonationLink(id, targetPath))
    } catch (err) {
      showToast('❌ Impersonation failed: ' + err.message)
      setSwapping(false)
    }
  }

  const filtered = search.trim()
    ? restaurants.filter(r =>
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.slug.toLowerCase().includes(search.toLowerCase())
      )
    : restaurants

  const activeCount = restaurants.filter(r => r.is_active !== false).length
  const disabledCount = restaurants.length - activeCount

  return (
    <div className="min-h-screen bg-base">
      <Toast msg={toast} />

      {swapping && (
        <div className="fixed inset-0 z-[100] bg-base/90 backdrop-blur-md flex flex-col items-center justify-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 border-4 border-amber border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <p className="text-bright font-display font-bold text-xl">Entering Restaurant</p>
            <p className="text-mid text-sm italic">Establishing secure administrative session...</p>
          </div>
        </div>
      )}

      {/* ── Topbar ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-display italic text-amber text-xl">TableServe</span>
            <span className="hidden sm:block text-border text-lg">|</span>
            <span className="hidden sm:block text-xs font-body">
              <span className="text-amber font-semibold">Super Admin</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-faint text-xs font-body truncate max-w-[160px]">
              {user.email}
            </span>
            <button onClick={signOut} className="btn-ghost text-xs py-1.5 px-3">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* ── Content ─────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* ── Stats strip ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 text-center">
            <p className="font-display font-bold text-amber text-2xl">{restaurants.length}</p>
            <p className="text-mid text-xs mt-0.5">Total</p>
          </div>
          <div className="card p-4 text-center border border-done/20">
            <p className="font-display font-bold text-done text-2xl">{activeCount}</p>
            <p className="text-mid text-xs mt-0.5">Active</p>
          </div>
          <div className="card p-4 text-center border border-danger/20">
            <p className="font-display font-bold text-danger text-2xl">{disabledCount}</p>
            <p className="text-mid text-xs mt-0.5">Disabled</p>
          </div>
        </div>

        {/* ── Header + Search ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="section-title text-xl">Restaurants</h2>
            <p className="text-mid text-xs mt-0.5">
              Click a restaurant to expand details, users & pages
            </p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-amber">
            {showForm ? 'Cancel' : '+ New Restaurant'}
          </button>
        </div>

        {/* Search */}
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search restaurants…"
          className="input max-w-xs"
        />

        {/* ── Create form ─────────────────────────────────────────── */}
        {showForm && (
          <CreateRestaurantForm
            showToast={showToast}
            onCreated={() => { setShowForm(false); loadRestaurants() }}
          />
        )}

        {/* ── Restaurant list ─────────────────────────────────────── */}
        {loading ? (
          <Spinner text="Loading restaurants…" />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-5xl">🏪</p>
            <p className="text-mid font-body">
              {search ? 'No restaurants match your search.' : 'No restaurants yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                showToast={showToast}
                onImpersonate={handleImpersonate}
                onReloadAll={loadRestaurants}
                storageStats={storageStats?.[r.id]}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

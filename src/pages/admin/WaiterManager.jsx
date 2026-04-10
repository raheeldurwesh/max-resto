// src/pages/admin/WaiterManager.jsx
// Admin can create and manage waiter accounts for their restaurant

import { useState, useEffect, useCallback } from 'react'
import { getRestaurantUsers, createUser, resetUserPassword, deleteUser } from '../../services/restaurantService'
import { useAuth } from '../../contexts/AuthContext'
import { MiniSpinner } from '../../components/Spinner'
import Spinner from '../../components/Spinner'

function Toast({ msg }) {
  if (!msg) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-card border border-border
                    rounded-xl text-bright text-sm font-body shadow-lifted animate-slide-up">
      {msg}
    </div>
  )
}

export default function WaiterManager({ restaurantId }) {
  const { isSuperAdmin } = useAuth()
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [toast, setToast]       = useState('')
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving]     = useState(false)

  // Reset password state
  const [resetId, setResetId]     = useState(null)
  const [newPass, setNewPass]     = useState('')
  const [resetting, setResetting] = useState(false)

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const loadUsers = useCallback(async () => {
    try {
      const data = await getRestaurantUsers(restaurantId)
      setUsers(data.filter(u => u.role === 'waiter'))
    } catch (err) {
      console.error('Failed to load waiters:', err)
    } finally {
      setLoading(false)
    }
  }, [restaurantId])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!email || !password) return
    setSaving(true)
    try {
      await createUser({
        email: email.trim(),
        password,
        role: 'waiter',
        restaurantId,
      })
      showToast('✓ Waiter account created')
      setEmail('')
      setPassword('')
      setShowForm(false)
      loadUsers()
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResetPassword = async () => {
    if (!newPass || newPass.length < 6) {
      showToast('❌ Password must be at least 6 characters')
      return
    }
    setResetting(true)
    try {
      await resetUserPassword(resetId, newPass)
      showToast('✓ Password reset successfully')
      setResetId(null)
      setNewPass('')
    } catch (err) {
      showToast('❌ ' + err.message)
    } finally {
      setResetting(false)
    }
  }

  const handleDelete = async (userId, userEmail) => {
    if (!confirm(`Delete waiter "${userEmail}"? This cannot be undone.`)) return
    try {
      await deleteUser(userId)
      showToast('✓ Waiter deleted')
      loadUsers()
    } catch (err) {
      showToast('❌ ' + err.message)
    }
  }

  if (loading) return <Spinner text="Loading waiters…" />

  return (
    <div className="space-y-5 animate-fade-in">
      <Toast msg={toast} />

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="section-title text-xl">Waiter Management</h2>
          <p className="text-mid text-xs mt-0.5">{users.length} waiter(s) registered</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-amber">
          {showForm ? 'Cancel' : '+ Add Waiter'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card p-6 space-y-4">
          <h3 className="section-title text-base">New Waiter Account</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                     placeholder="waiter@restaurant.com" className="input" required />
            </div>
            <div>
              <label className="label">Initial Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                     placeholder="Min 6 characters" className="input" minLength={6} required />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-amber py-2.5 px-6">
            {saving ? <><MiniSpinner /> Creating…</> : '+ Create Waiter'}
          </button>
        </form>
      )}

      {/* Users list */}
      {users.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-5xl">👤</p>
          <p className="text-mid font-body">No waiters yet. Add your first waiter!</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {users.map(u => (
            <div key={u.user_id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-amber/10 border border-amber/25
                                flex items-center justify-center text-amber text-sm font-bold flex-shrink-0">
                  {u.email?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="text-bright text-sm font-body font-semibold truncate">{u.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-faint text-xs">waiter</span>
                    {u.banned && (
                      <span className="text-danger text-xs font-semibold">• Disabled</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {/* Reset password */}
                {resetId === u.user_id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="password" value={newPass}
                      onChange={e => setNewPass(e.target.value)}
                      placeholder="New password" className="input text-xs py-1.5 w-36"
                      minLength={6}
                    />
                    <button
                      onClick={handleResetPassword}
                      disabled={resetting}
                      className="btn-amber text-xs py-1.5 px-3"
                    >
                      {resetting ? <MiniSpinner /> : '✓'}
                    </button>
                    <button onClick={() => { setResetId(null); setNewPass('') }}
                            className="btn-ghost text-xs py-1.5 px-2">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setResetId(u.user_id)}
                    className="btn-ghost text-xs py-1.5 px-3"
                  >
                    🔑 Reset
                  </button>
                )}

                <button
                  onClick={() => handleDelete(u.user_id, u.email)}
                  className="btn-danger text-xs py-1.5 px-3"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

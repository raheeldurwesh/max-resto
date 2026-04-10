// src/pages/ResetPasswordPage.jsx
// Secure portal for setting new passwords (In-vites + Recovery)

import { useState } from 'react'
import { supabase } from '../supabase/client'
import { useNavigate } from 'react-router-dom'
import Spinner from '../components/Spinner'
import Footer from '../components/Footer'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]     = useState(false)
  const navigate = useNavigate()

  const handleReset = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      return setError('Passwords do not match')
    }
    if (password.length < 6) {
      return setError('Password must be at least 6 characters')
    }

    setLoading(true)
    setError('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      
      setSuccess(true)
      // Wait a moment and redirect to landing
      setTimeout(() => navigate('/'), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-amber/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-amber/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-scale-in">
        <div className="glass p-8 space-y-8">
          <div className="text-center space-y-2">
            <h1 className="font-display italic text-amber text-3xl">TableServe</h1>
            <h2 className="text-bright font-display text-xl font-bold">Secure Password Setup</h2>
            <p className="text-mid text-sm font-body">Create a strong password for your account.</p>
          </div>

          {success ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 bg-done/10 rounded-full flex items-center justify-center text-3xl mx-auto border border-done/30 animate-pulse-dot">
                ✅
              </div>
              <p className="text-done font-semibold">Password updated successfully!</p>
              <p className="text-mid text-sm">Redirecting you to the portal...</p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="label">New Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 3 characters"
                    className="input"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repeat password"
                    className="input"
                    minLength={6}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs font-medium animate-shake">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-amber w-full py-3"
              >
                {loading ? <Spinner text="Updating..." /> : 'Set Secure Password'}
              </button>
            </form>
          )}
        </div>

        <div className="w-full">
          <Footer />
        </div>
      </div>
    </div>
  )
}

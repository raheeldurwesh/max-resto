// src/App.jsx
// UPDATED: Multi-restaurant SaaS routing + AuthProvider

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider }  from './contexts/AuthContext'
import { useKeepAlive }  from './hooks/useKeepAlive'
import CustomerPage      from './pages/CustomerPage'
import WaiterPage        from './pages/WaiterPage'
import AdminPage         from './pages/admin/AdminPage'
import SuperAdminPage    from './pages/superadmin/SuperAdminPage'
import LandingPage       from './pages/LandingPage'
import LoginPage         from './pages/LoginPage'
import WakeUp            from './components/WakeUp'

function NotFound() {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center text-center px-4">
      <div>
        <p className="font-display text-amber text-8xl mb-4">404</p>
        <p className="text-mid font-body mb-6">Page not found.</p>
        <a href="/?table=1" className="btn-amber inline-flex">← Go to Menu</a>
      </div>
    </div>
  )
}

function AppContent() {
  const { isWakingUp, retryNow } = useKeepAlive()
  return (
    <>
      {isWakingUp && <WakeUp onRetry={retryNow} />}
      <Routes>
        {/* Public Entry Routes */}
        <Route path="/"               element={<LandingPage />}      />
        <Route path="/login/:role"    element={<LoginPage />}        />
        <Route path="/superadmin"     element={<SuperAdminPage />}   />
        <Route path="/admin"          element={<AdminPage />}        />

        {/* Dynamic Tenant Dashboards (Slug-based) */}
        <Route path="/:slug/admin"    element={<AdminPage />}      />
        <Route path="/:slug/waiter"   element={<WaiterPage />}     />

        {/* Tenant Menu (Customer Facing) */}
        <Route path="/:slug"          element={<CustomerPage />}   />

        <Route path="*"               element={<NotFound />}       />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

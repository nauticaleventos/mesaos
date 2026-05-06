import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import LoginPage  from './pages/auth/LoginPage'
import SignupPage from './pages/auth/SignupPage'
import HomePage   from './pages/HomePage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  if (loading) return (
    <div className="min-h-dvh flex items-center justify-center">
      <p className="text-muted text-sm">Cargando...</p>
    </div>
  )
  return session ? <>{children}</> : <Navigate to="/login" replace />
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  if (loading) return null
  return session ? <Navigate to="/" replace /> : <>{children}</>
}

export default function App() {
  const setSession = useAuthStore(s => s.setSession)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [setSession])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"  element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
        <Route path="/"       element={<PrivateRoute><HomePage /></PrivateRoute>} />
        <Route path="*"       element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

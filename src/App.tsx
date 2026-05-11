import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useAuthStore } from './store/authStore'
import { useFamilyStore } from './store/familyStore'
import LoginPage      from './pages/auth/LoginPage'
import SignupPage     from './pages/auth/SignupPage'
import OnboardingPage from './pages/onboarding/OnboardingPage'
import HomePage       from './pages/HomePage'
import FridgePage     from './pages/fridge/FridgePage'
import RecetasPage    from './pages/recipes/RecetasPage'
import RecetaPage     from './pages/recipes/RecetaPage'
import UnirsePage        from './pages/invite/UnirsePage'
import MenuPage          from './pages/menu/MenuPage'
import RecetasAutoPage   from './pages/admin/RecetasAutoPage'

function AppRoutes() {
  const { session, loading: authLoading }   = useAuthStore()
  const { family, loading: familyLoading }  = useFamilyStore()

  if (authLoading || (session && familyLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Cargando...</p>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login"  element={!session ? <LoginPage />  : <Navigate to="/" replace />} />
      <Route path="/signup" element={!session ? <SignupPage /> : <Navigate to="/" replace />} />

      {/* Onboarding: solo si no tiene familia aún */}
      <Route path="/onboarding" element={
        !session ? <Navigate to="/login" replace />
        : family  ? <Navigate to="/" replace />
        : <OnboardingPage />
      } />

      <Route path="/" element={
        !session ? <Navigate to="/login" replace />
        : !family ? <Navigate to="/onboarding" replace />
        : <HomePage />
      } />
      <Route path="/nevera" element={
        !session ? <Navigate to="/login" replace /> : <FridgePage />
      } />
      <Route path="/recetas" element={
        !session ? <Navigate to="/login" replace /> : <RecetasPage />
      } />
      <Route path="/menu" element={
        !session ? <Navigate to="/login" replace />
        : !family  ? <Navigate to="/onboarding" replace />
        : <MenuPage />
      } />
      {/* Pública — muestra preview si no hay sesión */}
      <Route path="/receta/:id" element={<RecetaPage />} />
      {/* Pública — link de invitación */}
      <Route path="/unirse/:token" element={<UnirsePage />} />

      <Route path="/admin/recetas-auto" element={
        !session ? <Navigate to="/login" replace /> : <RecetasAutoPage />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const setSession  = useAuthStore(s => s.setSession)
  const loadFamily  = useFamilyStore(s => s.loadFamily)
  const { session } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
    })
    return () => subscription.unsubscribe()
  }, [setSession])

  useEffect(() => {
    if (session?.user) loadFamily(session.user.id)
  }, [session, loadFamily])

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

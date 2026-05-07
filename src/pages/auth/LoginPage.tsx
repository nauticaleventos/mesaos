import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [loading, setLoading]       = useState(false)
  const [resetSent, setResetSent]   = useState(false)
  const [resetting, setResetting]   = useState(false)
  const signIn                      = useAuthStore(s => s.signIn)
  const navigate                    = useNavigate()
  const [searchParams]              = useSearchParams()
  const returnTo                    = searchParams.get('return') ?? '/'

  const handleReset = async () => {
    if (!email.trim()) return setError('Escribe tu correo primero para recuperar la contraseña.')
    setResetting(true)
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetting(false)
    setResetSent(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) return setError('Correo o contraseña incorrectos.')
    navigate(returnTo, { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
         style={{ background: 'linear-gradient(160deg, #f0f7ec 0%, #f7faf5 60%, #eef5f0 100%)' }}>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-light mb-4">
          <span className="text-3xl">🥗</span>
        </div>
        <h1 className="text-3xl font-serif text-accent font-semibold tracking-wide">mesa.os</h1>
        <p className="text-muted text-sm mt-1">Tu cocina familiar, organizada.</p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
          <h2 className="text-text text-lg font-semibold text-center">Bienvenido de vuelta</h2>

          <div>
            <label className="input-label">Correo electrónico</label>
            <input
              type="email"
              placeholder="hola@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="input-label">Contraseña</label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors text-lg"
                tabIndex={-1}
              >
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-error text-sm text-center">{error}</p>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          {resetSent ? (
            <p className="text-center text-sm text-success">
              ✓ Te enviamos el link de recuperación. Revisa tu correo.
            </p>
          ) : (
            <button type="button" onClick={handleReset} disabled={resetting}
              className="text-center text-sm text-muted hover:text-accent transition-colors w-full">
              {resetting ? 'Enviando...' : '¿Olvidaste tu contraseña?'}
            </button>
          )}

          <p className="text-center text-sm text-muted">
            ¿No tienes cuenta?{' '}
            <Link to={`/signup${returnTo !== '/' ? `?return=${encodeURIComponent(returnTo)}` : ''}`}
              className="text-accent hover:text-accent-hover font-medium transition-colors">
              Regístrate gratis
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

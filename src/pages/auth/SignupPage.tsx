import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function SignupPage() {
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPwd, setShowPwd]     = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const signUp                    = useAuthStore(s => s.signUp)
  const navigate                  = useNavigate()
  const [searchParams]            = useSearchParams()
  const returnTo                  = searchParams.get('return') ?? '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    if (password.length < 6)  return setError('La contraseña debe tener al menos 6 caracteres.')
    setLoading(true)
    const err = await signUp(email, password)
    setLoading(false)
    if (err) return setError(err)
    navigate('/bienvenida', { replace: true })
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
         style={{ background: 'linear-gradient(160deg, #f0f7ec 0%, #f7faf5 60%, #eef5f0 100%)' }}>

      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-light mb-4">
          <span className="text-3xl">🥗</span>
        </div>
        <h1 className="text-3xl font-serif text-accent font-semibold tracking-wide">mesa.os</h1>
        <p className="text-muted text-sm mt-1">Organiza la alimentación de tu familia.</p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
          <h2 className="text-text text-lg font-semibold text-center">Crea tu cuenta</h2>

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
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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

          <div>
            <label className="input-label">Confirmar contraseña</label>
            <div className="relative">
              <input
                type={showConf ? 'text' : 'password'}
                placeholder="Repite tu contraseña"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowConf(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors text-lg"
                tabIndex={-1}
              >
                {showConf ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-error text-sm text-center">{error}</p>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta gratis'}
          </button>

          <p className="text-center text-sm text-muted">
            ¿Ya tienes cuenta?{' '}
            <Link to={`/login${returnTo !== '/' ? `?return=${encodeURIComponent(returnTo)}` : ''}`}
              className="text-accent hover:text-accent-hover font-medium transition-colors">
              Entra aquí
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

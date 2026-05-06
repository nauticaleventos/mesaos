import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)
  const signIn                  = useAuthStore(s => s.signIn)
  const navigate                = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) return setError(err)
    navigate('/')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / marca */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif text-accent tracking-wide">mesa.os</h1>
          <p className="text-muted text-sm mt-2">Tu cocina familiar, organizada.</p>
        </div>

        <form onSubmit={handleSubmit} className="card flex flex-col gap-5">
          <div>
            <label className="input-label">Correo</label>
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
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-error text-sm text-center">{error}</p>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-center text-sm text-muted">
            ¿No tienes cuenta?{' '}
            <Link to="/signup" className="text-accent hover:text-accent-hover transition-colors">
              Regístrate
            </Link>
          </p>
        </form>

      </div>
    </div>
  )
}

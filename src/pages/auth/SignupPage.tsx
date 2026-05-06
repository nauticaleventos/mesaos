import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export default function SignupPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [success, setSuccess]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const signUp                  = useAuthStore(s => s.signUp)
  const navigate                = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirm)
      return setError('Las contraseñas no coinciden.')
    if (password.length < 6)
      return setError('La contraseña debe tener al menos 6 caracteres.')

    setLoading(true)
    const err = await signUp(email, password)
    setLoading(false)

    if (err) return setError(err)

    setSuccess(true)
    setTimeout(() => navigate('/login'), 3000)
  }

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <div className="w-full max-w-sm card text-center flex flex-col gap-4">
          <span className="text-4xl">✉️</span>
          <h2 className="text-text text-xl">Revisa tu correo</h2>
          <p className="text-muted text-sm">
            Te enviamos un enlace de confirmación. Una vez confirmado podrás entrar.
          </p>
          <p className="text-muted text-xs">Redirigiendo al login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <h1 className="text-3xl font-serif text-accent tracking-wide">mesa.os</h1>
          <p className="text-muted text-sm mt-2">Crea tu cuenta familiar.</p>
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
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div>
            <label className="input-label">Confirmar contraseña</label>
            <input
              type="password"
              placeholder="Repite tu contraseña"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="text-error text-sm text-center">{error}</p>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-sm text-muted">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-accent hover:text-accent-hover transition-colors">
              Entra aquí
            </Link>
          </p>
        </form>

      </div>
    </div>
  )
}

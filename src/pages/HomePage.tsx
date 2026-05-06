import { useAuthStore } from '../store/authStore'

export default function HomePage() {
  const { user, signOut } = useAuthStore()

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-serif text-accent tracking-wide mb-2">mesa.os</h1>
        <p className="text-muted text-sm">Sesión 1 completada ✓</p>
      </div>

      <div className="card w-full max-w-sm flex flex-col gap-3 text-center">
        <p className="text-muted text-sm">Conectado como</p>
        <p className="text-text font-medium">{user?.email}</p>
        <button onClick={signOut} className="btn-ghost mt-2">
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

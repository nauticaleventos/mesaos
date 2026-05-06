import { useAuthStore } from '../store/authStore'
import { useFamilyStore } from '../store/familyStore'

export default function HomePage() {
  const { signOut }         = useAuthStore()
  const { family, members } = useFamilyStore()

  return (
    <div className="min-h-dvh px-4 py-8 max-w-lg mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif text-accent font-semibold">mesa.os</h1>
          <p className="text-muted text-sm">{family?.name}</p>
        </div>
        <button onClick={signOut} className="text-muted text-sm hover:text-text transition-colors">
          Salir
        </button>
      </div>

      {/* Miembros */}
      <div>
        <h2 className="text-text font-semibold mb-3">Tu familia ({members.length})</h2>
        <div className="flex flex-col gap-3">
          {members.map(m => (
            <div key={m.id} className="card flex items-center gap-4">
              <span className="text-3xl">{m.emoji}</span>
              <div className="flex-1">
                <p className="font-semibold text-text">{m.name}</p>
                <p className="text-muted text-xs mt-0.5">
                  {m.type === 'child' ? 'Niño/adolescente' : 'Adulto'}
                  {m.age ? ` · ${m.age} años` : ''}
                  {m.eating_style !== 'omnivore' ? ` · ${m.eating_style}` : ''}
                </p>
                {m.conditions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.conditions.map(c => (
                      <span key={c} className="px-2 py-0.5 bg-red-50 text-error text-xs rounded-full border border-red-200">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Próximamente */}
      <div className="card text-center flex flex-col gap-2 opacity-60">
        <p className="text-2xl">🍽️</p>
        <p className="text-text font-medium">Menú semanal</p>
        <p className="text-muted text-sm">Próximamente — Sesión 5</p>
      </div>

    </div>
  )
}

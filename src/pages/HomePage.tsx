import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useFamilyStore } from '../store/familyStore'
import type { FamilyMember } from '../lib/types'
import StepAddMember from '../components/onboarding/StepAddMember'

export default function HomePage() {
  const navigate                          = useNavigate()
  const { signOut }                     = useAuthStore()
  const { family, members, deleteMember } = useFamilyStore()
  const [addingMember, setAddingMember] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const goalLabel: Record<string, string> = {
    deficit: 'Bajar de peso', deficit_agresivo: 'Bajar rápido',
    mantenimiento: 'Mantener', volumen: 'Ganar músculo', crecimiento: 'Crecimiento',
  }
  const styleLabel: Record<string, string> = {
    omnivore: 'Todo come', vegetarian: 'Vegetariano', vegan: 'Vegano',
    keto: 'Keto', paleo: 'Paleo', gluten_free: 'Sin gluten', lactose_free: 'Sin lactosa',
  }

  if (addingMember) {
    return (
      <div className="min-h-dvh px-4 py-8 max-w-lg mx-auto">
        <button onClick={() => setAddingMember(false)}
          className="text-muted text-sm mb-6 flex items-center gap-1 hover:text-text transition-colors">
          ← Volver
        </button>
        <StepAddMember
          familyName={family?.name ?? ''}
          memberCount={members.length}
          onAdded={() => setAddingMember(false)}
          onFinish={() => setAddingMember(false)}
        />
      </div>
    )
  }

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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-text font-semibold">
            {members.length === 0 ? 'Sin miembros aún' : `Tu familia (${members.length})`}
          </h2>
          <button onClick={() => setAddingMember(true)}
            className="text-accent text-sm font-medium hover:text-accent-hover transition-colors">
            + Agregar
          </button>
        </div>

        {members.length === 0 ? (
          <div className="card text-center flex flex-col gap-3 py-8">
            <p className="text-4xl">👨‍👩‍👧</p>
            <p className="text-muted text-sm">Agrega los miembros de tu familia para empezar.</p>
            <button onClick={() => setAddingMember(true)} className="btn-primary mt-2">
              Agregar primer miembro
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {members.map((m: FamilyMember) => (
              <div key={m.id} className="card flex items-start gap-4">
                <span className="text-3xl pt-0.5">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-text">{m.name}</p>
                    <button
                      onClick={() => setConfirmDelete(m.id!)}
                      className="text-muted hover:text-error transition-colors text-sm ml-2">
                      ×
                    </button>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Tag>{m.member_type === 'child' ? '👦 Niño' : '🧑 Adulto'}</Tag>
                    {m.age && <Tag>{m.age} años</Tag>}
                    {m.eating_style && m.eating_style !== 'omnivore' &&
                      <Tag accent>{styleLabel[m.eating_style] ?? m.eating_style}</Tag>}
                    {m.goal && <Tag>{goalLabel[m.goal]}</Tag>}
                  </div>

                  {/* Condiciones médicas */}
                  {m.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {m.conditions.map(c => (
                        <span key={c} className="px-2 py-0.5 bg-red-50 text-error text-xs rounded-full border border-red-200">
                          ⚕️ {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Alergias */}
                  {m.allergies.length > 0 && (
                    <p className="text-xs text-muted mt-1.5">
                      🚫 <span className="text-error">Alérgico a:</span> {m.allergies.join(', ')}
                    </p>
                  )}

                  {/* Prohibidos */}
                  {m.prohibited.length > 0 && (
                    <p className="text-xs text-muted mt-1">
                      ❌ No come: {m.prohibited.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmar borrar */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 flex items-end justify-center z-50 px-4 pb-8">
          <div className="card w-full max-w-sm flex flex-col gap-4">
            <p className="text-text font-semibold text-center">¿Eliminar este miembro?</p>
            <p className="text-muted text-sm text-center">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1">
                Cancelar
              </button>
              <button
                onClick={async () => { await deleteMember(confirmDelete); setConfirmDelete(null) }}
                className="flex-1 py-3 rounded-xl bg-error text-white font-semibold text-sm">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Módulos */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => navigate('/nevera')}
          className="card flex flex-col items-center gap-2 py-5 hover:border-accent hover:bg-accent-light transition-all active:scale-95">
          <span className="text-3xl">🧊</span>
          <span className="text-sm font-medium text-text">Mi Nevera</span>
        </button>
        <div className="card flex flex-col items-center gap-2 py-5 opacity-40 cursor-not-allowed">
          <span className="text-3xl">📖</span>
          <span className="text-sm font-medium text-text">Recetario</span>
          <span className="text-xs text-muted">Próximamente</span>
        </div>
        <div className="card flex flex-col items-center gap-2 py-5 opacity-40 cursor-not-allowed">
          <span className="text-3xl">🍽️</span>
          <span className="text-sm font-medium text-text">Menú semanal</span>
          <span className="text-xs text-muted">Próximamente</span>
        </div>
        <div className="card flex flex-col items-center gap-2 py-5 opacity-40 cursor-not-allowed">
          <span className="text-3xl">🛒</span>
          <span className="text-sm font-medium text-text">Mercado</span>
          <span className="text-xs text-muted">Próximamente</span>
        </div>
      </div>

    </div>
  )
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs border
      ${accent
        ? 'bg-accent-light border-accent text-accent'
        : 'bg-gray-50 border-border text-muted'}`}>
      {children}
    </span>
  )
}

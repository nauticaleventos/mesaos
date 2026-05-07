import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useFamilyStore } from '../store/familyStore'
import { useFridgeStore } from '../store/fridgeStore'
import { supabase } from '../lib/supabase'
import { calcularNivelNevera } from '../lib/nivelNevera'
import type { FamilyMember } from '../lib/types'
import StepAddMember from '../components/onboarding/StepAddMember'

export default function HomePage() {
  const navigate                          = useNavigate()
  const { signOut, session }            = useAuthStore()
  const { family, members, deleteMember } = useFamilyStore()
  const { items, loadItems }            = useFridgeStore()

  useEffect(() => {
    if (family?.id) loadItems(family.id)
  }, [family?.id, loadItems])

  const nivel = calcularNivelNevera(items)
  const [addingMember, setAddingMember]   = useState(false)
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl]         = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(false)

  const isOwner = family?.owner_user_id === session?.user?.id

  const generateInvite = async () => {
    if (!family?.id || !session?.user?.id) return
    setInviteLoading(true)
    const token = crypto.randomUUID()
    await supabase.from('invitations').insert({
      family_id:           family.id,
      invited_by_user_id:  session.user.id,
      token,
      base_role:           'contributor',
      expires_at:          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const url = `${window.location.origin}/unirse/${token}`
    setInviteUrl(url)
    setInviteLoading(false)
  }

  const copyInvite = async () => {
    if (!inviteUrl) return
    if (navigator.share) {
      await navigator.share({ title: `Únete a ${family?.name} en mesa.os`, url: inviteUrl })
    } else {
      await navigator.clipboard.writeText(inviteUrl)
    }
  }

  const goalLabel: Record<string, string> = {
    deficit: 'Bajar de peso', deficit_agresivo: 'Bajar rápido',
    mantenimiento: 'Mantener', volumen: 'Ganar músculo', crecimiento: 'Crecimiento',
  }
  const styleLabel: Record<string, string> = {
    omnivore: 'Todo come', vegetarian: 'Vegetariano', vegan: 'Vegano',
    keto: 'Keto', paleo: 'Paleo', gluten_free: 'Sin gluten', lactose_free: 'Sin lactosa',
  }

  if (addingMember || editingMember) {
    return (
      <div className="min-h-screen px-4 py-8 max-w-lg mx-auto">
        <button onClick={() => { setAddingMember(false); setEditingMember(null) }}
          className="text-muted text-sm mb-6 flex items-center gap-1 hover:text-text transition-colors">
          ← Volver
        </button>
        <StepAddMember
          familyName={family?.name ?? ''}
          memberCount={members.length}
          onAdded={() => setAddingMember(false)}
          onFinish={() => setAddingMember(false)}
          editingMember={editingMember ?? undefined}
          onUpdated={() => setEditingMember(null)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-lg mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-accent">mesa.os</h1>
          <p className="text-muted text-sm">{family?.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              onClick={generateInvite}
              disabled={inviteLoading}
              className="px-3 py-1.5 rounded-xl border border-border text-muted text-xs font-medium hover:border-accent hover:text-accent transition-all disabled:opacity-50">
              {inviteLoading ? '...' : '+ Invitar'}
            </button>
          )}
          <button onClick={signOut} className="text-muted text-sm hover:text-text transition-colors">
            Salir
          </button>
        </div>
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
                    <div className="flex items-center gap-2">
                      <button onClick={() => setEditingMember(m)}
                        className="text-muted hover:text-accent transition-colors text-sm">
                        ✏️
                      </button>
                      <button onClick={() => setConfirmDelete(m.id!)}
                        className="text-muted hover:text-error transition-colors text-sm">
                        ×
                      </button>
                    </div>
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

      {/* Nevera — card completo con estado */}
      <button onClick={() => navigate('/nevera')}
        className="card w-full text-left flex flex-col gap-3 hover:border-accent transition-all active:scale-95">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧊</span>
            <span className="font-semibold text-text">Mi Nevera</span>
          </div>
          <span className="text-xs text-muted">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Barra de nivel */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text">{nivel.resumen}</span>
            <span className="text-sm font-semibold"
              style={{ color: nivel.porcentaje >= 75 ? '#22c55e' : nivel.porcentaje >= 50 ? '#4a7c59' : nivel.porcentaje >= 25 ? '#e8a020' : '#ef4444' }}>
              {nivel.porcentaje}%
            </span>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${nivel.porcentaje}%`,
                backgroundColor: nivel.porcentaje >= 75 ? '#22c55e'
                  : nivel.porcentaje >= 50 ? '#4a7c59'
                  : nivel.porcentaje >= 25 ? '#e8a020'
                  : '#ef4444'
              }} />
          </div>
        </div>

        {/* Alertas */}
        {nivel.alertasVencimiento > 0 && (
          <p className="text-xs text-error">
            ⚠️ {nivel.alertasVencimiento} alimento{nivel.alertasVencimiento > 1 ? 's' : ''} por vencer
          </p>
        )}
        {nivel.categoriasFaltantes.length > 0 && nivel.porcentaje < 75 && (
          <p className="text-xs text-muted">
            Para el mercado: <span className="text-text">{nivel.categoriasFaltantes.join(', ')}</span>
          </p>
        )}
        {nivel.porcentaje >= 75 && (
          <p className="text-xs text-success">Nevera completa — podés relajarte 😌</p>
        )}
      </button>

      {/* Otros módulos */}
      <div className="grid grid-cols-3 gap-3">
        <button onClick={() => navigate('/recetas')}
          className="card flex flex-col items-center gap-2 py-4 hover:border-accent hover:bg-accent-light transition-all active:scale-95">
          <span className="text-2xl">📖</span>
          <span className="text-xs font-medium text-text text-center">Recetario</span>
        </button>
        <div className="card flex flex-col items-center gap-2 py-4 opacity-40 cursor-not-allowed">
          <span className="text-2xl">🍽️</span>
          <span className="text-xs font-medium text-text text-center">Menú semanal</span>
        </div>
        <div className="card flex flex-col items-center gap-2 py-4 opacity-40 cursor-not-allowed">
          <span className="text-2xl">🛒</span>
          <span className="text-xs font-medium text-text text-center">Mercado</span>
        </div>
      </div>

      {/* Modal invitación */}
      {inviteUrl && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center z-50 px-4 pb-8"
          onClick={e => e.target === e.currentTarget && setInviteUrl(null)}>
          <div className="card w-full max-w-sm flex flex-col gap-4">
            <div>
              <p className="font-semibold text-text">Link de invitación listo</p>
              <p className="text-muted text-xs mt-0.5">Válido por 7 días. Úsalo una vez.</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-3 py-2.5 border border-border">
              <p className="text-xs text-muted break-all font-mono">{inviteUrl}</p>
            </div>
            <button onClick={copyInvite} className="btn-primary">
              Compartir link ↗
            </button>
            <button onClick={() => setInviteUrl(null)} className="btn-ghost">
              Cerrar
            </button>
          </div>
        </div>
      )}

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

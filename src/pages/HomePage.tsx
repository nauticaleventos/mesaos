import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Refrigerator, CalendarDays, Settings } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useFamilyStore } from '../store/familyStore'
import { useFridgeStore } from '../store/fridgeStore'
import { supabase } from '../lib/supabase'
import { calcularNivelNevera } from '../lib/nivelNevera'
import type { FamilyMember, FamilyUser } from '../lib/types'
import StepAddMember from '../components/onboarding/StepAddMember'
import AsistenciaSemanalPanel from '../components/family/AsistenciaSemanalPanel'
import BottomNav from '../components/ui/BottomNav'
import SorprenderBanner from '../components/menu/SorprenderBanner'
import NotificacionesModal from '../components/ui/NotificacionesModal'
import { AdBanner } from '../components/ads/AdPlaceholders'

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

  const [showAsistencia, setShowAsistencia]   = useState(false)
  const [showSettings, setShowSettings]       = useState(false)
  const [familyUsers, setFamilyUsers]         = useState<FamilyUser[]>([])
  const setHealthyMode                        = useFamilyStore(s => s.setHealthyMode)

  // Preferencias de notificaciones
  const [notifPrefs, setNotifPrefs] = useState<{
    notificaciones_activas: boolean
    notif_recordatorio_dom: boolean
    notif_inventario_bajo:  boolean
  } | null>(null)
  const [showNotifModal, setShowNotifModal] = useState(false)

  useEffect(() => {
    if (family?.id && isOwner) {
      supabase.from('family_users').select('*').eq('family_id', family.id)
        .then(({ data }) => { if (data) setFamilyUsers(data as FamilyUser[]) })
    }
  }, [family?.id, isOwner])

  // Cargar preferencias de notificaciones
  useEffect(() => {
    if (!session?.user?.id || members.length === 0) return
    supabase.from('user_preferences')
      .select('notificaciones_activas, notif_recordatorio_dom, notif_inventario_bajo, updated_at')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNotifPrefs(data as typeof notifPrefs)
        } else {
          // Sin preferencias guardadas → primera vez, mostrar modal una sola vez
          // Usar localStorage para no repetirlo en recargas
          const yaVisto = localStorage.getItem('notif_modal_visto')
          if (!yaVisto) {
            setShowNotifModal(true)
            localStorage.setItem('notif_modal_visto', '1')
          }
        }
      })
  }, [session?.user?.id, members.length])

  const toggleNotif = async (key: 'notif_recordatorio_dom' | 'notif_inventario_bajo', val: boolean) => {
    if (!session?.user?.id || !family?.id) return
    const next = { ...notifPrefs, [key]: val, notificaciones_activas: true }
    setNotifPrefs(next as typeof notifPrefs)
    await supabase.from('user_preferences').upsert({
      user_id:   session.user.id,
      family_id: family.id,
      ...next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
  }

  const toggleChefPermission = async (fuId: string, current: boolean) => {
    const fu = familyUsers.find(f => f.id === fuId)
    if (!fu) return
    const newPerms = { ...fu.permissions, can_rate_for_members: !current }
    await supabase.from('family_users').update({ permissions: newPerms }).eq('id', fuId)
    setFamilyUsers(fus => fus.map(f => f.id === fuId ? { ...f, permissions: newPerms } : f))
  }

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
    <div className="min-h-screen px-4 py-8 pb-28 max-w-lg mx-auto flex flex-col gap-6 overflow-x-hidden">
      <BottomNav />

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
              <div key={m.id} className="card flex items-start gap-4 overflow-hidden">
                <span className="text-3xl pt-0.5 flex-shrink-0">{m.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-text truncate">{m.name}</p>
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
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.conditions.map(c => (
                        <span key={c} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-xs font-medium" style={{ color: '#C84B31' }}>
                          ⚕️ {c}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Alergias — chips grandes */}
                  {m.allergies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {m.allergies.map(a => (
                        <span key={a} className="flex items-center gap-1 px-3 py-1.5 bg-red-50 border border-red-300 rounded-full text-xs font-semibold" style={{ color: '#C84B31' }}>
                          ⚠️ {a}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Prohibidos — chips grises */}
                  {m.prohibited.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {m.prohibited.map(p => (
                        <span key={p} className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-full text-xs font-medium text-muted">
                          🚫 {p}
                        </span>
                      ))}
                    </div>
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

      {/* Asistencia semanal */}
      {members.length > 0 && (
        <div className="card flex flex-col gap-3">
          <button type="button" onClick={() => setShowAsistencia(o => !o)}
            className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-accent flex-shrink-0" />
              <span className="font-medium text-text text-sm">Esta semana comen en casa</span>
            </div>
            <span className="text-muted text-xs">{showAsistencia ? '▲' : '▼'}</span>
          </button>
          {showAsistencia && family?.id && <AsistenciaSemanalPanel familyId={family.id} />}
        </div>
      )}

      {/* Configuración de familia (owner) */}
      {isOwner && (
        <div className="card flex flex-col gap-3">
          <button type="button" onClick={() => setShowSettings(o => !o)}
            className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Settings size={18} className="text-accent flex-shrink-0" />
              <span className="font-medium text-text text-sm">Configuración</span>
            </div>
            <span className="text-muted text-xs">{showSettings ? '▲' : '▼'}</span>
          </button>

          {showSettings && (
            <div className="flex flex-col gap-4 pt-1">
              {/* Modo saludable */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text">🥗 Modo saludable</p>
                  <p className="text-xs text-muted mt-0.5 max-w-[220px]">
                    La app prefiere versiones más livianas (air fryer, integrales, menos azúcar) cuando existen.
                  </p>
                </div>
                <button type="button" onClick={() => setHealthyMode(!family?.healthy_mode_active)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0
                    ${family?.healthy_mode_active ? 'bg-accent' : 'bg-gray-200'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                    ${family?.healthy_mode_active ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>

              {/* Notificaciones */}
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <p className="text-sm font-medium text-text">🔔 Notificaciones</p>
                {[
                  { key: 'notif_recordatorio_dom' as const, label: 'Recordatorio dominical', desc: 'Domingos 9am — te armo el menú de la semana' },
                  { key: 'notif_inventario_bajo'  as const, label: 'Inventario bajo',        desc: 'Cuando te quedan pocos ingredientes' },
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-text">{label}</p>
                      <p className="text-[11px] text-muted">{desc}</p>
                    </div>
                    <button type="button"
                      onClick={() => toggleNotif(key, !(notifPrefs?.[key] ?? false))}
                      className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0
                        ${notifPrefs?.[key] ? 'bg-accent' : 'bg-gray-200'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                        ${notifPrefs?.[key] ? 'left-5' : 'left-0.5'}`} />
                    </button>
                  </div>
                ))}
                {!notifPrefs?.notificaciones_activas && (
                  <button onClick={() => setShowNotifModal(true)}
                    className="text-xs text-accent font-medium text-left mt-1">
                    Activar permisos →
                  </button>
                )}
              </div>

              {/* Permisos chef */}
              {familyUsers.filter(fu => fu.base_role !== 'owner').length > 0 && (
                <div>
                  <p className="text-sm font-medium text-text mb-2">👨‍🍳 Permisos del chef</p>
                  <div className="flex flex-col gap-2">
                    {familyUsers.filter(fu => fu.base_role !== 'owner').map(fu => (
                      <div key={fu.id} className="flex items-center justify-between p-2.5 bg-surface rounded-xl border border-border">
                        <div>
                          <p className="text-sm text-text">{fu.display_name}</p>
                          <p className="text-xs text-muted capitalize">{fu.base_role}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-xs text-muted">Valorar a nombre de miembros</p>
                          <button type="button"
                            onClick={() => toggleChefPermission(fu.id, !!fu.permissions.can_rate_for_members)}
                            className={`w-10 h-5 rounded-full transition-colors relative
                              ${fu.permissions.can_rate_for_members ? 'bg-accent' : 'bg-gray-200'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all
                              ${fu.permissions.can_rate_for_members ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Nevera — card consolidada */}
      {items.length === 0 ? (
        /* Nevera vacía — una sola card limpia */
        <div className="card flex flex-col items-center gap-4 py-6 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(231,111,81,0.1)' }}>
            <Refrigerator size={32} color="#E76F51" />
          </div>
          <div>
            <p className="font-semibold text-text">Tu nevera está vacía 😬</p>
            {nivel.categoriasFaltantes.length > 0 && (
              <p className="text-muted text-sm mt-1">
                Te faltan: {nivel.categoriasFaltantes.join(', ')}
              </p>
            )}
          </div>
          <button onClick={() => navigate('/nevera')} className="btn-primary max-w-xs">
            + Agregar productos
          </button>
        </div>
      ) : (
        /* Nevera con contenido */
        <button onClick={() => navigate('/nevera')}
          className="card w-full text-left flex flex-col gap-3 hover:border-accent transition-all active:scale-95">
          <div className="flex items-center justify-between min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Refrigerator size={20} className="text-accent flex-shrink-0" />
              <span className="font-semibold text-text truncate">Mi Nevera</span>
            </div>
            <span className="text-xs text-muted flex-shrink-0 ml-2">{items.length} {items.length !== 1 ? 'items' : 'item'}</span>
          </div>

          {/* Barra de nivel */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text">{nivel.resumen}</span>
              <span className="text-sm font-semibold"
                style={{ color: nivel.porcentaje >= 75 ? '#6B7F39' : nivel.porcentaje >= 50 ? '#6B7F39' : nivel.porcentaje >= 25 ? '#E8B547' : '#C84B31' }}>
                {nivel.porcentaje}%
              </span>
            </div>
            <div className="w-full rounded-full h-2" style={{ background: 'rgba(44,44,42,0.08)' }}>
              <div className="h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${nivel.porcentaje}%`,
                  backgroundColor: nivel.porcentaje >= 50 ? '#6B7F39' : nivel.porcentaje >= 25 ? '#E8B547' : '#C84B31'
                }} />
            </div>
          </div>

          {nivel.alertasVencimiento > 0 && (
            <p className="text-xs text-error">
              ⚠️ {nivel.alertasVencimiento} alimento{nivel.alertasVencimiento > 1 ? 's' : ''} por vencer
            </p>
          )}
          {nivel.porcentaje >= 75 && (
            <p className="text-xs" style={{ color: '#6B7F39' }}>Nevera completa — podés relajarte 😌</p>
          )}
        </button>
      )}


      {/* Sorpréndeme */}
      {members.length > 0 && family?.id && (
        <SorprenderBanner familyId={family.id} />
      )}

      {members.length > 0 && <AdBanner />}

      {/* Modal notificaciones */}
      {showNotifModal && session?.user?.id && family?.id && (
        <NotificacionesModal
          userId={session.user.id}
          familyId={family.id}
          onClose={() => {
            setShowNotifModal(false)
            // Recargar prefs después de responder
            supabase.from('user_preferences')
              .select('notificaciones_activas, notif_recordatorio_dom, notif_inventario_bajo')
              .eq('user_id', session.user.id)
              .maybeSingle()
              .then(({ data }) => { if (data) setNotifPrefs(data as typeof notifPrefs) })
          }}
        />
      )}

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

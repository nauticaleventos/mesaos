import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/authStore'
import { useFamilyStore } from '../../store/familyStore'

interface Invitation {
  id:         string
  family_id:  string
  base_role:  string
  expires_at: string
  used_at:    string | null
}

interface FamilyInfo {
  name: string
}

type State = 'loading' | 'valid' | 'invalid' | 'joining' | 'joined' | 'already_member'

export default function UnirsePage() {
  const { token }           = useParams<{ token: string }>()
  const navigate            = useNavigate()
  const { session }         = useAuthStore()
  const { family, loadFamily } = useFamilyStore()

  const [state, setState]   = useState<State>('loading')
  const [invite, setInvite] = useState<Invitation | null>(null)
  const [familyInfo, setFamilyInfo] = useState<FamilyInfo | null>(null)

  useEffect(() => {
    if (token) loadInvitation(token)
  }, [token])

  // Si ya tiene sesión y el invite está listo, unirse automáticamente
  useEffect(() => {
    if (session && invite && state === 'valid') {
      joinFamily()
    }
  }, [session, invite, state])

  const loadInvitation = async (tok: string) => {
    const { data, error } = await supabase
      .from('invitations')
      .select('id, family_id, base_role, expires_at, used_at')
      .eq('token', tok)
      .single()

    if (error || !data) { setState('invalid'); return }

    const inv = data as Invitation
    if (inv.used_at || new Date(inv.expires_at) < new Date()) {
      setState('invalid'); return
    }

    // Cargar nombre de la familia
    const { data: fam } = await supabase
      .from('families')
      .select('name')
      .eq('id', inv.family_id)
      .single()

    setInvite(inv)
    setFamilyInfo(fam as FamilyInfo)
    setState('valid')
  }

  const joinFamily = async () => {
    if (!session || !invite) return
    setState('joining')

    // Verificar si ya es miembro
    const { data: existing } = await supabase
      .from('family_users')
      .select('id')
      .eq('family_id', invite.family_id)
      .eq('user_id', session.user.id)
      .single()

    if (existing) {
      setState('already_member')
      setTimeout(() => navigate('/'), 2000)
      return
    }

    // Unirse a la familia
    await supabase.from('family_users').insert({
      family_id:    invite.family_id,
      user_id:      session.user.id,
      display_name: session.user.email?.split('@')[0] ?? 'Nuevo miembro',
      base_role:    invite.base_role ?? 'contributor',
      invited_by_user_id: null,
    })

    // Marcar invitación como usada
    await supabase.from('invitations')
      .update({ used_at: new Date().toISOString(), used_by_user_id: session.user.id })
      .eq('id', invite.id)

    // Recargar familia
    await loadFamily(session.user.id)
    setState('joined')
    setTimeout(() => navigate('/'), 2000)
  }

  const goToLogin  = () => navigate(`/login?return=/unirse/${token}`)
  const goToSignup = () => navigate(`/signup?return=/unirse/${token}`)

  // ── UI ───────────────────────────────────────────────────────────────────

  const BG = 'min-h-screen flex flex-col items-center justify-center px-4 py-10 max-w-sm mx-auto text-center'

  if (state === 'loading') return (
    <div className={BG}>
      <p className="text-muted text-sm">Verificando invitación...</p>
    </div>
  )

  if (state === 'invalid') return (
    <div className={BG + ' gap-4'}>
      <span className="text-5xl">😕</span>
      <div>
        <p className="font-semibold text-text text-lg">Invitación no válida</p>
        <p className="text-muted text-sm mt-1">Este link ya fue usado o expiró. Pide uno nuevo a quien te invitó.</p>
      </div>
      <button onClick={() => navigate('/login')} className="btn-primary max-w-xs">
        Ir al inicio
      </button>
    </div>
  )

  if (state === 'joining') return (
    <div className={BG}>
      <p className="text-muted text-sm">Uniéndote a la familia...</p>
    </div>
  )

  if (state === 'joined') return (
    <div className={BG + ' gap-4'}>
      <span className="text-5xl">🎉</span>
      <p className="font-semibold text-text text-lg">¡Bienvenido a {familyInfo?.name}!</p>
      <p className="text-muted text-sm">Redirigiendo...</p>
    </div>
  )

  if (state === 'already_member') return (
    <div className={BG + ' gap-4'}>
      <span className="text-5xl">👋</span>
      <p className="font-semibold text-text text-lg">Ya eres parte de {familyInfo?.name}</p>
      <p className="text-muted text-sm">Redirigiendo...</p>
    </div>
  )

  // state === 'valid' y no hay sesión
  return (
    <div className="min-h-screen flex flex-col max-w-sm mx-auto px-4 py-10">

      {/* Branding */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-light mb-4">
          <span className="text-3xl">🍽️</span>
        </div>
        <h1 className="text-3xl font-semibold text-accent">mesa.os</h1>
      </div>

      {/* Invitación */}
      <div className="card flex flex-col gap-5 text-center">
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Te invitaron a</p>
          <p className="text-2xl font-semibold text-text">{familyInfo?.name}</p>
          <p className="text-muted text-sm mt-1">
            Únete para ver recetas, la nevera y el menú familiar.
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button onClick={goToSignup} className="btn-primary">
            Crear cuenta y unirme
          </button>
          <button onClick={goToLogin} className="btn-ghost">
            Ya tengo cuenta — Entrar
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-muted mt-6">
        Esta invitación expira en {daysLeft(invite!.expires_at)} días
      </p>
    </div>
  )
}

function daysLeft(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

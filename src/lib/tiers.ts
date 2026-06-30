// ── Sistema de tiers (free / plus / pro) ─────────────────────────────────────
// Fase 1: tipos, super-usuario, contadores de uso, mantenimiento (trial + reset mensual).
// (Los LÍMITES y canUse() entran en la Fase 2.)

export type Tier = 'free' | 'plus' | 'pro'

// Super-usuarios: siempre Pro (implementado en código, no en BD).
export const SUPER_USERS = ['alesofiad@gmail.com']

export interface Desbloqueo { tipo: string; cantidad: number; fecha: string }

export interface UsoMes {
  generar_menu:   number
  chat_tita:      number
  importar_ia:    number
  fotos_nevera:   number
  cambios_receta: number
  lonchera:       number
  desbloqueos:    Desbloqueo[]
}

export const USO_DEFAULT: UsoMes = {
  generar_menu: 0, chat_tita: 0, importar_ia: 0,
  fotos_nevera: 0, cambios_receta: 0, lonchera: 0, desbloqueos: [],
}

interface FamilyTierFields {
  tier?: Tier
  tier_until?: string | null
  uso_mes?: UsoMes
  mes_reset?: string | null
}

/** Tier EFECTIVO: super-usuario siempre Pro; si no, el de la familia (o 'free'). */
export function tierEfectivo(family: FamilyTierFields | null, email?: string | null): Tier {
  if (email && SUPER_USERS.includes(email.toLowerCase())) return 'pro'
  return (family?.tier as Tier) ?? 'free'
}

/** Uso del mes con defaults (tolera que la columna no exista todavía). */
export function usoMes(family: FamilyTierFields | null): UsoMes {
  return { ...USO_DEFAULT, ...(family?.uso_mes ?? {}) }
}

/**
 * Calcula el "patch" de mantenimiento a aplicar al cargar la familia:
 *  - Trial Pro expirado (tier_until < ahora) → tier='free', tier_until=null.
 *  - Cambió de mes (mes_reset en mes anterior) → uso_mes reseteado, mes_reset=hoy.
 * Devuelve null si no hay nada que hacer. NO toca campos si la columna no existe
 * (para no romper antes de correr la migración SQL).
 */
export function patchMantenimientoTier(family: FamilyTierFields): Partial<FamilyTierFields> | null {
  const patch: Partial<FamilyTierFields> = {}
  const now = new Date()
  const hoy = now.toISOString().split('T')[0]                 // YYYY-MM-DD
  const primerDiaMes = `${hoy.slice(0, 7)}-01`                // YYYY-MM-01

  // Trial expirado (solo si la columna existe)
  if (family.tier === 'pro' && family.tier_until && new Date(family.tier_until) < now) {
    patch.tier = 'free'
    patch.tier_until = null
  }
  // Reset mensual (solo si la columna mes_reset existe y quedó en un mes anterior)
  if (family.mes_reset && family.mes_reset < primerDiaMes) {
    patch.uso_mes = { ...USO_DEFAULT }
    patch.mes_reset = hoy
  }
  return Object.keys(patch).length ? patch : null
}

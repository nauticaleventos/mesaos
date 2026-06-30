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

// ── Acciones y límites por tier ──────────────────────────────────────────────
export type Action =
  | 'generar_menu' | 'multi_semana' | 'chat_tita' | 'importar_ia' | 'fotos_nevera'
  | 'cambios_receta' | 'lonchera' | 'lonchera_personalizada' | 'meal_prep_completo'
  | 'dashboard_ahorro' | 'auto_renovar' | 'prediccion_inventario' | 'modo_presupuesto'
  | 'tita_ayuda'

// Acciones con CONTADOR mensual (las demás son features booleanas).
export const ACCIONES_CONTADAS = ['generar_menu', 'chat_tita', 'importar_ia', 'fotos_nevera', 'cambios_receta', 'lonchera'] as const

export const LIMITES: Record<Tier, Record<Action, number | boolean>> = {
  free: {
    generar_menu: 1, multi_semana: 0, chat_tita: 0, importar_ia: 10, fotos_nevera: 2,
    cambios_receta: 3, lonchera: 1, lonchera_personalizada: false, meal_prep_completo: false,
    dashboard_ahorro: false, auto_renovar: false, prediccion_inventario: false,
    modo_presupuesto: false, tita_ayuda: false,
  },
  plus: {
    generar_menu: 4, multi_semana: 0, chat_tita: 50, importar_ia: Infinity, fotos_nevera: 20,
    cambios_receta: Infinity, lonchera: Infinity, lonchera_personalizada: false, meal_prep_completo: false,
    dashboard_ahorro: false, auto_renovar: false, prediccion_inventario: false,
    modo_presupuesto: false, tita_ayuda: false,
  },
  pro: {
    generar_menu: Infinity, multi_semana: Infinity, chat_tita: Infinity, importar_ia: Infinity,
    fotos_nevera: Infinity, cambios_receta: Infinity, lonchera: Infinity, lonchera_personalizada: true,
    meal_prep_completo: true, dashboard_ahorro: true, auto_renovar: true, prediccion_inventario: true,
    modo_presupuesto: true, tita_ayuda: true,
  },
}

/** ¿Puede usar la acción? (features booleanas o contadores con uso actual). */
export function canUse(tier: Tier, action: Action, currentUse?: number): boolean {
  const limit = LIMITES[tier][action]
  if (typeof limit === 'boolean') return limit
  if (limit === Infinity) return true
  return (currentUse ?? 0) < limit
}

/** Límite numérico de una acción (incluye desbloqueos para Free.generar_menu). */
export function limiteDe(tier: Tier, action: Action, family?: FamilyTierFields | null): number {
  const base = LIMITES[tier][action]
  if (typeof base === 'boolean') return base ? Infinity : 0
  if (base === Infinity) return Infinity
  // Free puede sumar desbloqueos a generar_menu (Fase 5), tope +4 (total 5).
  if (tier === 'free' && action === 'generar_menu') {
    const extra = (family?.uso_mes?.desbloqueos ?? []).reduce((s, d) => s + (d.cantidad || 0), 0)
    return base + Math.min(4, extra)
  }
  return base
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

/** Días que quedan del trial Pro (0 si no hay trial vigente). */
export function diasRestantesTrial(family: FamilyTierFields | null): number {
  if (!family?.tier_until || family.tier !== 'pro') return 0
  const ms = new Date(family.tier_until).getTime() - Date.now()
  return ms > 0 ? Math.ceil(ms / (24 * 60 * 60 * 1000)) : 0
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

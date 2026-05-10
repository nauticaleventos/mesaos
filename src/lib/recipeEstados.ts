import { supabase } from './supabase'

export type EstadoReceta =
  | 'sugerida'
  | 'valorada_owner'
  | 'valorada_miembro'
  | 'probada_valorada'
  | 'conflicto'
  | 'excluida'
  | 'pasada'
  | 'sin_estado'

export interface EstadoInfo {
  estado:  EstadoReceta
  icono:   string
  label:   string
  tooltip: string
}

export const ESTADO_INFO: Record<EstadoReceta, EstadoInfo> = {
  sugerida:        { estado: 'sugerida',        icono: '💡', label: 'Sugerida',           tooltip: 'El owner cree que le puede gustar — aún no probada' },
  valorada_owner:  { estado: 'valorada_owner',  icono: '⭐', label: 'Valorada por owner',  tooltip: 'El owner la valoró a nombre del miembro' },
  valorada_miembro:{ estado: 'valorada_miembro',icono: '⭐⭐',label: 'Valorada por miembro',tooltip: 'El miembro mismo la valoró' },
  probada_valorada:{ estado: 'probada_valorada',icono: '🔥', label: 'Probada y valorada',  tooltip: 'Valorada luego de cocinarla' },
  conflicto:       { estado: 'conflicto',        icono: '⚠️', label: 'Conflicto',           tooltip: 'Owner y miembro discrepan ≥ 2 ⭐ — pendiente resolver' },
  excluida:        { estado: 'excluida',         icono: '🚫', label: 'Excluida',            tooltip: 'Valorada con ≤ 1 ⭐ — el motor la evita' },
  pasada:          { estado: 'pasada',           icono: '⏭️', label: 'Pasada',             tooltip: 'Descartada en exploración sin valorar' },
  sin_estado:      { estado: 'sin_estado',       icono: '⚪', label: 'Sin estado',          tooltip: 'Sin interacción registrada' },
}

export async function calcularEstadoReceta(recipeId: string, memberId: string): Promise<EstadoInfo> {
  const [{ data: reactions }, { data: suggestions }, { data: conflicts }] = await Promise.all([
    supabase.from('recipe_reactions').select('reaction, rating, source').eq('recipe_id', recipeId).eq('member_id', memberId),
    supabase.from('recipe_suggestions').select('status').eq('recipe_id', recipeId).eq('member_id', memberId).eq('status', 'pending'),
    supabase.from('rating_conflicts').select('resolution_status').eq('recipe_id', recipeId).eq('member_id', memberId).eq('resolution_status', 'pending'),
  ])

  // Conflicto activo
  if (conflicts && conflicts.length > 0) return ESTADO_INFO.conflicto

  if (!reactions || reactions.length === 0) {
    // Sin reacciones — ¿hay sugerencia?
    if (suggestions && suggestions.length > 0) return ESTADO_INFO.sugerida
    return ESTADO_INFO.sin_estado
  }

  const ratedReactions = reactions.filter(r => r.rating !== null && r.rating !== undefined)

  // Excluida (cualquier rating ≤ 1)
  if (ratedReactions.some(r => r.rating <= 1)) return ESTADO_INFO.excluida

  // Pasada (solo dislike sin rating)
  if (reactions.every(r => r.reaction === 'dislike' && !r.rating)) return ESTADO_INFO.pasada

  // Probada y valorada (source = cooked_postmeal)
  if (ratedReactions.some(r => r.source === 'cooked_postmeal')) return ESTADO_INFO.probada_valorada

  // Valorada por miembro (source = member_judgment)
  if (ratedReactions.some(r => r.source === 'member_judgment')) return ESTADO_INFO.valorada_miembro

  // Valorada por owner
  if (ratedReactions.some(r => r.source === 'owner_judgment' || r.source === 'chef_judgment')) return ESTADO_INFO.valorada_owner

  // Tiene rating pero sin source clasificado
  if (ratedReactions.length > 0) return ESTADO_INFO.valorada_owner

  if (suggestions && suggestions.length > 0) return ESTADO_INFO.sugerida
  return ESTADO_INFO.sin_estado
}

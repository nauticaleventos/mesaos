// GET /api/menu-compartido?token=xxx
// Devuelve el menú semanal para un token compartido válido (sin auth requerida)

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'token requerido' })

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)
    return res.status(500).json({ error: 'Config incompleta' })

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // 1. Verificar token
  const { data: shared } = await sb
    .from('shared_menus')
    .select('id, family_id, week_start, expires_at')
    .eq('token', token)
    .single()

  if (!shared) return res.status(404).json({ error: 'Link no encontrado' })
  if (new Date(shared.expires_at) < new Date())
    return res.status(410).json({ error: 'Este link expiró' })

  // 2. Incrementar vistas (usa la función definida en la migración 021)
  await sb.rpc('increment_shared_menu_views', { menu_id: shared.id }).catch(() => {})

  // 3. Cargar menú
  const { data: entries } = await sb
    .from('weekly_menu')
    .select('day_of_week, meal_type, meal_time, is_main_recipe, recipe_id, nombre_custom, status, member_id')
    .eq('family_id', shared.family_id)
    .eq('week_start', shared.week_start)
    .order('day_of_week')
    .order('meal_type')

  if (!entries?.length) return res.status(200).json({ entries: [], week_start: shared.week_start, family_id: shared.family_id })

  // 4. Cargar recetas
  const ids = [...new Set(entries.map(e => e.recipe_id).filter(Boolean))]
  const { data: recipes } = ids.length
    ? await sb.from('recipes').select('id, nombre, tiempo_total_min, porciones, ingredientes, pasos, imagen_url').in('id', ids)
    : { data: [] }
  const rMap = new Map((recipes ?? []).map(r => [r.id, r]))

  // 5. Cargar miembros
  const { data: members } = await sb
    .from('family_members')
    .select('id, name, emoji')
    .eq('family_id', shared.family_id)

  const enriched = entries.map(e => ({
    ...e,
    recipe: e.recipe_id ? rMap.get(e.recipe_id) ?? null : null,
  }))

  return res.status(200).json({
    entries:    enriched,
    week_start: shared.week_start,
    members:    members ?? [],
  })
}

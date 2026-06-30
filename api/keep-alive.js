/**
 * keep-alive.js
 *
 * Endpoint liviano para mantener ACTIVO el proyecto Supabase (free tier se pausa
 * tras ~7 días sin actividad). Hace una sola lectura mínima a la BD y responde 200.
 *
 * Lo pinguea cron-job.org (externo) — respaldo independiente de Vercel.
 * (El respaldo interno ya lo da el cron diario cron-alertas-preparacion, que
 *  también toca Supabase a las 08:00 UTC.)
 *
 * Sin efectos secundarios (solo lee), sin auth (es inofensivo). Tolera ambos
 * nombres de variable: SUPABASE_URL o VITE_SUPABASE_URL, service key o anon key.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ ok: false, error: 'Faltan variables de entorno de Supabase' })
  }
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_KEY)
    // Lectura mínima: 1 fila de recipes (suficiente para registrar actividad en la BD).
    const { error } = await sb.from('recipes').select('id').limit(1)
    if (error) {
      return res.status(500).json({ ok: false, error: error.message })
    }
    // Diagnóstico TEMPORAL (?diag=huevo): duplicados + desglose real de huevo en la semana.
    if (req.query && req.query.diag === 'huevo') {
      const fam = req.query.fam || '40b2b23b-481d-4524-b9ae-dc6a5786d901'
      const semana = req.query.semana || '2026-06-29'
      const wk = await sb.from('weekly_menu')
        .select('day_of_week, meal_type, meal_component, is_main_recipe, member_id, servings, recipe_id, recipes(nombre, porciones, ingredientes)')
        .eq('family_id', fam).eq('week_start', semana)
      const rows = wk.data || []
      // 1) Duplicados exactos (recipe_id, day, meal, member_id)
      const grupos = {}
      for (const r of rows) {
        const k = `${r.recipe_id}|${r.day_of_week}|${r.meal_type}|${r.member_id}`
        grupos[k] = (grupos[k] || 0) + 1
      }
      const duplicados = Object.entries(grupos).filter(([, c]) => c > 1).map(([k, c]) => ({ clave: k, veces: c }))
      // 2) Desglose de huevo (solo is_main_recipe, como buildItems/computeDesglose)
      const porReceta = {}
      let totalMain = 0, totalTodas = 0
      for (const r of rows) {
        const rec = r.recipes
        if (!rec) continue
        const scale = (rec.porciones && rec.porciones > 0) ? (r.servings || 1) / rec.porciones : 1
        const h = (rec.ingredientes || []).find(i => /huevo/i.test(i.nombre || '') && i.esencial)
        if (!h) continue
        const aporte = (Number(h.cantidad) || 1) * scale
        totalTodas += aporte
        if (r.is_main_recipe) {
          totalMain += aporte
          porReceta[rec.nombre] = (porReceta[rec.nombre] || 0) + aporte
        }
      }
      return res.status(200).json({
        ok: true, ts: new Date().toISOString(), familia: fam, semana,
        total_filas_semana: rows.length,
        filas_main_recipe: rows.filter(r => r.is_main_recipe).length,
        DUPLICADOS_recipe_day_meal_member: duplicados,
        huevo_total_main: Math.round(totalMain * 100) / 100,
        huevo_total_todas: Math.round(totalTodas * 100) / 100,
        huevo_por_receta: Object.fromEntries(Object.entries(porReceta).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      })
    }
    return res.status(200).json({ ok: true, ts: new Date().toISOString(), msg: 'Supabase activo' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

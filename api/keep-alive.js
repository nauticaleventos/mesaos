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
    // Modo diagnóstico TEMPORAL (?diag=mercado): inspecciona Carrot Cake + escalado + cantidades absurdas.
    if (req.query && req.query.diag === 'mercado') {
      // 1) La receta Carrot Cake
      const cc = await sb.from('recipes')
        .select('id, nombre, porciones, ingredientes')
        .ilike('nombre', '%carrot%cake%')
      // 2) Ocurrencias en weekly_menu (todas las familias/semanas) con servings
      const ccIds = (cc.data || []).map(r => r.id)
      let ocurrencias = []
      if (ccIds.length) {
        const wm = await sb.from('weekly_menu')
          .select('family_id, week_start, servings, is_main_recipe, meal_component, recipe_id')
          .in('recipe_id', ccIds)
        ocurrencias = wm.data || []
      }
      // 3) Escaneo de cantidades absurdas (cualquier ingrediente con cantidad > 50, o huevo > 12)
      const all = await sb.from('recipes').select('id, nombre, porciones, ingredientes').limit(500)
      const sospechosas = []
      for (const r of (all.data || [])) {
        for (const ing of (r.ingredientes || [])) {
          const c = Number(ing.cantidad)
          const esHuevo = /huevo/i.test(ing.nombre || '')
          if ((!isNaN(c) && c > 50) || (esHuevo && c > 12)) {
            sospechosas.push({ receta: r.nombre, porciones: r.porciones, ingrediente: ing.nombre, cantidad: ing.cantidad, unidad: ing.unidad })
          }
        }
      }
      // 4) Desglose de HUEVO en la semana actual de la familia con el menú
      const fam = req.query.fam || '40b2b23b-481d-4524-b9ae-dc6a5786d901'
      const semana = req.query.semana || '2026-06-29'
      const wk = await sb.from('weekly_menu')
        .select('day_of_week, meal_type, meal_component, is_main_recipe, servings, recipe_id, recipes(nombre, porciones, ingredientes)')
        .eq('family_id', fam).eq('week_start', semana).eq('is_main_recipe', true)
      const huevoBreakdown = []
      let huevoTotal = 0
      for (const e of (wk.data || [])) {
        const r = e.recipes
        if (!r) continue
        const scale = (r.porciones && r.porciones > 0) ? (e.servings || 1) / r.porciones : 1
        const huevoIng = (r.ingredientes || []).find(i => /huevo/i.test(i.nombre || '') && i.esencial)
        if (huevoIng) {
          const aporte = (Number(huevoIng.cantidad) || 1) * scale
          huevoTotal += aporte
          huevoBreakdown.push({ dia: e.day_of_week, comida: e.meal_type, receta: r.nombre, porciones: r.porciones, servings: e.servings, scale: Math.round(scale*100)/100, huevo_receta: huevoIng.cantidad, aporte: Math.round(aporte*100)/100 })
        }
      }
      return res.status(200).json({
        ok: true, ts: new Date().toISOString(),
        carrot_cake: (cc.data || []).map(r => ({ id: r.id, nombre: r.nombre, porciones: r.porciones })),
        ocurrencias_carrot_cake: ocurrencias,
        semana_analizada: semana, familia: fam,
        huevo_total_semana: Math.round(huevoTotal*100)/100,
        huevo_desglose_por_receta: huevoBreakdown,
        total_recetas_con_cantidades_grandes: sospechosas.length,
      })
    }
    return res.status(200).json({ ok: true, ts: new Date().toISOString(), msg: 'Supabase activo' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

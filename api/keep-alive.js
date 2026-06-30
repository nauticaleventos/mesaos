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
      return res.status(200).json({
        ok: true, ts: new Date().toISOString(),
        carrot_cake: (cc.data || []).map(r => ({ id: r.id, nombre: r.nombre, porciones: r.porciones, ingredientes: r.ingredientes })),
        ocurrencias_en_weekly_menu: ocurrencias,
        recetas_con_cantidades_sospechosas: sospechosas.slice(0, 40),
        total_sospechosas: sospechosas.length,
      })
    }
    return res.status(200).json({ ok: true, ts: new Date().toISOString(), msg: 'Supabase activo' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

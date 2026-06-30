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
    // Diagnóstico TEMPORAL (?diag=ajo): variantes de "ajo" en el menú de la semana.
    if (req.query && req.query.diag === 'ajo') {
      const fam = req.query.fam || '40b2b23b-481d-4524-b9ae-dc6a5786d901'
      const semana = req.query.semana || '2026-06-29'
      const wk = await sb.from('weekly_menu')
        .select('recipe_id, is_main_recipe, recipes(nombre, ingredientes)')
        .eq('family_id', fam).eq('week_start', semana).eq('is_main_recipe', true)
      const variantes = {}
      for (const r of (wk.data || [])) {
        const rec = r.recipes
        if (!rec) continue
        for (const ing of (rec.ingredientes || [])) {
          if (/ajo/i.test(ing.nombre || '')) {
            const key = `${ing.nombre} [${ing.unidad}] esencial=${ing.esencial}`
            variantes[key] = (variantes[key] || 0) + 1
          }
        }
      }
      return res.status(200).json({ ok: true, ts: new Date().toISOString(), variantes_de_ajo: variantes })
    }
    return res.status(200).json({ ok: true, ts: new Date().toISOString(), msg: 'Supabase activo' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

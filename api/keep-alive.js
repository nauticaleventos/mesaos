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
    // Modo diagnóstico temporal (?diag=1): conteo real saltando RLS (service key).
    if (req.query && req.query.diag) {
      const total = await sb.from('recipes').select('id', { count: 'exact', head: true })
      const activas = await sb.from('recipes').select('id', { count: 'exact', head: true })
        .eq('is_active_for_menu', true).not('tipo_comida', 'is', null)
      return res.status(200).json({
        ok: true, ts: new Date().toISOString(),
        usandoServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
        recipes_total: total.count, recipes_activas_para_menu: activas.count,
      })
    }
    return res.status(200).json({ ok: true, ts: new Date().toISOString(), msg: 'Supabase activo' })
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

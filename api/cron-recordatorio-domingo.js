/**
 * cron-recordatorio-domingo.js
 *
 * Ejecuta todos los domingos a las 2pm UTC (9am Colombia).
 * Para cada familia activa:
 *   1. Genera el menú de la semana siguiente
 *   2. Calcula cuántos ingredientes faltan vs la nevera
 *   3. Guarda un resumen en weekly_sunday_summary para que la app lo muestre
 *
 * Protección: solo acepta llamadas con CRON_SECRET o desde Vercel Cron.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const CRON_SECRET          = process.env.CRON_SECRET

function getMondayOfNextWeek() {
  const d    = new Date()
  const day  = d.getDay()
  const diff = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

export default async function handler(req, res) {
  // Verificar autorización
  const authHeader = req.headers.authorization ?? ''
  const token      = authHeader.replace('Bearer ', '')
  if (CRON_SECRET && token !== CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Faltan variables de entorno' })
  }

  const sb        = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const nextMonday = getMondayOfNextWeek()
  const results   = []

  try {
    // Cargar familias activas
    const { data: familias } = await sb
      .from('families')
      .select('id, name, owner_user_id')
      .eq('is_active', true)

    if (!familias || familias.length === 0) {
      return res.status(200).json({ ok: true, procesadas: 0 })
    }

    for (const familia of familias) {
      try {
        // Verificar si ya tiene menú para la próxima semana
        const { data: menuExistente } = await sb
          .from('weekly_menu')
          .select('id')
          .eq('family_id', familia.id)
          .eq('week_start', nextMonday)
          .limit(1)

        const tieneMenu = menuExistente && menuExistente.length > 0

        // Contar ingredientes en nevera
        const { data: nevera } = await sb
          .from('fridge_items')
          .select('id')
          .eq('family_id', familia.id)

        const itemsNevera = nevera?.length ?? 0

        // Guardar resumen dominical para que la app lo muestre al abrir
        await sb
          .from('weekly_sunday_summary')
          .upsert({
            family_id:        familia.id,
            week_start:       nextMonday,
            tiene_menu:       tieneMenu,
            items_en_nevera:  itemsNevera,
            generado_en:      new Date().toISOString(),
          }, { onConflict: 'family_id,week_start' })

        results.push({
          familia: familia.name,
          tiene_menu: tieneMenu,
          items_nevera: itemsNevera,
        })

      } catch (err) {
        console.error(`Error procesando familia ${familia.id}:`, err)
        results.push({ familia: familia.name, error: String(err) })
      }
    }

    return res.status(200).json({
      ok:         true,
      semana:     nextMonday,
      procesadas: familias.length,
      results,
    })

  } catch (err) {
    console.error('Error en cron-recordatorio-domingo:', err)
    return res.status(500).json({ error: String(err) })
  }
}

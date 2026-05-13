/**
 * cron-alertas-preparacion.js
 *
 * Corre cada hora. Genera alertas de preparación para el día siguiente:
 * - Descongelar proteínas si el próximo día no es de cocción
 * - Remojar legumbres si las hay en el menú
 * - Recordatorio de planificación el día antes de un día de cocción
 *
 * Vercel schedule: "0 * * * *"
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const CRON_SECRET          = process.env.CRON_SECRET

function getMañanaISO() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function getDiaSemana(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const js = d.getDay() // 0=dom
  return js === 0 ? 7 : js
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization ?? ''
  const token      = authHeader.replace('Bearer ', '')
  if (CRON_SECRET && token !== CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado' })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Faltan variables de entorno' })
  }

  const sb         = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const mañana     = getMañanaISO()
  const diaSemana  = getDiaSemana(mañana)
  const alertasCreadas = []

  try {
    // Cargar familias activas con config de cocción
    const { data: configs } = await sb
      .from('menu_config')
      .select('family_id, dias_coccion')
      .not('family_id', 'is', null)

    for (const cfg of (configs ?? [])) {
      const { family_id, dias_coccion } = cfg
      const esMañanaCoccion = (dias_coccion ?? []).includes(diaSemana)

      // Cargar owner de la familia
      const { data: familia } = await sb
        .from('families')
        .select('owner_user_id')
        .eq('id', family_id)
        .single()
      if (!familia?.owner_user_id) continue

      const fechaAlerta20h = new Date(`${mañana}T01:00:00.000Z`) // 8pm Colombia = 01:00 UTC
      const fechaAlerta8am = new Date(`${mañana}T13:00:00.000Z`) // 8am Colombia = 13:00 UTC

      // 1. Día antes de cocción → alerta planificación
      const hoy = new Date()
      const hoyDia = hoy.getDay() === 0 ? 7 : hoy.getDay()
      const mañanaDia = diaSemana
      const esAntesDeCoccion = !(dias_coccion ?? []).includes(hoyDia) && (dias_coccion ?? []).includes(mañanaDia)

      if (esAntesDeCoccion) {
        await sb.from('preparation_alerts').insert({
          family_id,
          user_id:      familia.owner_user_id,
          tipo:         'planificar',
          mensaje:      '🔪 Mañana es tu día de cocción. ¿Querés revisar el menú y la lista de mercado?',
          fecha_alerta: fechaAlerta20h.toISOString(),
        })
        alertasCreadas.push({ family_id, tipo: 'planificar' })
      }

      // 2. Si mañana NO es día de cocción, buscar proteínas en el menú del día siguiente
      if (!(dias_coccion ?? []).includes(diaSemana) && (dias_coccion ?? []).length > 0) {
        const { data: menuMañana } = await sb
          .from('weekly_menu')
          .select('recipe_id, meal_component, recipes(nombre, ingredientes)')
          .eq('family_id', family_id)
          .eq('day_of_week', diaSemana)
          .in('meal_component', ['proteina', 'completo'])
          .eq('is_main_recipe', true)
          .limit(3)

        for (const entry of (menuMañana ?? [])) {
          const ings = (entry.recipes?.ingredientes ?? []).map(i => i.nombre?.toLowerCase() ?? '')
          const tieneCongelado = ings.some(n => n.includes('congelad') || n.includes('frozen'))
          const tieneLegumbre = ings.some(n =>
            ['frijol', 'lenteja', 'garbanzo', 'arveja', 'habichuela'].some(l => n.includes(l))
          )

          if (tieneCongelado) {
            await sb.from('preparation_alerts').insert({
              family_id,
              user_id:      familia.owner_user_id,
              tipo:         'descongelar',
              mensaje:      `🧊 Sacá ${entry.recipes?.nombre ?? 'la proteína'} del congelador esta noche para descongelar para mañana`,
              fecha_alerta: fechaAlerta20h.toISOString(),
            })
            alertasCreadas.push({ family_id, tipo: 'descongelar' })
          }

          if (tieneLegumbre) {
            await sb.from('preparation_alerts').insert({
              family_id,
              user_id:      familia.owner_user_id,
              tipo:         'remojar',
              mensaje:      `🫘 Poné las legumbres en remojo esta noche para el almuerzo de mañana`,
              fecha_alerta: fechaAlerta20h.toISOString(),
            })
            alertasCreadas.push({ family_id, tipo: 'remojar' })
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      mañana,
      alertas_creadas: alertasCreadas.length,
      detalle: alertasCreadas,
    })

  } catch (err) {
    console.error('cron-alertas-preparacion error:', err)
    return res.status(500).json({ error: String(err) })
  }
}

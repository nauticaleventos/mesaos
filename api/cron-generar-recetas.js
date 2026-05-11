/**
 * cron-generar-recetas.js
 *
 * Endpoint serverless que se ejecuta el día 1 de cada mes (cron de Vercel).
 * Analiza cuántos usuarios tienen cada condición de salud y genera recetas
 * nuevas proporcionalmente usando Claude API.
 *
 * PROTECCIÓN: solo acepta llamadas con CRON_SECRET o desde Vercel Cron.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const ANTHROPIC_API_KEY    = process.env.ANTHROPIC_API_KEY
const CRON_SECRET          = process.env.CRON_SECRET

// ── Mapeo condición → filtros requeridos (duplicado del cliente para el endpoint) ──
const MAPEO = {
  anemia:               ['alto_proteina'],
  celiaquia:            ['sin_gluten'],
  colesterol_alto:      ['bajo_grasa', 'alta_fibra'],
  diabetes:             ['bajo_azucar', 'bajo_carbohidratos', 'alta_fibra'],
  gota:                 ['bajo_purinas'],
  higado_graso:         ['bajo_grasa', 'bajo_azucar'],
  hipertension:         ['bajo_sodio'],
  intolerancia_lactosa: ['sin_lacteos'],
  renal:                ['bajo_potasio', 'bajo_sodio'],
  reflujo:              ['bajo_grasa'],
  sobrepeso:            ['bajo_carbohidratos', 'alta_fibra'],
  tdah:                 ['alta_fibra', 'alto_proteina'],
}

const NOMBRES_CONDICION = {
  anemia:               'anemia',
  celiaquia:            'celiaquía',
  colesterol_alto:      'colesterol alto',
  diabetes:             'diabetes tipo 2',
  gota:                 'gota',
  higado_graso:         'hígado graso no alcohólico',
  hipertension:         'hipertensión arterial',
  intolerancia_lactosa: 'intolerancia a la lactosa',
  renal:                'enfermedad renal crónica',
  reflujo:              'reflujo gastroesofágico',
  sobrepeso:            'sobrepeso u obesidad',
  tdah:                 'TDAH (déficit de atención)',
}

const MAX_RECETAS_POR_CONDICION = 50
const TOPE_RECETAS_EN_BD = 200

function buildPrompt(condicion, filtros) {
  const nombre = NOMBRES_CONDICION[condicion] ?? condicion
  const filtrosTexto = filtros.map(f => {
    const mapa = {
      bajo_azucar: 'azúcar_g ≤ 5 por porción',
      bajo_carbohidratos: 'carbohidratos_g ≤ 30 por porción',
      alta_fibra: 'fibra_g ≥ 5 por porción',
      bajo_sodio: 'sodio_mg ≤ 600 por porción',
      alto_proteina: 'proteina_g ≥ 20 por porción',
      bajo_grasa: 'grasa_g ≤ 10 por porción',
      sin_gluten: 'sin ingredientes con gluten',
      sin_lacteos: 'sin ingredientes lácteos',
      bajo_potasio: 'sin plátano, papa, tomate en grandes cantidades',
      bajo_purinas: 'sin vísceras, mariscos, carnes rojas en exceso',
    }
    return mapa[f] ?? f
  }).join('\n')

  return `Generá UNA receta colombiana auténtica para alguien con ${nombre}.

REQUISITOS NUTRICIONALES ESTRICTOS (verificar antes de responder):
${filtrosTexto}

PRIORIDADES:
- Cocina latina/colombiana primero (sancocho, ajiaco, frijoles, lentejas con sabor local)
- Ingredientes accesibles en supermercados de Colombia
- Tiempo de preparación máximo 60 minutos
- Porciones para 4 personas
- Dificultad: fácil o media

DEVOLVÉ ESTRICTAMENTE EN JSON VÁLIDO (sin texto antes ni después):

{
  "nombre": "string",
  "descripcion_corta": "string (max 100 chars)",
  "origen": "colombiana",
  "tipo_componente": "proteina_principal | guarnicion | ensalada | salsa | vinagreta | postre | bebida | merienda | plato_unico",
  "tipo_comida": ["almuerzo"],
  "dificultad": "facil | media",
  "porciones": 4,
  "tiempo_total_min": 0,
  "costo_estimado": "$",
  "ingredientes": [
    {"nombre": "string", "cantidad": 0, "unidad": "g", "categoria": "proteina_animal", "esencial": true}
  ],
  "pasos": ["paso 1", "paso 2"],
  "info_nutricional_aprox": {
    "calorias_porcion": 0,
    "proteina_g": 0,
    "carbohidratos_g": 0,
    "grasa_g": 0,
    "sodio_mg": 0,
    "azucar_g": 0,
    "fibra_g": 0
  },
  "perfiles": {
    "ninos": false,
    "vegetariana": false,
    "deficit_calorico": false,
    "embarazadas": false,
    "adultos_mayores": false,
    "keto": false
  },
  "filtros_nutricionales": {
    "bajo_sodio": false,
    "bajo_azucar": false,
    "alto_proteina": false,
    "bajo_carbohidratos": false,
    "alta_fibra": false,
    "sin_gluten": false,
    "sin_lacteos": false,
    "bajo_grasa": false,
    "bajo_potasio": false,
    "bajo_purinas": false
  },
  "tags": ["string"]
}`
}

async function generarReceta(condicion, filtros) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages:   [{ role: 'user', content: buildPrompt(condicion, filtros) }],
    }),
  })

  if (!resp.ok) throw new Error(`Anthropic error ${resp.status}`)
  const data = await resp.json()
  const text = data.content?.[0]?.text ?? ''

  // Extraer JSON del texto
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in response')
  return JSON.parse(match[0])
}

function validarReceta(receta, filtrosRequeridos) {
  if (!receta.nombre || receta.nombre.length < 3) return 'nombre inválido'
  if (!Array.isArray(receta.ingredientes) || receta.ingredientes.length < 3) return 'menos de 3 ingredientes'
  if (!Array.isArray(receta.pasos) || receta.pasos.length < 2) return 'menos de 2 pasos'

  // Verificar filtros requeridos están en true
  for (const f of filtrosRequeridos) {
    if (receta.filtros_nutricionales?.[f] !== true) {
      return `filtro ${f} no está en true`
    }
  }

  // Coherencia básica de macros
  const n = receta.info_nutricional_aprox
  if (n) {
    if (receta.filtros_nutricionales?.bajo_azucar && n.azucar_g > 10) return 'azucar_g inconsistente'
    if (receta.filtros_nutricionales?.bajo_sodio   && n.sodio_mg  > 800) return 'sodio_mg inconsistente'
  }

  return null // válida
}

export default async function handler(req, res) {
  // Verificar autorización
  const auth = req.headers.authorization ?? req.headers['x-cron-secret'] ?? ''
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}` && auth !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!ANTHROPIC_API_KEY || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Variables de entorno faltantes' })
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const hoy = new Date().toISOString().split('T')[0]

  console.log(`[cron] Iniciando generación de recetas — ${hoy}`)

  // 1. Contar usuarios por condición
  const { data: miembros } = await sb
    .from('family_members')
    .select('condiciones_salud')
    .not('condiciones_salud', 'eq', '{}')

  const conteoCondicion = {}
  for (const m of miembros ?? []) {
    for (const c of (m.condiciones_salud ?? [])) {
      conteoCondicion[c] = (conteoCondicion[c] ?? 0) + 1
    }
  }

  console.log('[cron] Conteo de condiciones:', conteoCondicion)

  const resultados = []

  for (const [condicion, usuarios] of Object.entries(conteoCondicion)) {
    const filtros = MAPEO[condicion]
    if (!filtros) continue  // condición sin mapeo

    // Calcular cuántas recetas generar (al menos 5, escala con usuarios)
    const cantidadObjetivo = Math.min(
      MAX_RECETAS_POR_CONDICION,
      Math.max(5, Math.floor(usuarios / 20))
    )

    // Verificar tope en BD
    const { count: yaExisten } = await sb
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .contains('tags', [condicion])

    if ((yaExisten ?? 0) >= TOPE_RECETAS_EN_BD) {
      console.log(`[cron] ${condicion}: ya tiene ${yaExisten} recetas, saltando`)
      continue
    }

    let generadas = 0
    let costoTotal = 0
    const errores = []

    for (let i = 0; i < cantidadObjetivo; i++) {
      try {
        const receta = await generarReceta(condicion, filtros)

        // Validar
        const errorValidacion = validarReceta(receta, filtros)
        if (errorValidacion) {
          errores.push(`${receta.nombre}: ${errorValidacion}`)
          continue
        }

        // Verificar nombre duplicado
        const { data: existe } = await sb
          .from('recipes')
          .select('id')
          .ilike('nombre', receta.nombre.trim())
          .limit(1)

        if (existe && existe.length > 0) {
          errores.push(`${receta.nombre}: duplicado`)
          continue
        }

        // INSERT
        const { error: insertError } = await sb.from('recipes').insert({
          ...receta,
          nombre:              receta.nombre.trim(),
          visibility:          'public',
          is_active_for_menu:  true,
          is_base_recipe:      true,
          source:              'auto_generada',
          tags:                [...(receta.tags ?? []), condicion],
          generation_metadata: { condicion, fecha: hoy, modelo: 'claude-haiku' },
        })

        if (insertError) {
          errores.push(`INSERT error: ${insertError.message}`)
          continue
        }

        generadas++
        costoTotal += 0.003  // estimado por haiku call (~$0.003)

      } catch (e) {
        errores.push(e instanceof Error ? e.message : String(e))
      }
    }

    // Registrar en log
    await sb.from('auto_generated_recipes_log').insert({
      fecha_generacion:       hoy,
      condicion,
      usuarios_con_condicion: usuarios,
      recetas_generadas:      generadas,
      costo_estimado:         costoTotal,
    })

    resultados.push({ condicion, usuarios, generadas, errores: errores.length, costoTotal })
    console.log(`[cron] ${condicion}: ${generadas}/${cantidadObjetivo} generadas, ${errores.length} errores`)
  }

  const totalGeneradas = resultados.reduce((s, r) => s + r.generadas, 0)
  const costoTotal     = resultados.reduce((s, r) => s + r.costoTotal, 0)

  console.log(`[cron] Completado: ${totalGeneradas} recetas, $${costoTotal.toFixed(4)}`)

  return res.status(200).json({
    fecha: hoy,
    resultados,
    totalGeneradas,
    costoTotal: costoTotal.toFixed(4),
  })
}

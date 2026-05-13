/**
 * POST /api/calcular-nutricion
 *
 * Calcula macros, filtros nutricionales y perfiles para una receta.
 * Se usa como fallback cuando la importación no devuelve nutrición,
 * o cuando el usuario toca "Calcular nutrición" en el detalle.
 *
 * Body: { nombre, porciones, ingredientes: [{nombre, cantidad, unidad, categoria}] }
 * Response: { info_nutricional_aprox, filtros_nutricionales, perfiles }
 */

async function callClaude(apiKey, receta) {
  const lineasIng = (receta.ingredientes ?? [])
    .filter(i => i.nombre)
    .map(i => `- ${i.cantidad ?? ''}${i.unidad ? ' ' + i.unidad : ''} ${i.nombre}`)
    .join('\n') || '(sin ingredientes)'

  const prompt = `Calculá la información nutricional aproximada POR PORCIÓN para esta receta.

Nombre: ${receta.nombre}
Porciones: ${receta.porciones ?? 4}
Ingredientes:
${lineasIng}

Devolvé SOLO este JSON exacto, sin texto adicional:
{
  "calorias_porcion": number,
  "proteina_g": number,
  "carbohidratos_g": number,
  "grasa_g": number,
  "sodio_mg": number,
  "azucar_g": number,
  "fibra_g": number
}

Reglas:
- Valores POR PORCIÓN, no totales
- "sal al gusto" → estimar 300-600 mg sodio
- Si no tenés suficiente info, estimá conservadoramente
- Sin markdown, SOLO el JSON`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',  // haiku es suficiente para cálculo numérico
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Claude error ${res.status}`)
  return data.content?.[0]?.text ?? '{}'
}

function calcularFiltros(macros, ingredientes) {
  const ings = (ingredientes ?? []).map(i => (i.nombre ?? '').toLowerCase())

  const tieneGluten = ['trigo', 'harina', 'pan', 'pasta', 'cebada', 'centeno', 'semola', 'avena']
    .some(g => ings.some(n => n.includes(g)))

  const tieneLacteos = ['leche', 'queso', 'yogur', 'crema', 'mantequilla', 'suero', 'lacto']
    .filter(l => !['vegetal', 'almendra', 'coco', 'soya', 'avena'].some(ok => l.includes(ok)))
    .some(l => ings.some(n => n.includes(l) &&
      !n.includes('almendra') && !n.includes('coco') && !n.includes('soya')))

  const tieneAltoPotasio = ['papa', 'banano', 'plátano', 'platano', 'espinaca', 'aguacate']
    .some(p => ings.some(n => n.includes(p)))

  const tieneAltoPurinas = ['hígado', 'higado', 'riñón', 'rinon', 'anchoa', 'sardina', 'viscera']
    .some(p => ings.some(n => n.includes(p)))

  return {
    bajo_sodio:         (macros.sodio_mg ?? 999) <= 600,
    bajo_azucar:        (macros.azucar_g ?? 99) <= 5,
    bajo_carbohidratos: (macros.carbohidratos_g ?? 99) <= 20,
    alto_proteina:      (macros.proteina_g ?? 0) >= 20,
    alta_fibra:         (macros.fibra_g ?? 0) >= 5,
    bajo_grasa:         (macros.grasa_g ?? 99) <= 10,
    sin_gluten:         !tieneGluten,
    sin_lacteos:        !tieneLacteos,
    bajo_potasio:       !tieneAltoPotasio,
    bajo_purinas:       !tieneAltoPurinas,
  }
}

function calcularPerfiles(macros, ingredientes, dificultad) {
  const ings       = ingredientes ?? []
  const ingsNorm   = ings.map(i => (i.nombre ?? '').toLowerCase())

  const tieneProtAnimal = ings.some(i =>
    i.categoria === 'proteina_animal' || i.categoria === 'embutido'
  )
  const tienePicante = ['ají', 'chile', 'jalapeño', 'cayena', 'picante']
    .some(p => ingsNorm.some(n => n.includes(p)))
  const tieneAlcohol = ['vino', 'cerveza', 'ron', 'aguardiente', 'tequila']
    .some(a => ingsNorm.some(n => n.includes(a)))
  const tieneRiesgosEmbarazo = ['sushi', 'carpaccio', 'ostras', 'ceviche crudo']
    .some(r => ingsNorm.some(n => n.includes(r)))

  return {
    vegetariana:      !tieneProtAnimal,
    keto:             (macros.carbohidratos_g ?? 99) <= 15 && (macros.proteina_g ?? 0) >= 15,
    ninos:            dificultad !== 'dificil' && !tienePicante && !tieneAlcohol,
    embarazadas:      !tieneRiesgosEmbarazo && !tieneAlcohol,
    adultos_mayores:  dificultad === 'facil',
    deficit_calorico: (macros.calorias_porcion ?? 999) <= 400,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

  const { nombre, porciones, ingredientes, dificultad } = req.body
  if (!nombre) return res.status(400).json({ error: 'nombre es requerido' })

  try {
    const text   = await callClaude(apiKey, { nombre, porciones, ingredientes })
    const match  = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Claude no devolvió JSON')

    const macros  = JSON.parse(match[0])
    const filtros = calcularFiltros(macros, ingredientes)
    const perfiles = calcularPerfiles(macros, ingredientes, dificultad)

    return res.status(200).json({
      info_nutricional_aprox: macros,
      filtros_nutricionales:  filtros,
      perfiles,
    })
  } catch (err) {
    console.error('calcular-nutricion error:', err)
    return res.status(500).json({ error: err.message })
  }
}

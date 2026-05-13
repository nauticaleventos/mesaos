/**
 * POST /api/import-pdf
 *
 * Recibe un PDF en base64, usa Claude para extraer 1 o más recetas.
 * Responde con array de RecipeImport.
 *
 * Body: { pdfBase64: string }
 */

const SYSTEM_PROMPT = `Sos un asistente experto en extracción de recetas culinarias para familias latinoamericanas.

Analizá el documento PDF y extraé TODAS las recetas que encuentres.

REGLAS:
1. Extraé SOLO lo que está en el PDF. No inventes ingredientes ni pasos.
2. Si no podés leer un dato con certeza, usá null.
3. Traducí todo al español latinoamericano.
4. Si hay UNA sola receta, devolvé un array con un elemento.
5. Si hay VARIAS recetas, devolvé todas en el array.
6. Respondé SOLO con JSON válido: un array []. Sin markdown, sin explicaciones.

CATEGORÍAS DE INGREDIENTES: proteina_animal | embutido | lacteo | vegetal | fruta | grano | legumbre | condimento | bebida | snack | otro

PERFILES:
- vegetariana: true si NO contiene carne, pollo, pescado, mariscos ni embutidos
- ninos: true si no es muy picante, sin alcohol
- keto: true si carbohidratos_g ≤ 15 Y grasa_g ≥ 25`

const RECIPE_SCHEMA = `{
  "nombre": "string",
  "descripcion_corta": "string|null",
  "origen": "string|null",
  "tipo_comida": ["desayuno|almuerzo|cena|snack|postre|bebida"],
  "tiempo_total_min": 0,
  "dificultad": "facil|media|dificil|null",
  "porciones": 4,
  "ingredientes": [{ "nombre": "string", "categoria": "string", "cantidad": 0, "unidad": "string|null", "esencial": true }],
  "pasos": ["string"],
  "tags": ["string"],
  "info_nutricional_aprox": { "calorias_porcion": 0, "proteina_g": 0, "carbohidratos_g": 0, "grasa_g": 0, "sodio_mg": null, "azucar_g": null, "fibra_g": null },
  "perfiles": { "ninos": false, "vegetariana": false, "keto": false }
}`

async function callClaude(apiKey, pdfBase64) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: `${SYSTEM_PROMPT}\n\nFormato de salida: array JSON con esta estructura por receta:\n${RECIPE_SCHEMA}`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          },
          {
            type: 'text',
            text: 'Extraé todas las recetas de este PDF y devolvelas como array JSON. Si hay una sola receta, devolvé [recipe]. Si hay varias, devolvé todas.',
          },
        ],
      }],
    }),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Claude error ${res.status}`)
  return data.content?.[0]?.text ?? '[]'
}

function parseRecipesJSON(text) {
  // Buscar array JSON en la respuesta
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) {
    // Intentar como objeto único → envolver en array
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) return [JSON.parse(objMatch[0])]
    throw new Error('Claude no devolvió JSON válido')
  }
  return JSON.parse(match[0])
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

  const { pdfBase64 } = req.body
  if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 es requerido' })

  // Validar que no sea demasiado grande (max ~20MB en base64 ≈ 15MB PDF)
  if (pdfBase64.length > 20_000_000) {
    return res.status(400).json({ error: 'El PDF es demasiado grande (máx 15MB)' })
  }

  try {
    const text    = await callClaude(apiKey, pdfBase64)
    const recipes = parseRecipesJSON(text)
    return res.status(200).json({ recipes })
  } catch (err) {
    console.error('import-pdf error:', err)
    return res.status(500).json({ error: err.message || 'Error procesando el PDF' })
  }
}

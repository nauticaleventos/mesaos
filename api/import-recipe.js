// POST /api/import-recipe
// Maneja los 5 tipos de importación de recetas

const SYSTEM_PROMPT = `Sos un asistente experto en extracción de recetas culinarias para familias latinoamericanas, especialmente colombianas.

Tu trabajo es analizar el contenido y extraer la receta de forma precisa y estructurada en JSON, siguiendo EXACTAMENTE el formato de la app mesa.os.

REGLAS ESTRICTAS:
1. Extraé SOLO lo que está en el contenido. No inventes ingredientes ni pasos.
2. Si no podés leer un dato con certeza, usá null — nunca inventes.
3. Traducí todo al español latinoamericano si está en otro idioma.
4. Convertí medidas al sistema métrico cuando sea posible.
5. Identificá el nombre REAL de la receta — no el título del post ni del usuario.
6. Separá claramente ingredientes de instrucciones.
7. Estimá macros SOLO con suficiente info de ingredientes. Si no, calculá razonablemente.
8. Categorizá cada ingrediente correctamente según las categorías permitidas.
9. CALCULÁ automáticamente los perfiles y filtros nutricionales según las reglas dadas.
10. Respondé SOLO con JSON válido. Sin markdown, sin explicaciones.

CATEGORÍAS DE INGREDIENTES PERMITIDAS:
proteina_animal | embutido | lacteo | vegetal | fruta | grano | legumbre | condimento | bebida | snack | otro

REGLAS PARA "perfiles":
- ninos: true si NO es muy picante, NO tiene alcohol, presentación familiar.
- vegetariana: true si NO contiene carne, pollo, pescado, mariscos ni embutidos.
- deficit_calorico: true si calorias_porcion ≤ 450 Y proteina_g ≥ 10.
- embarazadas: true si NO tiene mariscos crudos, pescado crudo, lácteos no pasteurizados, alcohol.
- adultos_mayores: true si textura suave, fácil masticar, no muy picante.
- keto: true si carbohidratos_g ≤ 15 Y grasa_g ≥ 25.

REGLAS PARA "filtros_nutricionales":
- bajo_sodio: sodio_mg ≤ 600
- bajo_azucar: azucar_g ≤ 5
- alto_proteina: proteina_g ≥ 25
- bajo_carbohidratos: carbohidratos_g ≤ 20
- alta_fibra: fibra_g ≥ 6
- sin_gluten: sin trigo, harina común, pasta, pan, galletas, cuscús, sémola, cebada, centeno
- sin_lacteos: sin leche, queso, mantequilla, crema, yogur
- bajo_grasa: grasa_g ≤ 10
- bajo_potasio: sin papa, plátano, tomate, espinaca, aguacate como ingredientes principales
- bajo_purinas: sin vísceras, mariscos, sardinas, anchoas, caldos concentrados`

const OUTPUT_FORMAT = `{
  "nombre": "nombre real de la receta",
  "descripcion_corta": "descripción corta de máx 80 caracteres",
  "origen": "ej: colombiana costeña, italiana, mexicana",
  "tipo_comida": ["desayuno|almuerzo|cena|snack|postre|bebida|brunch"],
  "ocasion": ["entre_semana|fin_semana|rapida|especial|reunion|tradicional"],
  "tiempo_total_min": 30,
  "tiempo_preparacion_min": 10,
  "tiempo_coccion_min": 20,
  "dificultad": "facil|media|dificil",
  "porciones": 4,
  "costo_estimado": "bajo|medio|alto",
  "ingredientes": [
    {
      "nombre": "string singular minúsculas",
      "categoria": "proteina_animal|embutido|lacteo|vegetal|fruta|grano|legumbre|condimento|bebida|snack|otro",
      "cantidad": 200,
      "unidad": "g|kg|ml|l|unidades|lata|paquete|porcion|cucharada|cucharadita|taza|null",
      "esencial": true
    }
  ],
  "pasos": ["array de strings, 4-8 pasos claros"],
  "tags": ["array de strings cortos"],
  "info_nutricional_aprox": {
    "calorias_porcion": 480,
    "proteina_g": 28,
    "carbohidratos_g": 55,
    "grasa_g": 14,
    "sodio_mg": 600,
    "azucar_g": 5,
    "fibra_g": 4
  },
  "perfiles": {
    "ninos": true,
    "vegetariana": false,
    "deficit_calorico": false,
    "embarazadas": true,
    "adultos_mayores": true,
    "keto": false
  },
  "filtros_nutricionales": {
    "bajo_sodio": true,
    "bajo_azucar": true,
    "alto_proteina": true,
    "bajo_carbohidratos": false,
    "alta_fibra": false,
    "sin_gluten": false,
    "sin_lacteos": false,
    "bajo_grasa": false,
    "bajo_potasio": true,
    "bajo_purinas": true
  },
  "source_url": "URL original o null",
  "source_platform": "instagram|tiktok|youtube|facebook|web|foto|texto|manual",
  "language_original": "es|en|fr|pt|otro",
  "confidence": "high|medium|low"
}`

async function callClaude(apiKey, messages, systemPrompt, maxTokens = 4000) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? `Claude error ${res.status}`)
  return data.content?.[0]?.text ?? ''
}

function parseRecipeJSON(text) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Claude no devolvió JSON válido')
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

  const { type, content, imageBase64, imageMime, platform } = req.body
  if (!type) return res.status(400).json({ error: 'type es requerido' })

  const systemFull = `${SYSTEM_PROMPT}\n\nFORMATO DE SALIDA EXACTO (respondé SOLO este JSON):\n${OUTPUT_FORMAT}`

  try {
    let recipe, source_url = null

    // ── Texto pegado ─────────────────────────────────────────────────────────
    if (type === 'text') {
      if (!content) return res.status(400).json({ error: 'content es requerido' })
      const text = await callClaude(apiKey, [{
        role: 'user',
        content: `El usuario pegó este texto con una receta.\nTEXTO:\n${content}\n\nOrganizá la información en el formato estructurado.`,
      }], systemFull)
      recipe = parseRecipeJSON(text)
      recipe.source_platform = 'texto'
      recipe.source_url = null
    }

    // ── URL web ───────────────────────────────────────────────────────────────
    else if (type === 'url' || type === 'social') {
      if (!content) return res.status(400).json({ error: 'content (URL) es requerido' })
      source_url = content

      let pageContent = ''
      const plat = platform ?? detectPlatform(content)

      try {
        const pageRes = await fetch(content, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mesa.os recipe importer)' },
          signal: AbortSignal.timeout(8000),
        })
        if (pageRes.ok) {
          const html = await pageRes.text()
          pageContent = html
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 8000)
        }
      } catch { /* Claude intentará desde su conocimiento */ }

      const userMsg = pageContent
        ? `Este contenido fue extraído de ${plat ?? 'la web'}.\nURL: ${content}\nContenido:\n${pageContent}\n\nExtraé la receta completa. El nombre es el plato en sí, no el título del post.`
        : `Extraé la receta de esta URL: ${content}\nPlataforma: ${plat ?? 'web'}\nUsa tu conocimiento si no podés acceder.`

      const text = await callClaude(apiKey, [{ role: 'user', content: userMsg }], systemFull)
      recipe = parseRecipeJSON(text)
      recipe.source_url = source_url
      recipe.source_platform = plat ?? 'web'
    }

    // ── Foto ──────────────────────────────────────────────────────────────────
    else if (type === 'photo') {
      if (!imageBase64) return res.status(400).json({ error: 'imageBase64 es requerido' })
      const mime = imageMime ?? 'image/jpeg'
      const text = await callClaude(apiKey, [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: imageBase64 } },
          {
            type: 'text',
            text: 'Analizá esta imagen. Puede ser foto de receta impresa, libro, pantalla, receta a mano. Extraé toda la información disponible. Si hay texto parcial, inferí con cuidado. Si no podés leer algo con certeza, usá null.',
          },
        ],
      }], systemFull)
      recipe = parseRecipeJSON(text)
      recipe.source_platform = 'foto'
      recipe.source_url = null
    }

    else {
      return res.status(400).json({ error: `Tipo desconocido: ${type}` })
    }

    return res.status(200).json({ recipe, source_url })

  } catch (e) {
    console.error('import-recipe error:', e)
    return res.status(500).json({ error: String(e) })
  }
}

function detectPlatform(url) {
  if (/instagram\.com/i.test(url))  return 'instagram'
  if (/tiktok\.com/i.test(url))     return 'tiktok'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  if (/facebook\.com/i.test(url))   return 'facebook'
  return 'web'
}

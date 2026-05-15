// POST /api/inferir-receta-manual
// Infiere receta completa a partir de nombre e ingredientes usando Claude

const SYSTEM_PROMPT = `Sos un experto culinario latinoamericano. A partir del nombre y la lista de ingredientes de una receta, debés INFERIR Y ESTIMAR todos los demás datos de manera realista y coherente.

REGLAS CRÍTICAS:
1. SIEMPRE da un valor estimado — nunca retornes null para campos numéricos o de texto cuando se pueden inferir razonablemente.
2. Los tiempos deben ser REALISTAS para esa combinación de ingredientes (no inventes tiempos absurdos).
3. La dificultad debe reflejar la complejidad real: pocos ingredientes + técnicas simples = facil.
4. Generá 4-7 pasos de preparación COHERENTES con los ingredientes dados.
5. La info nutricional debe ser una estimación razonable por porción típica.
6. Si el nombre es muy genérico (solo "pollo", "arroz", "sopa"), incluí missing_info con sugerencias de qué más necesitás para ser más preciso.
7. Si el nombre es específico, dejá missing_info como null.
8. Respondé SOLO con JSON válido. Sin markdown, sin explicaciones, sin texto extra.

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
  "nombre": "nombre completo y descriptivo de la receta",
  "descripcion_corta": "descripción apetitosa de máx 80 caracteres",
  "origen": "ej: colombiana, italiana, mexicana",
  "tipo_comida": ["desayuno|almuerzo|cena|snack|postre|bebida|brunch — puede ser array"],
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
      "unidad": "g|kg|ml|l|unidades|lata|paquete|porcion|cucharada|cucharadita|taza",
      "esencial": true
    }
  ],
  "pasos": ["paso 1 claro y accionable", "paso 2...", "...4-7 pasos totales"],
  "tags": ["array de tags cortos relevantes"],
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
    "bajo_sodio": false,
    "bajo_azucar": true,
    "alto_proteina": true,
    "bajo_carbohidratos": false,
    "alta_fibra": false,
    "sin_gluten": false,
    "sin_lacteos": false,
    "bajo_grasa": false,
    "bajo_potasio": false,
    "bajo_purinas": false
  },
  "source_platform": "manual_ia",
  "language_original": "es",
  "confidence": "high|medium|low",
  "missing_info": null
}`

async function callClaude(apiKey, messages, systemPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
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

  const { nombre, ingredientes } = req.body
  if (!nombre?.trim()) return res.status(400).json({ error: 'nombre es requerido' })
  if (!ingredientes?.trim()) return res.status(400).json({ error: 'ingredientes es requerido' })

  const systemFull = `${SYSTEM_PROMPT}\n\nFORMATO DE SALIDA EXACTO (respondé SOLO este JSON, sin nada más):\n${OUTPUT_FORMAT}`

  try {
    const raw = await callClaude(apiKey, [{
      role: 'user',
      content: `Nombre de la receta: ${nombre.trim()}\n\nIngredientes:\n${ingredientes.trim()}\n\nInferí todos los datos faltantes y devolvé el JSON completo.`,
    }], systemFull)

    const recipe = parseRecipeJSON(raw)
    recipe.source_platform = 'manual_ia'
    recipe.source_url = null

    return res.status(200).json({ recipe })
  } catch (err) {
    console.error('inferir-receta-manual error:', err)
    return res.status(500).json({ error: err.message ?? 'Error al inferir receta' })
  }
}

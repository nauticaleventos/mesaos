export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'URL requerida' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY no configurada' })

  // Intentar obtener el contenido de la página
  let pageContent = ''
  try {
    const pageRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; mesa.os recipe importer)' },
      signal: AbortSignal.timeout(8000),
    })
    if (pageRes.ok) {
      const html = await pageRes.text()
      // Extraer texto limpio del HTML
      pageContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 6000)
    }
  } catch {
    // Si no se puede acceder a la URL, Claude intentará desde su conocimiento
  }

  const prompt = pageContent
    ? `Extrae la receta de este contenido web (URL: ${url}):\n\n${pageContent}\n\n`
    : `Extrae la información de la receta de esta URL: ${url}\nUsa tu conocimiento para identificar la receta.\n\n`

  const jsonPrompt = `${prompt}Devuelve SOLO un JSON válido (sin markdown):
{
  "nombre": "string en español",
  "descripcion_corta": "máx 80 caracteres",
  "origen": "string",
  "tipo_comida": ["desayuno|almuerzo|cena|snack|postre"],
  "tiempo_total_min": número,
  "tiempo_preparacion_min": número,
  "tiempo_coccion_min": número,
  "dificultad": "facil|media|dificil",
  "porciones": número,
  "costo_estimado": "bajo|medio|alto",
  "ingredientes": [{"nombre":"string","categoria":"proteina_animal|lacteo|vegetal|fruta|grano|legumbre|condimento|bebida|snack|otro","cantidad":número|null,"unidad":"string|null","esencial":boolean}],
  "pasos": ["paso 1", "paso 2"],
  "tags": ["tag1", "tag2"],
  "info_nutricional_aprox": {"calorias_porcion":número,"proteina_g":número,"carbohidratos_g":número,"grasa_g":número}
}`

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: jsonPrompt }],
      }),
    })

    const data = await claudeRes.json()
    const text = data.content?.[0]?.text ?? ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return res.status(422).json({ error: 'No se pudo extraer la receta de esa URL' })

    const recipe = JSON.parse(match[0])
    return res.status(200).json({ recipe, source_url: url })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}

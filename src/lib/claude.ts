// Todas las llamadas a Claude van a través de /api/claude (proxy en Vercel)
// La API key vive en el servidor — nunca se expone al browser

const MODEL = 'claude-sonnet-4-6'

async function callClaude(messages: object[], maxTokens = 1024): Promise<string> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Claude error ${res.status}: ${err.error ?? ''}`)
  }
  const data = await res.json()
  return data.content[0].text
}

// ── Tip de conservación ───────────────────────────────────────────────────────
export async function getConservationTip(foodName: string): Promise<string> {
  const text = await callClaude([{
    role: 'user',
    content: `Dame UN tip corto y práctico de conservación para: "${foodName}".
Máximo 2 oraciones. En español colombiano, tono amigable. Solo el tip, sin introducción.`
  }])
  return text.trim()
}

// ── Leer alimento desde foto ─────────────────────────────────────────────────
export interface FoodFromPhoto {
  name: string
  quantity: number | null
  unit: string | null
  category: string
  expiry_date: string | null
  calories_per_100g: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  conservation_tip: string
}

const FOOD_JSON_PROMPT = `Responde SOLO con un JSON válido (sin markdown, sin explicación):
{
  "name": "nombre del alimento en español",
  "quantity": número o null,
  "unit": "kg|g|L|ml|unidades|null",
  "category": "proteína|lácteos|frutas y verduras|granos y cereales|salsas y condimentos|bebidas|snacks|congelados|otros",
  "expiry_date": "YYYY-MM-DD o null",
  "calories_per_100g": número o null,
  "protein_g": número o null,
  "carbs_g": número o null,
  "fat_g": número o null,
  "conservation_tip": "tip corto en español colombiano"
}`

// Una sola foto
export async function scanFoodPhoto(base64Image: string, mimeType: string): Promise<FoodFromPhoto> {
  const text = await callClaude([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
      { type: 'text', text: `Identifica este alimento de la foto o etiqueta.\n${FOOD_JSON_PROMPT}` },
    ],
  }], 1500)

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Claude no devolvió JSON válido')
  return JSON.parse(match[0]) as FoodFromPhoto
}

// Varias fotos del MISMO producto (frente + tabla nutricional, etc.)
export async function scanFoodPhotoGroup(images: { base64: string; mime: string }[]): Promise<FoodFromPhoto> {
  const imageBlocks = images.map(img => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: img.mime as 'image/jpeg', data: img.base64 },
  }))

  const text = await callClaude([{
    role: 'user',
    content: [
      ...imageBlocks,
      {
        type: 'text',
        text: `Estas ${images.length} fotos son del MISMO producto visto desde ángulos distintos (frente, dorso, tabla nutricional, fecha de vencimiento, etc.).
Combina TODA la información visible en todas las fotos y crea UN solo registro completo.
Si una foto tiene el nombre y otra tiene la tabla nutricional, usa ambas.
${FOOD_JSON_PROMPT}`,
      },
    ],
  }], 1500)

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Claude no devolvió JSON válido')
  return JSON.parse(match[0]) as FoodFromPhoto
}

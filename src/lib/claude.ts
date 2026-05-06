// Llamadas a Claude API — uso interno únicamente
// NOTA: La API key queda en el cliente. Aceptable para app familiar privada.
// En producción mover a un edge function.

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string
const MODEL   = 'claude-sonnet-4-20250514'

async function callClaude(messages: object[], maxTokens = 1024): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':                    'application/json',
      'x-api-key':                       API_KEY,
      'anthropic-version':               '2023-06-01',
      'anthropic-dangerous-allow-browser': 'true',
    },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, messages }),
  })
  if (!res.ok) throw new Error(`Claude error: ${res.status}`)
  const data = await res.json()
  return data.content[0].text
}

// ── Tip de conservación para un alimento ─────────────────────────────────────
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
  expiry_date: string | null    // YYYY-MM-DD o null
  calories_per_100g: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  conservation_tip: string
}

export async function scanFoodPhoto(base64Image: string, mimeType: string): Promise<FoodFromPhoto> {
  const text = await callClaude([{
    role: 'user',
    content: [
      {
        type: 'image',
        source: { type: 'base64', media_type: mimeType, data: base64Image },
      },
      {
        type: 'text',
        text: `Identifica este alimento de la foto o etiqueta.
Responde SOLO con un JSON válido (sin markdown, sin explicación) con esta estructura exacta:
{
  "name": "nombre del alimento en español",
  "quantity": número o null,
  "unit": "unidad (kg, g, L, ml, unidades) o null",
  "category": "una de: proteína | lácteos | frutas y verduras | granos y cereales | salsas y condimentos | bebidas | snacks | congelados | otros",
  "expiry_date": "YYYY-MM-DD si está visible, o null",
  "calories_per_100g": número o null,
  "protein_g": número o null,
  "carbs_g": número o null,
  "fat_g": número o null,
  "conservation_tip": "tip corto de conservación en español colombiano"
}`,
      },
    ],
  }], 1500)

  // Extraer JSON limpio
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Claude no devolvió JSON válido')
  return JSON.parse(match[0]) as FoodFromPhoto
}

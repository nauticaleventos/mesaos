// Todas las llamadas a Claude van a través de /api/claude (proxy en Vercel)
// La API key vive en el servidor — nunca se expone al browser

const MODEL = 'claude-sonnet-4-6'

async function callClaude(messages: object[], maxTokens = 1024, temperature = 1): Promise<string> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, temperature, messages }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Claude error ${res.status}: ${err.error ?? ''}`)
  }
  const data = await res.json()
  return data.content[0].text
}

// ── Lista rápida — Paso 1: extracción ────────────────────────────────────────
interface ExtractedItem {
  nombre:         string
  categoria:      string
  cantidad:       number | null
  unidad:         string | null
  es_estimado:    boolean
  texto_original: string
}

const EXTRACTION_PROMPT = `Eres un asistente que extrae items de comida de texto en lenguaje natural escrito por usuarios de una app de inventario de cocina. Los usuarios escriben rápido, con errores de tipeo, sin estructura, y con cantidades vagas o ausentes.

Tu trabajo es devolver SOLO un JSON válido con la lista de items detectados. Nada más. Sin texto adicional, sin explicaciones, sin markdown, sin bloques de código.

Formato de salida:
{"items":[{"nombre":"string","categoria":"string","cantidad":number|null,"unidad":"string|null","es_estimado":boolean,"texto_original":"string"}]}

Definición de cada campo:
- nombre: nombre normalizado del alimento, en singular, minúsculas, en español.
- categoria: exactamente una de: proteina_animal, embutido, lacteo, vegetal, fruta, grano, legumbre, condimento, bebida, snack, otro
- cantidad: número si el usuario lo especificó. null si no.
- unidad: "unidades","g","kg","ml","l","lata","paquete","porcion". null si no aplica.
- es_estimado: true si usó palabras vagas ("algo de","aprox","unos","como") O si no especificó cantidad. false solo con cantidad y unidad concretas sin palabras vagas.
- texto_original: fragmento exacto del input que generó este item.

Reglas:
1. Corrige typos: "yogut"→"yogur", "atun"→"atún", "jamon"→"jamón"
2. Normaliza al nombre más común en español, singular siempre
3. Cantidades explícitas: "8 huevos"→cantidad=8, unidad="unidades", es_estimado=false
4. Cantidades vagas: "algo de queso"→cantidad=null, es_estimado=true
5. Mezcla vago+número: "algo de huevos unos 8"→cantidad=8, es_estimado=true
6. Sin cantidad: cantidad=null, unidad=null, es_estimado=true. NUNCA inventes cantidades
7. Items compuestos: "huevos y leche"→dos items separados
8. Ignora frases de relleno: "tengo en la nevera","me queda","creo que"
9. Si no entiendes un fragmento, omítelo
10. Si el mismo item aparece dos veces, consolídalo sumando cantidades numéricas

Ejemplos:
INPUT: "me queda aprox chorizo, atun, jamon, algo de huevos unos 8 yogut griego"
OUTPUT: {"items":[{"nombre":"chorizo","categoria":"embutido","cantidad":null,"unidad":null,"es_estimado":true,"texto_original":"chorizo"},{"nombre":"atún","categoria":"proteina_animal","cantidad":null,"unidad":null,"es_estimado":true,"texto_original":"atun"},{"nombre":"jamón","categoria":"embutido","cantidad":null,"unidad":null,"es_estimado":true,"texto_original":"jamon"},{"nombre":"huevos","categoria":"proteina_animal","cantidad":8,"unidad":"unidades","es_estimado":true,"texto_original":"algo de huevos unos 8"},{"nombre":"yogur griego","categoria":"lacteo","cantidad":null,"unidad":null,"es_estimado":true,"texto_original":"yogut griego"}]}

Procesa el siguiente input y devuelve SOLO el JSON:

INPUT: {{INPUT}}`

async function extractItemsFromText(input: string): Promise<ExtractedItem[]> {
  const prompt = EXTRACTION_PROMPT.replace('{{INPUT}}', input)
  const text = await callClaude([{ role: 'user', content: prompt }], 1500, 0)

  const match = text.trim().match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No se pudo parsear la lista')
  const parsed = JSON.parse(match[0])
  return parsed.items as ExtractedItem[]
}

// ── Lista rápida — Paso 2: enriquecer con nutrición ───────────────────────────
async function enrichWithNutrition(items: ExtractedItem[]): Promise<FoodFromPhoto[]> {
  const names = items.map((it, i) => `${i + 1}. ${it.nombre}`).join('\n')

  const text = await callClaude([{
    role: 'user',
    content: `Para cada alimento de esta lista, busca en tu conocimiento su información nutricional aproximada por 100g y un tip de conservación en español colombiano.

Lista:
${names}

Responde SOLO con un JSON array (sin markdown), un objeto por alimento en el mismo orden:
[{"calories_per_100g":número|null,"protein_g":número|null,"carbs_g":número|null,"fat_g":número|null,"conservation_tip":"string"}]`,
  }], 2000)

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No se pudo obtener información nutricional')
  return JSON.parse(match[0])
}

// ── Mapa de categorías ────────────────────────────────────────────────────────
const CAT_MAP: Record<string, string> = {
  proteina_animal: 'proteína',
  lacteo:          'lácteos',
  embutido:        'proteína',
  vegetal:         'frutas y verduras',
  fruta:           'frutas y verduras',
  grano:           'granos y cereales',
  legumbre:        'granos y cereales',
  condimento:      'salsas y condimentos',
  bebida:          'bebidas',
  snack:           'snacks',
  otro:            'otros',
}

// ── Lista rápida — función principal ─────────────────────────────────────────
export async function parseQuickList(input: string): Promise<FoodFromPhoto[]> {
  const extracted = await extractItemsFromText(input)
  if (!extracted.length) throw new Error('No encontré alimentos en el texto')

  const nutrition = await enrichWithNutrition(extracted)

  return extracted.map((it, i) => ({
    name:              it.nombre,
    quantity:          it.cantidad,
    unit:              it.unidad,
    category:          CAT_MAP[it.categoria] ?? 'otros',
    expiry_date:       null,
    calories_per_100g: nutrition[i]?.calories_per_100g ?? null,
    protein_g:         nutrition[i]?.protein_g ?? null,
    carbs_g:           nutrition[i]?.carbs_g ?? null,
    fat_g:             nutrition[i]?.fat_g ?? null,
    conservation_tip:  nutrition[i]?.conservation_tip ?? '',
  }))
}

// ── Leer tiquete / recibo de compra ──────────────────────────────────────────
export async function scanReceiptPhoto(base64Image: string): Promise<FoodFromPhoto[]> {
  const text = await callClaude([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
      {
        type: 'text',
        text: `Esta es una foto de un tiquete o recibo de compra de supermercado.
Extrae TODOS los artículos de alimentos que aparecen. Los recibos usan nombres abreviados — normalízalos al nombre completo en español colombiano.

Ejemplos de normalización:
- "LCH ALPN ENT 1L" → "Leche Alpina Entera"
- "ARRZ BLD 500G" → "Arroz Blanquita"
- "HVS AA X12" → "Huevos"
- "PCHG RSNR KG" → "Pechuga de pollo"

Ignora: cobros de bolsa, IVA, totales, servicios, puntos de fidelidad, descuentos.

Responde SOLO con un JSON array (sin markdown):
[
  {
    "name": "nombre normalizado en español",
    "quantity": número o null,
    "unit": "unidades|kg|g|L|ml|paquete|null",
    "category": "proteína|lácteos|frutas y verduras|granos y cereales|salsas y condimentos|bebidas|snacks|congelados|otros",
    "expiry_date": null,
    "calories_per_100g": null,
    "protein_g": null,
    "carbs_g": null,
    "fat_g": null,
    "conservation_tip": "tip corto en español colombiano"
  }
]`,
      },
    ],
  }], 2000)

  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('No se pudieron leer los artículos del tiquete')
  return JSON.parse(match[0]) as FoodFromPhoto[]
}

// ── Enriquecer alimento existente con foto (nutrición + vencimiento) ──────────
export interface EnrichmentFromPhoto {
  expiry_date:       string | null
  calories_per_100g: number | null
  protein_g:         number | null
  carbs_g:           number | null
  fat_g:             number | null
  conservation_tip:  string | null
}

export async function enrichFromPhoto(base64Image: string, foodName: string): Promise<EnrichmentFromPhoto> {
  const text = await callClaude([{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64Image } },
      {
        type: 'text',
        text: `Esta foto es del producto "${foodName}". Extrae SOLO la información nutricional y la fecha de vencimiento si están visibles.

Responde SOLO con un JSON (sin markdown):
{
  "expiry_date": "YYYY-MM-DD o null",
  "calories_per_100g": número o null,
  "protein_g": número o null,
  "carbs_g": número o null,
  "fat_g": número o null,
  "conservation_tip": "tip corto en español colombiano o null"
}`,
      },
    ],
  }], 800)

  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No se pudo leer la información del producto')
  return JSON.parse(match[0]) as EnrichmentFromPhoto
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

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync } from 'fs'

// ── Config ────────────────────────────────────────────────────────────────────
const API_KEY        = process.env.ANTHROPIC_API_KEY
const MODEL          = 'claude-sonnet-4-5'
const TOTAL          = 200
const LOTES          = 40
const POR_LOTE       = TOTAL / LOTES   // 5
const TEMPERATURA    = 0.7
const MAX_TOKENS     = 8000
const PAUSA_MS       = 2000
const ARCHIVO_SALIDA = 'recetas-iniciales.json'

if (!API_KEY) {
  console.error('❌ Falta la variable de entorno ANTHROPIC_API_KEY')
  console.error('   Cómo correrlo: ANTHROPIC_API_KEY=sk-ant-... node generar-recetas.js')
  process.exit(1)
}

const client = new Anthropic({ apiKey: API_KEY })

// ── Prompt ────────────────────────────────────────────────────────────────────
const buildPrompt = (n) => `Eres un chef experto en cocina latinoamericana e internacional, generando recetas para una app de inventario y planificación de comidas.

Genera EXACTAMENTE ${n} recetas:
- 50% cocina latinoamericana (colombiana, mexicana, peruana, argentina, venezolana, caribeña)
- 50% cocina internacional accesible (italiana, asiática simple, mediterránea, americana casera)
- Variedad equilibrada en tiempo, dificultad, costo y tipo de comida
- Mezcla de desayunos, almuerzos, cenas, snacks y postres

Devuelve SOLO un JSON válido con esta estructura. Sin texto adicional, sin markdown:

{
  "recetas": [
    {
      "nombre": "string en español",
      "descripcion_corta": "string máx 80 caracteres",
      "origen": "string",
      "tipo_comida": ["desayuno|almuerzo|cena|snack|postre|brunch"],
      "ocasion": ["entre_semana|fin_semana|rapida|especial|reunion"],
      "tiempo_total_min": 0,
      "tiempo_preparacion_min": 0,
      "tiempo_coccion_min": 0,
      "dificultad": "facil|media|dificil",
      "porciones": 0,
      "costo_estimado": "bajo|medio|alto",
      "ingredientes": [
        {
          "nombre": "string singular minúsculas",
          "categoria": "proteina_animal|embutido|lacteo|vegetal|fruta|grano|legumbre|condimento|bebida|snack|otro",
          "cantidad": null,
          "unidad": "g|kg|ml|l|unidades|lata|paquete|porcion|cucharada|cucharadita|taza|null",
          "esencial": true
        }
      ],
      "pasos": ["array de strings, 4-8 pasos"],
      "tags": ["array de strings cortos"],
      "info_nutricional_aprox": {
        "calorias_porcion": 0,
        "proteina_g": 0,
        "carbohidratos_g": 0,
        "grasa_g": 0
      }
    }
  ]
}

REGLAS:
1. Tiempos y cantidades realistas.
2. esencial=true solo si sin ese ingrediente la receta no existe.
3. Usa EXACTAMENTE las categorías del listado.
4. Pasos: 4-8, cada paso una acción concreta.
5. No repitas la misma proteína en más de 25% de las recetas.
6. Nombres en español.
7. Macros: proteína 5-50g, carbos 10-100g, grasa 5-40g, calorías 200-800.
   Verifica: (proteína × 4) + (carbos × 4) + (grasa × 9) debe estar a ±15% de las calorías.

Genera las ${n} recetas:`

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function extraerJSON(texto) {
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No se encontró JSON en la respuesta')
  return JSON.parse(match[0])
}

function deduplicar(recetas) {
  const vistas = new Set()
  return recetas.filter(r => {
    const key = r.nombre.toLowerCase().trim()
    if (vistas.has(key)) return false
    vistas.add(key)
    return true
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🍳 Generando ${TOTAL} recetas en ${LOTES} lotes de ${POR_LOTE}...\n`)

  const todasLasRecetas = []
  let fallidas = 0

  for (let lote = 1; lote <= LOTES; lote++) {
    console.log(`📦 Lote ${lote}/${LOTES} — solicitando ${POR_LOTE} recetas...`)

    try {
      const respuesta = await client.messages.create({
        model:       MODEL,
        max_tokens:  MAX_TOKENS,
        temperature: TEMPERATURA,
        messages: [{ role: 'user', content: buildPrompt(POR_LOTE) }],
      })

      const texto = respuesta.content[0].text

      try {
        const datos   = extraerJSON(texto)
        const recetas = datos.recetas ?? []

        if (!Array.isArray(recetas) || recetas.length === 0)
          throw new Error('El JSON no contiene recetas')

        todasLasRecetas.push(...recetas)
        console.log(`  ✓ ${recetas.length} recetas (acumulado: ${todasLasRecetas.length})`)

      } catch (parseError) {
        fallidas++
        const archivo = `error-lote-${lote}.txt`
        writeFileSync(archivo, texto, 'utf-8')
        console.error(`  ✗ Error parseando lote ${lote}: ${parseError.message}`)
        console.error(`    Respuesta guardada en ${archivo}`)
      }

    } catch (apiError) {
      fallidas++
      console.error(`  ✗ Error API lote ${lote}: ${apiError.message}`)
    }

    if (lote < LOTES) {
      console.log(`  ⏳ Pausa ${PAUSA_MS / 1000}s...`)
      await sleep(PAUSA_MS)
    }
  }

  const recetasUnicas = deduplicar(todasLasRecetas)
  const duplicados    = todasLasRecetas.length - recetasUnicas.length

  console.log(`\n📊 Resumen:`)
  console.log(`  Recetas obtenidas:    ${todasLasRecetas.length}`)
  console.log(`  Duplicados removidos: ${duplicados}`)
  console.log(`  Recetas únicas:       ${recetasUnicas.length}`)
  console.log(`  Lotes fallidos:       ${fallidas}/${LOTES}`)

  const salida = {
    generado_en:   new Date().toISOString(),
    total_recetas: recetasUnicas.length,
    modelo:        MODEL,
    recetas:       recetasUnicas,
  }

  writeFileSync(ARCHIVO_SALIDA, JSON.stringify(salida, null, 2), 'utf-8')
  console.log(`\n✅ ${recetasUnicas.length} recetas guardadas en ${ARCHIVO_SALIDA}\n`)
}

main().catch(err => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, readFileSync, existsSync } from 'fs'

// ── Config ────────────────────────────────────────────────────────────────────
const API_KEY        = process.env.ANTHROPIC_API_KEY
const MODEL          = 'claude-sonnet-4-6'
const TOTAL          = 200
const LOTES          = 40
const POR_LOTE       = TOTAL / LOTES   // 5
const TEMPERATURA    = 0.7
const MAX_TOKENS     = 8000
const PAUSA_MS       = 2000
const ARCHIVO_SALIDA = 'recetas-v2.json'
const ARCHIVO_PREV   = 'recetas-iniciales.json'

if (!API_KEY) {
  console.error('❌ Falta ANTHROPIC_API_KEY')
  process.exit(1)
}

const client = new Anthropic({ apiKey: API_KEY })

// ── Cargar nombres ya existentes para evitar duplicados ───────────────────────
function cargarNombresExistentes() {
  if (!existsSync(ARCHIVO_PREV)) return new Set()
  try {
    const raw = JSON.parse(readFileSync(ARCHIVO_PREV, 'utf-8'))
    return new Set((raw.recetas ?? []).map(r => r.nombre.toLowerCase().trim()))
  } catch { return new Set() }
}

// ── Cargar progreso previo de v2 (reanudable) ─────────────────────────────────
function cargarProgreso() {
  if (!existsSync(ARCHIVO_SALIDA)) return []
  try {
    const raw = JSON.parse(readFileSync(ARCHIVO_SALIDA, 'utf-8'))
    return raw.recetas ?? []
  } catch { return [] }
}

// ── Prompt ────────────────────────────────────────────────────────────────────
const buildPrompt = (n, nombresAEvitar) => {
  const listaEvitar = nombresAEvitar.size > 0
    ? `\nNO generes ninguna de estas recetas (ya existen):\n${[...nombresAEvitar].slice(0, 150).join(', ')}\n`
    : ''

  return `Eres un chef colombiano experto, generando recetas auténticas para una app de inventario y planificación de comidas.
${listaEvitar}
Genera EXACTAMENTE ${n} recetas con esta distribución:
- 60% cocina colombiana auténtica (costeña, paisa, santandereana, valluna, cundiboyacense, llanera, pacífica)
- 25% cocina latinoamericana (mexicana, peruana, venezolana, ecuatoriana)
- 15% internacional adaptada al paladar latino

Variedad obligatoria:
- Desayunos típicos: huevos pericos, calentado, changua, arepa con queso, caldo de costilla
- Almuerzos completos con sopa + seco
- Platos icónicos: bandeja paisa, ajiaco, sancocho, lechona, frijoles, arroz con pollo, sudados
- Costeñas: arroz con coco, sancocho de pescado, patacones, suero costeño
- Vallunas: marranitas, aborrajados, pandebono
- Antojos: empanadas, buñuelos, almojábanas, pandeyuca
- Bebidas tradicionales: aguapanela, lulada, champús
- Postres: arroz con leche, brevas con arequipe, cocadas
- 15% recetas vegetarianas
- 10% bajas en calorías para balance

Devuelve SOLO un JSON válido con esta estructura. Sin texto adicional, sin markdown:

{
  "recetas": [
    {
      "nombre": "string en español",
      "descripcion_corta": "string máx 80 caracteres",
      "origen": "string (ej: colombiana costeña, mexicana, italiana)",
      "tipo_comida": ["desayuno|almuerzo|cena|snack|postre|bebida|brunch"],
      "ocasion": ["entre_semana|fin_semana|rapida|especial|reunion|tradicional"],
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
      "tags": ["array cortos: tradicional, regional, rapida, fiesta, familiar, callejera, etc."],
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
      }
    }
  ]
}

REGLAS GENERALES:
1. Tiempos y cantidades realistas. Una arepa es rápida, una bandeja paisa toma tiempo.
2. Nombres en español colombiano: "arepa", "ajiaco", "patacón", no traducciones.
3. Ingredientes locales: yuca, plátano, papa criolla, mazorca, cilantro, panela, queso campesino, hogao.
4. esencial=true solo si sin ese ingrediente la receta no existe.
5. Categorías: usa EXACTAMENTE las del listado.
6. Pasos: 4-8 claros, lenguaje colombiano ("sofreir el hogao", "guisar las carnes").
7. No repitas la misma proteína en más de 25% de las recetas.
8. Macros realistas: proteína 5-50g, carbos 10-100g, grasa 5-40g, calorías 200-800.
   Verifica: (proteína × 4) + (carbos × 4) + (grasa × 9) debe estar a ±15% de las calorías.
9. Diversidad regional: máximo 35% de una sola región.

REGLAS PARA "perfiles":
- ninos: true si NO es picante, NO tiene alcohol, NO tiene exceso de café, presentación familiar y sabor suave.
- vegetariana: true si NO contiene carne, pollo, pescado, mariscos ni embutidos.
- deficit_calorico: true si calorías por porción ≤ 450 kcal Y la receta es satisfactoria.
- embarazadas: true si NO tiene mariscos crudos, pescado crudo, lácteos no pasteurizados, alcohol, ni hígado en exceso.
- adultos_mayores: true si la textura es suave, no muy picante, fácil digestión.
- keto: true si carbohidratos por porción ≤ 15g Y grasa ≥ 25g.

REGLAS PARA "filtros_nutricionales":
- bajo_sodio: true si sodio_mg ≤ 600 por porción.
- bajo_azucar: true si azucar_g ≤ 5 por porción.
- alto_proteina: true si proteina_g ≥ 25 por porción.
- bajo_carbohidratos: true si carbohidratos_g ≤ 20 por porción.
- alta_fibra: true si fibra_g ≥ 6 por porción.
- sin_gluten: true si NO contiene trigo, cebada, centeno, harina común, pasta de trigo.
- sin_lacteos: true si NO contiene leche, queso, mantequilla, crema, yogur.
- bajo_grasa: true si grasa_g ≤ 10 por porción.
- bajo_potasio: true si NO usa cantidades significativas de papa, plátano, tomate, espinaca, aguacate, frijoles, naranja.
- bajo_purinas: true si NO usa vísceras, mariscos, sardinas, anchoas, carnes rojas grasas, ni caldos concentrados.

Genera las ${n} recetas:`
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

function extraerJSON(texto) {
  const match = texto.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No se encontró JSON en la respuesta')
  return JSON.parse(match[0])
}

function deduplicar(recetas, nombresExistentes) {
  const vistas = new Set([...nombresExistentes])
  return recetas.filter(r => {
    const key = r.nombre.toLowerCase().trim()
    if (vistas.has(key)) return false
    vistas.add(key)
    return true
  })
}

function guardar(recetas) {
  writeFileSync(ARCHIVO_SALIDA, JSON.stringify({
    generado_en:   new Date().toISOString(),
    total_recetas: recetas.length,
    modelo:        MODEL,
    recetas,
  }, null, 2), 'utf-8')
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const nombresExistentes = cargarNombresExistentes()
  console.log(`📚 Nombres existentes cargados: ${nombresExistentes.size} (se evitarán duplicados)`)

  // Cargar progreso previo (reanudable)
  let acumuladas = cargarProgreso()
  const loteInicio = Math.floor(acumuladas.length / POR_LOTE) + 1
  if (acumuladas.length > 0) {
    console.log(`↩  Retomando desde lote ${loteInicio} (${acumuladas.length} recetas ya generadas)\n`)
  }

  // Todos los nombres a evitar = existentes + ya acumuladas
  const todosAEvitar = new Set([
    ...nombresExistentes,
    ...acumuladas.map(r => r.nombre.toLowerCase().trim()),
  ])

  console.log(`\n🍳 Generando ${TOTAL} recetas en ${LOTES} lotes de ${POR_LOTE}...\n`)

  let fallidas = 0

  for (let lote = loteInicio; lote <= LOTES; lote++) {
    console.log(`📦 Lote ${lote}/${LOTES} — solicitando ${POR_LOTE} recetas...`)

    try {
      const respuesta = await client.messages.create({
        model:       MODEL,
        max_tokens:  MAX_TOKENS,
        temperature: TEMPERATURA,
        messages: [{ role: 'user', content: buildPrompt(POR_LOTE, todosAEvitar) }],
      })

      const texto = respuesta.content[0].text

      try {
        const datos   = extraerJSON(texto)
        const recetas = datos.recetas ?? []

        if (!Array.isArray(recetas) || recetas.length === 0)
          throw new Error('El JSON no contiene recetas')

        // Agregar nuevas a la lista de nombres a evitar
        recetas.forEach(r => todosAEvitar.add(r.nombre.toLowerCase().trim()))
        acumuladas.push(...recetas)

        console.log(`  ✓ ${recetas.length} recetas  (acumulado: ${acumuladas.length})`)

        // Guardar progreso después de cada lote
        guardar(deduplicar(acumuladas, nombresExistentes))

      } catch (parseError) {
        fallidas++
        writeFileSync(`error-lote-v2-${lote}.txt`, texto, 'utf-8')
        console.error(`  ✗ Error parseando lote ${lote}: ${parseError.message}`)
      }

    } catch (apiError) {
      fallidas++
      console.error(`  ✗ Error API lote ${lote}: ${apiError.message}`)
    }

    if (lote < LOTES) {
      process.stdout.write(`  ⏳ Pausa ${PAUSA_MS / 1000}s...\r`)
      await sleep(PAUSA_MS)
    }
  }

  const final = deduplicar(acumuladas, nombresExistentes)
  guardar(final)

  const duplicados = acumuladas.length - final.length
  console.log(`\n📊 Resumen:`)
  console.log(`  Recetas obtenidas:    ${acumuladas.length}`)
  console.log(`  Duplicados removidos: ${duplicados}`)
  console.log(`  Recetas únicas:       ${final.length}`)
  console.log(`  Lotes fallidos:       ${fallidas}/${LOTES}`)
  console.log(`\n✅ ${final.length} recetas guardadas en ${ARCHIVO_SALIDA}\n`)
}

main().catch(err => {
  console.error('❌ Error fatal:', err)
  process.exit(1)
})

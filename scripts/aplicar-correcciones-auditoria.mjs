/**
 * aplicar-correcciones-auditoria.mjs
 *
 * Lee el Excel revisado por la usuaria y aplica las correcciones aprobadas.
 *
 * Uso:
 *   node scripts/aplicar-correcciones-auditoria.mjs              # dry-run
 *   node scripts/aplicar-correcciones-auditoria.mjs --apply      # aplica en BD
 *
 * El Excel debe tener:
 *   - Columna "ID receta": UUID
 *   - Columna "Sugerencia": tipo_componente propuesto
 *   - Columna "¿Aprobar? (sí/no)": "sí" para aprobar
 *   - Columna "Acción final": si tiene valor, sobrescribe la Sugerencia
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DRY_RUN   = !process.argv.includes('--apply')

// Leer .env
const envPath = join(__dirname, '../.env')
try {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length && !process.env[k.trim()]) process.env[k.trim()] = rest.join('=').trim()
  })
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

const VALID_TC = new Set([
  'proteina_principal','guarnicion','ensalada','salsa',
  'vinagreta','plato_unico','postre','bebida','merienda'
])

function norm(s) {
  if (!s) return ''
  return s.toString().trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
}

async function main() {
  console.log(DRY_RUN
    ? '🔍 DRY-RUN — sin cambios en BD. Agregá --apply para confirmar.\n'
    : '✏️  APPLY — aplicando correcciones en Supabase.\n'
  )

  const xlsxPath = join(__dirname, '../recetas-app/auditorias/recetas-sospechosas-revisar.xlsx')
  const wb   = XLSX.readFile(xlsxPath)
  const ws   = wb.Sheets['Sospechosas']
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

  if (rows.length < 2) { console.log('El Excel está vacío.'); return }

  // Headers en fila 0
  const headers = rows[0].map(h => h?.toString().trim() ?? '')
  const colId        = headers.findIndex(h => h.toLowerCase().includes('id receta'))
  const colNombre    = headers.findIndex(h => h.toLowerCase().includes('nombre actual'))
  const colSugerencia= headers.findIndex(h => h.toLowerCase() === 'sugerencia')
  const colAprobar   = headers.findIndex(h => h.toLowerCase().includes('aprobar'))
  const colFinal     = headers.findIndex(h => h.toLowerCase().includes('acción final') || h.toLowerCase().includes('accion final'))

  if (colId === -1 || colSugerencia === -1 || colAprobar === -1) {
    console.error('No encontré las columnas necesarias. Verificá el Excel.')
    process.exit(1)
  }

  const aprobadas = rows.slice(1).filter(row => {
    const aprueba = norm(row[colAprobar] ?? '')
    return aprueba === 'sí' || aprueba === 'si' || aprueba === 's'
  })

  console.log(`Filas aprobadas: ${aprobadas.length}`)

  const cambios = []
  const errores = []

  for (const row of aprobadas) {
    const id       = row[colId]?.toString().trim()
    const nombre   = row[colNombre]?.toString().trim() ?? ''
    const sug      = norm(row[colSugerencia] ?? '')
    const final    = norm(row[colFinal] ?? '')
    const tcNuevo  = final && VALID_TC.has(final) ? final : sug

    if (!id || !VALID_TC.has(tcNuevo)) {
      errores.push({ id, nombre, razon: `valor "${tcNuevo}" no válido` })
      continue
    }

    cambios.push({ id, nombre, tcNuevo })
    console.log(`  [${DRY_RUN ? 'DRY' : 'OK'}] "${nombre}" → ${tcNuevo}`)
  }

  if (errores.length) {
    console.log('\nErrores:')
    errores.forEach(e => console.log(`  ✗ ${e.nombre}: ${e.razon}`))
  }

  if (DRY_RUN) {
    console.log(`\nTotal a cambiar: ${cambios.length} | Errores: ${errores.length}`)
    console.log('Corré con --apply para confirmar.')
    return
  }

  // Aplicar en lotes de 50 por tipo
  const porTipo = new Map()
  cambios.forEach(c => { if (!porTipo.has(c.tcNuevo)) porTipo.set(c.tcNuevo, []); porTipo.get(c.tcNuevo).push(c.id) })

  let ok = 0, fail = 0
  for (const [tc, ids] of porTipo.entries()) {
    for (let i = 0; i < ids.length; i += 50) {
      const lote = ids.slice(i, i + 50)
      const { error } = await sb.from('recipes').update({ tipo_componente: tc }).in('id', lote)
      if (error) { console.error(`✗ Error ${tc}:`, error.message); fail += lote.length }
      else { ok += lote.length; process.stdout.write(`\r✅ ${ok}/${cambios.length}...`) }
    }
  }
  console.log(`\n\n🎉 Listo. Actualizadas: ${ok} | Errores: ${fail}`)
}

main().catch(e => { console.error(e); process.exit(1) })

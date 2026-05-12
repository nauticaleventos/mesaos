/**
 * extraer-recetas.mjs
 *
 * Exporta todas las recetas de Supabase a un Excel para auditoría manual.
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node recetas-app/extraer-recetas.mjs
 *
 * O con las variables del .env:
 *   node -e "
 *     const e=require('fs').readFileSync('.env','utf8');
 *     e.split('\n').forEach(l=>{const [k,v]=l.split('=');if(k&&v)process.env[k.trim()]=v.trim()});
 *   " && node recetas-app/extraer-recetas.mjs
 */

import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Leer .env si no hay variables de entorno
const envPath = join(__dirname, '../.env')
try {
  const env = readFileSync(envPath, 'utf8')
  env.split('\n').forEach(line => {
    const [k, ...rest] = line.split('=')
    if (k && rest.length) {
      const v = rest.join('=').trim()
      if (!process.env[k.trim()]) process.env[k.trim()] = v
    }
  })
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_KEY (o VITE_SUPABASE_ANON_KEY)')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Cargar todas las recetas ──────────────────────────────────────────────────
async function cargarRecetas() {
  const todas = []
  let from = 0
  while (true) {
    const { data, error } = await sb
      .from('recipes')
      .select('id,nombre,tipo_componente,tipo_comida,perfiles,porciones,tiempo_total_min,dificultad,costo_estimado,source,is_active_for_menu,ingredientes,pasos,imagen_url,info_nutricional_aprox')
      .range(from, from + 199)
      .order('nombre')
    if (error) { console.error(error.message); process.exit(1) }
    if (!data || data.length === 0) break
    todas.push(...data)
    if (data.length < 200) break
    from += 200
    process.stdout.write(`\r  Cargando... ${todas.length} recetas`)
  }
  console.log(`\n  Total: ${todas.length} recetas`)
  return todas
}

// ── Formatear ingredientes como texto resumido ────────────────────────────────
function resumenIngredientes(ings) {
  if (!ings || ings.length === 0) return ''
  return ings.slice(0, 6).map(i => `${i.nombre} (${i.categoria ?? '?'})`).join(', ') +
    (ings.length > 6 ? ` ... +${ings.length - 6} más` : '')
}

// ── Construir filas del Excel ─────────────────────────────────────────────────
function buildRows(recetas) {
  return recetas.map((r, i) => ({
    '#':                i + 1,
    'ACCIÓN':           '',
    'NOTAS':            '',
    'ID':               r.id,
    'NOMBRE':           r.nombre,
    'TIPO_COMPONENTE':  r.tipo_componente ?? '',
    'TIPO_COMIDA':      (r.tipo_comida ?? []).join(', '),
    'VEG':              r.perfiles?.vegetariana === true ? 'SI' : r.perfiles?.vegetariana === false ? 'NO' : '?',
    'KETO':             r.perfiles?.keto === true ? 'SI' : r.perfiles?.keto === false ? 'NO' : '?',
    'PORCIONES':        r.porciones ?? '',
    'TIEMPO_MIN':       r.tiempo_total_min ?? '',
    'DIFICULTAD':       r.dificultad ?? '',
    'COSTO':            r.costo_estimado ?? '',
    'SOURCE':           r.source ?? '',
    'ACTIVA':           r.is_active_for_menu ? 'SI' : 'NO',
    'INGREDIENTES':     resumenIngredientes(r.ingredientes),
    'PASOS':            Array.isArray(r.pasos) ? r.pasos.length : 0,
    'IMAGEN':           r.imagen_url ? 'SI' : 'NO',
    'CALORIAS':         r.info_nutricional_aprox?.calorias_porcion ?? '',
    'PROTEINA_G':       r.info_nutricional_aprox?.proteina_g ?? '',
  }))
}

// ── Hoja de instrucciones ─────────────────────────────────────────────────────
function buildInstructions() {
  return [
    ['CÓMO REVISAR LAS RECETAS'],
    [''],
    ['En la columna ACCIÓN, escribí una de estas opciones:'],
    [''],
    ['ACCIÓN',          'Qué hace'],
    ['OK',              'La receta está bien, no tocar nada'],
    ['proteina_principal', 'Cambiar tipo_componente a proteína principal (pollo, carne, pescado, huevo, tofu como plato principal)'],
    ['guarnicion',      'Cambiar a guarnición (arroz, papa, yuca, pasta, vegetales asados como acompañamiento)'],
    ['ensalada',        'Cambiar a ensalada (mezclas de vegetales crudos)'],
    ['salsa',           'Cambiar a salsa (mayonesa, chimichurri, pesto, hogao, aderezos espesos)'],
    ['vinagreta',       'Cambiar a vinagreta (aderezos líquidos para ensaladas)'],
    ['plato_unico',     'Cambiar a plato único (sancochos, ajiacos, lasañas, pizzas completas, bandejas)'],
    ['postre',          'Cambiar a postre'],
    ['bebida',          'Cambiar a bebida'],
    ['merienda',        'Cambiar a merienda (snacks, empanadas, granolas, pancakes)'],
    ['ELIMINAR',        'Quitar de la BD (duplicada, mala calidad, irrelevante)'],
    ['NO_VEG',          'Tiene vegetariana=SI pero tiene proteína animal → corregir a NO'],
    ['SI_VEG',          'Tiene vegetariana=NO pero es realmente vegetariana → corregir a SI'],
    [''],
    ['⚡ Podés combinar acciones con +:'],
    ['   Ejemplo: proteina_principal+NO_VEG'],
    [''],
    ['⚠️  NO borres ni cambies la columna ID — es necesaria para aplicar los cambios'],
    [''],
    ['Cuando termines, avisale a Claude: "ya terminé de revisar"'],
  ]
}

// ── Generar Excel ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🔄 Conectando a Supabase...')
  const recetas = await cargarRecetas()

  const wb = XLSX.utils.book_new()

  // ── Hoja principal ──────────────────────────────────────────────────────────
  const rows   = buildRows(recetas)
  const ws     = XLSX.utils.json_to_sheet(rows)

  // Anchos de columna
  ws['!cols'] = [
    { wch: 5  },  // #
    { wch: 22 },  // ACCIÓN
    { wch: 30 },  // NOTAS
    { wch: 10 },  // ID
    { wch: 45 },  // NOMBRE
    { wch: 20 },  // TIPO_COMPONENTE
    { wch: 22 },  // TIPO_COMIDA
    { wch: 5  },  // VEG
    { wch: 5  },  // KETO
    { wch: 8  },  // PORCIONES
    { wch: 9  },  // TIEMPO_MIN
    { wch: 9  },  // DIFICULTAD
    { wch: 7  },  // COSTO
    { wch: 14 },  // SOURCE
    { wch: 7  },  // ACTIVA
    { wch: 60 },  // INGREDIENTES
    { wch: 6  },  // PASOS
    { wch: 7  },  // IMAGEN
    { wch: 8  },  // CALORIAS
    { wch: 10 },  // PROTEINA_G
  ]

  // Freeze: fila 1 + columnas hasta E (para que NOMBRE siempre se vea)
  ws['!freeze'] = { xSplit: 4, ySplit: 1 }

  // Autofilter en todas las columnas
  const range = XLSX.utils.decode_range(ws['!ref'])
  ws['!autofilter'] = { ref: XLSX.utils.encode_range(range) }

  // Estilos de cabecera (coral + texto blanco)
  const headers = Object.keys(rows[0])
  headers.forEach((h, col) => {
    const addr = XLSX.utils.encode_cell({ r: 0, c: col })
    if (!ws[addr]) return
    ws[addr].s = {
      fill:  { fgColor: { rgb: 'E76F51' }, patternType: 'solid' },
      font:  { bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: 'center' },
    }
  })

  // Fondo amarillo claro en columna B (ACCIÓN) y crema en C (NOTAS)
  for (let row = 1; row <= recetas.length; row++) {
    const accion = XLSX.utils.encode_cell({ r: row, c: 1 })
    const notas  = XLSX.utils.encode_cell({ r: row, c: 2 })
    if (!ws[accion]) ws[accion] = { t: 's', v: '' }
    if (!ws[notas])  ws[notas]  = { t: 's', v: '' }
    ws[accion].s = { fill: { fgColor: { rgb: 'FFFACC' }, patternType: 'solid' } }
    ws[notas].s  = { fill: { fgColor: { rgb: 'FFF8F0' }, patternType: 'solid' } }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'Recetas')

  // ── Hoja instrucciones ──────────────────────────────────────────────────────
  const wsInstr = XLSX.utils.aoa_to_sheet(buildInstructions())
  wsInstr['!cols'] = [{ wch: 20 }, { wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInstr, 'INSTRUCCIONES')

  // ── Guardar ─────────────────────────────────────────────────────────────────
  const outPath = join(__dirname, 'recetas-auditoria.xlsx')
  XLSX.writeFile(wb, outPath)
  console.log(`\n✅ Excel generado con ${recetas.length} recetas en:`)
  console.log(`   ${outPath}`)
  console.log('\nAbrilo, revisalo, llenás la columna ACCIÓN y cuando termines avisame.')
}

main().catch(e => { console.error(e); process.exit(1) })

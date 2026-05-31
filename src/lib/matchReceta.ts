/**
 * matchReceta.ts — Capa 1: matching flexible entre receta e inventario
 *
 * Función pura (sin async). Usa un mapa local de sustituciones para cubrir
 * los casos más comunes sin requerir llamada a BD.
 */

// ── Sustituciones locales (las más comunes, sin llamada a BD) ─────────────────
// Clave: ingrediente normalizado → lista de posibles sustitutos normalizados
const LOCAL_SUBS: Record<string, string[]> = {
  'leche':                 ['leche de almendras','leche de coco','leche de avena','leche de ajonjolí','leche de vaca'],
  'leche de vaca':         ['leche de almendras','leche de coco','leche de avena','leche de ajonjolí','leche'],
  'leche de almendras':    ['leche de coco','leche de avena','leche de vaca','leche'],
  'leche de coco':         ['leche de almendras','leche de avena','leche de vaca','leche'],
  'mantequilla':           ['aceite de coco','aceite de oliva','margarina vegetal'],
  'crema de leche':        ['crema de coco','yogur griego','leche de coco'],
  'queso':                 ['queso fresco','queso campesino','tofu firme'],
  'queso fresco':          ['queso campesino','queso costeño','tofu firme'],
  'harina de trigo':       ['harina de almendras','harina de avena','harina de arroz','harina de coco'],
  'harina de almendras':   ['harina de avena','harina de coco','harina de trigo'],
  'azúcar':                ['panela','miel','stevia','azúcar de coco','azúcar morena','azúcar moreno','azúcar rubia','azúcar blanca'],
  'azucar':                ['panela','miel','stevia','azucar de coco','azucar morena','azucar moreno','azucar rubia'],
  'azúcar morena':         ['azúcar','azúcar moreno','panela','azúcar rubia'],
  'azucar morena':         ['azucar','azucar moreno','panela'],
  'azúcar moreno':         ['azúcar','azúcar morena','panela','azúcar rubia'],
  'azucar moreno':         ['azucar','azucar morena','panela'],
  'azúcar rubia':          ['azúcar','azúcar morena','panela'],
  'azúcar blanca':         ['azúcar','azúcar morena'],
  'panela':                ['azúcar','azúcar morena','azúcar moreno','miel'],
  'pollo':                 ['pavo','tofu','tempeh','seitán'],
  'pechuga de pollo':      ['pavo','tofu','tempeh'],
  'carne de res':          ['carne de cerdo','pavo molido','lentejas'],
  'carne molida':          ['pavo molido','lentejas','carne de cerdo molida'],
  'arroz blanco':          ['quinoa','arroz integral','arroz de coliflor','arroz'],
  'arroz':                 ['quinoa','arroz integral'],
  'papa':                  ['yuca','batata','ñame','coliflor'],
  'aceite vegetal':        ['aceite de oliva','aceite de coco','aceite de girasol'],
  'aceite de girasol':     ['aceite vegetal','aceite de oliva'],
  'vinagre':               ['jugo de limón','vinagre de manzana','vinagre balsámico'],
  'limón':                 ['naranja','maracuyá','vinagre de manzana'],
  'huevo':                 ['huevo de codorniz'],
}

export type MatchEstado = 'cocinable_ahora' | 'casi_listo' | 'requiere_mercado' | 'no_sugerible'

export interface Faltante {
  nombre:    string
  esencial:  boolean
  sustituto: string | null   // nombre del sustituto disponible en nevera, o null
  notaSustituto: string | null
}

export interface MatchResult {
  porcentaje: number
  estado:     MatchEstado
  faltantes:  Faltante[]
}

// ─────────────────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().trim()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // quitar tildes
}

/** True si el inventario contiene este ingrediente (match parcial + sustituciones) */
export function inventarioTiene(
  inventario: { name: string }[],
  ingrediente:  string,
): { tiene: boolean; porSubstituto: boolean; sustitutoUsado: string | null } {
  const nIng = norm(ingrediente)
  const fridgeNorm = inventario.map(f => norm(f.name))

  // Match directo o parcial
  const directa = fridgeNorm.some(f => f.includes(nIng) || nIng.includes(f))
  if (directa) return { tiene: true, porSubstituto: false, sustitutoUsado: null }

  // Match por sustitución local
  const subs = LOCAL_SUBS[nIng] ?? []
  for (const sub of subs) {
    const nSub = norm(sub)
    if (fridgeNorm.some(f => f.includes(nSub) || nSub.includes(f))) {
      return { tiene: true, porSubstituto: true, sustitutoUsado: sub }
    }
  }

  // Buscar también en sentido inverso: si la nevera tiene algo que es substituto de este ing.
  for (const [original, subList] of Object.entries(LOCAL_SUBS)) {
    if (subList.includes(nIng) && fridgeNorm.some(f => f.includes(norm(original)) || norm(original).includes(f))) {
      return { tiene: true, porSubstituto: true, sustitutoUsado: original }
    }
  }

  return { tiene: false, porSubstituto: false, sustitutoUsado: null }
}

/**
 * Calcula el % de match entre una receta y el inventario de la nevera.
 * Esenciales valen 80%, opcionales 20%.
 * Sustituciones se cuentan como disponibles.
 */
export function calcularMatch(
  ingredientes: { nombre: string; esencial: boolean }[],
  inventario:   { name: string }[],
): MatchResult {
  const esenciales = ingredientes.filter(i => i.esencial)
  const opcionales = ingredientes.filter(i => !i.esencial)

  const faltantes: Faltante[] = []

  let esencialesDisponibles = 0
  for (const ing of esenciales) {
    const { tiene, sustitutoUsado } = inventarioTiene(inventario, ing.nombre)
    if (tiene) {
      esencialesDisponibles++
    } else {
      faltantes.push({
        nombre: ing.nombre,
        esencial: true,
        sustituto: sustitutoUsado,
        notaSustituto: sustitutoUsado ? `Podés usar ${sustitutoUsado}` : null,
      })
    }
  }

  let opcionalesDisponibles = 0
  for (const ing of opcionales) {
    const { tiene, sustitutoUsado } = inventarioTiene(inventario, ing.nombre)
    if (tiene) {
      opcionalesDisponibles++
    } else {
      faltantes.push({
        nombre: ing.nombre,
        esencial: false,
        sustituto: sustitutoUsado,
        notaSustituto: sustitutoUsado ? `Podés usar ${sustitutoUsado}` : null,
      })
    }
  }

  const scoreEsenciales = esenciales.length > 0
    ? (esencialesDisponibles / esenciales.length) * 80
    : 80

  const scoreOpcionales = opcionales.length > 0
    ? (opcionalesDisponibles / opcionales.length) * 20
    : 20

  const porcentaje = Math.round(scoreEsenciales + scoreOpcionales)

  const estado: MatchEstado =
    porcentaje === 100 ? 'cocinable_ahora' :
    porcentaje >= 70   ? 'casi_listo'       :
    porcentaje >= 40   ? 'requiere_mercado' :
                         'no_sugerible'

  return { porcentaje, estado, faltantes }
}

/** Icono y etiqueta para mostrar en la UI */
export function matchBadge(estado: MatchEstado): { icon: string; label: string; color: string } {
  switch (estado) {
    case 'cocinable_ahora':  return { icon: '✅', label: 'Tienes todo', color: 'text-oliva' }
    case 'casi_listo':       return { icon: '🛒', label: 'Casi listo',  color: 'text-yellow-600' }
    case 'requiere_mercado': return { icon: '💭', label: 'Falta mercar', color: 'text-muted' }
    case 'no_sugerible':     return { icon: '❌', label: 'Faltan muchos', color: 'text-error' }
  }
}

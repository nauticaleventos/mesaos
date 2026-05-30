// Utilidades para mostrar porciones por miembro con emojis visuales

export type IngredienteMin = { nombre: string; categoria: string }

// ── Mapeo nombre de ingrediente → emoji ──────────────────────────────────────

const PROTEIN_MAP: [RegExp, string][] = [
  [/pollo|pechuga|muslo|taco|pavo|codorniz/i,               '🍗'],
  [/res|carne|lomo|cerdo|chuleta|cordero|borrego/i,         '🥩'],
  [/salm[oó]n/i,                                             '🐟'],
  [/at[uú]n/i,                                               '🍣'],
  [/camar[oó]n|langostino|langosta/i,                        '🦐'],
  [/huevo/i,                                                  '🥚'],
  [/tofu|soja|soya/i,                                         '🧈'],
  [/lenteja|garbanzo|frijol|fréjol|habichuela|alubia/i,     '🫘'],
  [/pescado|tilapia|bagre|robalo|mojarra|merluza/i,          '🐟'],
  [/sardina|anchoa/i,                                        '🐟'],
  [/jam[oó]n|chorizo|salchicha|tocino|embutido/i,           '🥩'],
  [/yogur|queso|leche|lácteo|lacteo|mantequilla|crema/i,    '🥛'],
]

const CARB_MAP: [RegExp, string][] = [
  [/arroz/i,                                                 '🍚'],
  [/pasta|fideo|espagueti|macarr[oó]n|tallar[íi]n/i,       '🍝'],
  [/papa|patata/i,                                           '🥔'],
  [/yuca|pl[áa]tano|maduro/i,                               '🍠'],
  [/pan|arepa|tortilla/i,                                    '🍞'],
  [/quinoa|quinua|trigo|cebada|mijo/i,                      '🌾'],
  [/ensalada|lechuga|espinaca|r[úu]cula/i,                  '🥗'],
  [/verdura|br[oó]coli|coliflor|zanahoria|calabac/i,        '🥦'],
]

function matchFirst(map: [RegExp, string][], nombre: string): string | null {
  for (const [rx, emoji] of map) {
    if (rx.test(nombre)) return emoji
  }
  return null
}

/**
 * Infiere los emojis de proteína y carbohidrato a partir de la lista de ingredientes.
 * Busca primero por nombre, luego por categoría.
 */
export function inferirEmojisReceta(
  ingredientes: IngredienteMin[]
): { protein: string; carb: string } {
  let protein = '🍗'  // fallback
  let carb    = '🍚'  // fallback

  // Buscar proteína por nombre
  for (const i of ingredientes) {
    const m = matchFirst(PROTEIN_MAP, i.nombre)
    if (m) { protein = m; break }
  }
  // Fallback proteína por categoría
  if (protein === '🍗') {
    const esPescado = ingredientes.some(i => i.categoria === 'proteina_animal' && /pescado|salm|rob|tilapia/i.test(i.nombre))
    if (esPescado) protein = '🐟'
  }

  // Buscar carbohidrato por nombre
  for (const i of ingredientes) {
    const m = matchFirst(CARB_MAP, i.nombre)
    if (m) { carb = m; break }
  }

  return { protein, carb }
}

// ── Multiplicador → fracción visual ──────────────────────────────────────────

export function multToFraccion(mult: number): string {
  if (mult < 0.85) return '½'
  if (mult < 1.25) return '1'
  if (mult < 1.75) return '1½'
  return '2'
}

// ── Emoji y medida por tipo_componente ────────────────────────────────────────

type TipoComp = string | null | undefined

interface TipoSlot {
  emoji1: string; medida1: string; etiqueta1: string; mano1: string | null
  emoji2: string | null; medida2: string | null; etiqueta2: string | null; mano2: string | null
}

function emojiYMedidaPorTipo(
  tipoComponente: TipoComp,
  proteinEmoji:   string,
  carbEmoji:      string,
): TipoSlot {
  switch (tipoComponente) {
    case 'proteina_principal':
      return { emoji1: proteinEmoji, medida1: 'palma', etiqueta1: 'Proteína', mano1: '✋', emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'guarnicion':
      return { emoji1: carbEmoji, medida1: 'puño', etiqueta1: 'Guarnición', mano1: '✊', emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'ensalada':
      return { emoji1: '🥗', medida1: 'plato', etiqueta1: 'Ensalada', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'salsa':
    case 'vinagreta':
      return { emoji1: '🫙', medida1: 'cdas', etiqueta1: 'Salsa', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'postre':
      return { emoji1: '🍮', medida1: 'porción', etiqueta1: 'Postre', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'bebida':
      return { emoji1: '🥤', medida1: 'vaso', etiqueta1: 'Bebida', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'merienda':
    case 'plato_unico':
    case 'completo':
    default:
      return { emoji1: proteinEmoji, medida1: 'palma', etiqueta1: 'Proteína', mano1: '✋', emoji2: carbEmoji, medida2: 'puño', etiqueta2: 'Guarnición', mano2: '✊' }
  }
}

// ── Formatea la línea de porción para UN miembro ─────────────────────────────

export function formatPorcionMiembro(
  memberEmoji:    string,
  memberName:     string,
  mult:           number,
  proteinEmoji  = '🍗',
  carbEmoji     = '🍚',
  tipoComponente?: TipoComp,
): string {
  const frac = multToFraccion(mult)
  const { emoji1, medida1, etiqueta1, mano1, emoji2, medida2, etiqueta2, mano2 } = emojiYMedidaPorTipo(tipoComponente, proteinEmoji, carbEmoji)

  const b1 = `${emoji1} ${etiqueta1} ${frac} ${medida1}${mano1 ? ' ' + mano1 : ''}`
  if (emoji2) {
    const b2 = `${emoji2} ${etiqueta2} ${frac} ${medida2}${mano2 ? ' ' + mano2 : ''}`
    return `${memberEmoji} ${memberName}: ${b1} · ${b2}`
  }
  return `${memberEmoji} ${memberName}: ${b1}`
}

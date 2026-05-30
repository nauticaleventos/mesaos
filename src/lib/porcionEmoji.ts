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

function emojiYMedidaPorTipo(
  tipoComponente: TipoComp,
  proteinEmoji:   string,
  carbEmoji:      string,
): { emoji1: string; medida1: string; emoji2: string | null; medida2: string | null } {
  switch (tipoComponente) {
    case 'proteina_principal':
      return { emoji1: proteinEmoji, medida1: 'palma', emoji2: null, medida2: null }
    case 'guarnicion':
      return { emoji1: carbEmoji, medida1: 'puño', emoji2: null, medida2: null }
    case 'ensalada':
      return { emoji1: '🥗', medida1: 'plato', emoji2: null, medida2: null }
    case 'salsa':
    case 'vinagreta':
      return { emoji1: '🫙', medida1: 'cdas', emoji2: null, medida2: null }
    case 'postre':
      return { emoji1: '🍮', medida1: 'porción', emoji2: null, medida2: null }
    case 'bebida':
      return { emoji1: '🥤', medida1: 'vaso', emoji2: null, medida2: null }
    case 'merienda':
    case 'plato_unico':
    case 'completo':
    default:
      // Plato completo: mostrar proteína + carb si los hay
      return { emoji1: proteinEmoji, medida1: 'palma', emoji2: carbEmoji, medida2: 'puño' }
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
  const { emoji1, medida1, emoji2, medida2 } = emojiYMedidaPorTipo(tipoComponente, proteinEmoji, carbEmoji)

  if (emoji2) {
    return `${memberEmoji} ${memberName}: ${emoji1} ${frac} ${medida1} ${emoji2} ${frac} ${medida2}`
  }
  return `${memberEmoji} ${memberName}: ${emoji1} ${frac} ${medida1}`
}

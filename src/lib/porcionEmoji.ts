// Utilidades para mostrar porciones por miembro con emojis visuales

export type IngredienteMin = { nombre: string; categoria: string }

// ── Mapeo nombre de ingrediente → emoji ──────────────────────────────────────

const PROTEIN_MAP: [RegExp, string][] = [
  [/pollo|pechuga|muslo|taco|pavo|codorniz/i,          '🍗'],
  [/res|carne|lomo|cerdo|chuleta|cordero|borrego/i,    '🥩'],
  [/salm[oó]n/i,                                        '🐟'],
  [/at[uú]n/i,                                          '🍣'],
  [/camar[oó]n|langostino|langosta/i,                   '🦐'],
  [/huevo/i,                                             '🥚'],
  [/tofu|soja|soya/i,                                    '🧈'],
  [/lenteja|garbanzo|frijol|fréjol|habichuela|alubia/i, '🫘'],
  [/pescado|tilapia|bagre|robalo|mojarra|merluza/i,     '🐟'],
  [/sardina|anchoa/i,                                   '🐟'],
  [/jam[oó]n|chorizo|salchicha|tocino|embutido/i,      '🥩'],
]

const CARB_MAP: [RegExp, string][] = [
  [/arroz/i,                  '🍚'],
  [/pasta|fideo|espagueti|macarr[oó]n|tallar[íi]n/i, '🍝'],
  [/papa|patata/i,            '🥔'],
  [/yuca|pl[áa]tano|maduro/i, '🍠'],
  [/pan|arepa|tortilla/i,     '🍞'],
  [/quinoa|quinua|trigo|cebada|mijo/i, '🌾'],
  [/ensalada|lechuga|espinaca|r[úu]cula/i, '🥗'],
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

// ── Formatea la línea de porción para UN miembro ─────────────────────────────

export function formatPorcionMiembro(
  memberEmoji: string,
  memberName:  string,
  mult:        number,
  proteinEmoji = '🍗',
  carbEmoji    = '🍚',
): string {
  const frac = multToFraccion(mult)
  return `${memberEmoji} ${memberName}: ${proteinEmoji} ${frac} palma ${carbEmoji} ${frac} puño`
}

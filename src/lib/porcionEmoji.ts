// Utilidades para mostrar porciones por miembro con emojis visuales

export type IngredienteMin = { nombre: string; categoria: string }

// ── Tubérculos para distinción guarnición ────────────────────────────────────
const TUBERCULOS = /papa|patata|yuca|pl[aá]tano|maduro|batata|[nñ]ame|camote/i

/**
 * Emoji de proteína: siempre 🍗.
 * Emoji de carb: 🥔 si la receta tiene tubérculo, 🍚 si es grano.
 */
export function inferirEmojisReceta(
  ingredientes: IngredienteMin[]
): { protein: string; carb: string } {
  const esTuberculo = ingredientes.some(i => TUBERCULOS.test(i.nombre))
  return { protein: '🍗', carb: esTuberculo ? '🥔' : '🍚' }
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

function emojiYMedidaPorTipo(tipoComponente: TipoComp, carbEmoji: string): TipoSlot {
  switch (tipoComponente) {
    case 'proteina_principal':
      return { emoji1: '🍗', medida1: 'palma', etiqueta1: 'Proteína', mano1: '✋', emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'guarnicion':
      return { emoji1: carbEmoji, medida1: 'puño', etiqueta1: 'Guarnición', mano1: '✊', emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'ensalada':
      return { emoji1: '🥗', medida1: 'plato', etiqueta1: 'Ensalada', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'sopa':
      return { emoji1: '🍲', medida1: 'tazón', etiqueta1: 'Sopa', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'salsa':
    case 'vinagreta':
      return { emoji1: '🫙', medida1: 'cdas', etiqueta1: 'Salsa', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'postre':
      return { emoji1: '🍰', medida1: 'porción', etiqueta1: 'Postre', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'bebida':
      return { emoji1: '🥤', medida1: 'vaso', etiqueta1: 'Bebida', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'merienda':
      return { emoji1: '🍎', medida1: 'porción', etiqueta1: 'Merienda', mano1: null, emoji2: null, medida2: null, etiqueta2: null, mano2: null }
    case 'plato_unico':
    case 'completo':
    default:
      return { emoji1: '🍗', medida1: 'palma', etiqueta1: 'Proteína', mano1: '✋', emoji2: carbEmoji, medida2: 'puño', etiqueta2: 'Guarnición', mano2: '✊' }
  }
}

// ── Formatea la línea de porción para UN miembro ─────────────────────────────

export function formatPorcionMiembro(
  memberEmoji:    string,
  memberName:     string,
  mult:           number,
  _proteinEmoji = '🍗',   // ignorado — siempre 🍗 por tipo_componente
  carbEmoji     = '🍚',
  tipoComponente?: TipoComp,
): string {
  const frac = multToFraccion(mult)
  const { emoji1, medida1, etiqueta1, mano1, emoji2, medida2, etiqueta2, mano2 } = emojiYMedidaPorTipo(tipoComponente, carbEmoji)

  const b1 = `${emoji1} ${etiqueta1} ${frac} ${medida1}${mano1 ? ' ' + mano1 : ''}`
  if (emoji2) {
    const b2 = `${emoji2} ${etiqueta2} ${frac} ${medida2}${mano2 ? ' ' + mano2 : ''}`
    return `${memberEmoji} ${memberName}: ${b1} · ${b2}`
  }
  return `${memberEmoji} ${memberName}: ${b1}`
}

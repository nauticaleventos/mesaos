/**
 * normalizeIngrediente.ts
 *
 * Convierte nombres regionales/variantes al nombre canónico genérico.
 * Se usa en fridgeStore (deduplicación) y en la ingesta de recetas.
 *
 * Dos ingredientes son "el mismo" si normalizeIngrediente() devuelve
 * el mismo string: isSameIngrediente("zapallo", "ahuyama") === true
 */

// ─────────────────────────────────────────────────────────────────────────────
// Mapa canónico: cualquiera de las claves → nombre genérico (minúsculas)
// Orden importa: las entradas más específicas van primero
// ─────────────────────────────────────────────────────────────────────────────
export const CANON: Record<string, string> = {
  // ── Calabaza / zapallo / ahuyama ──────────────────────────────────────────
  'ahuyama':                 'calabaza',
  'auyama':                  'calabaza',
  'zapallo':                 'calabaza',
  'zapayo':                  'calabaza',
  'ayama':                   'calabaza',
  'calabacín':               'calabacín',
  'auyamita':                'calabaza',

  // ── Plátano y banano ──────────────────────────────────────────────────────
  'plátano hartón':          'plátano',
  'platano harton':          'plátano',
  'plátano dominico':        'plátano',
  'plátano popocho':         'plátano',
  'plátano roatán':          'plátano',
  'plátano macho':           'plátano',
  'banano criollo':          'banano',
  'banano bocadillo':        'banano',

  // ── Papa / patata ─────────────────────────────────────────────────────────
  'patata':                  'papa',
  'papa pastusa':            'papa',
  'papa nevada':             'papa',
  'papa capira':             'papa',
  'papa r-12':               'papa',
  'papa criolla pastusa':    'papa criolla',
  'papa criolla capiro':     'papa criolla',

  // ── Tomate ────────────────────────────────────────────────────────────────
  'jitomate':                'tomate',
  'tomate chonto':           'tomate',
  'tomate larga vida':       'tomate',
  'tomate milano':           'tomate',
  'tomate de mesa':          'tomate',
  'tomate cherry maduro':    'tomate cherry',
  'tomate uva':              'tomate cherry',

  // ── Maíz regional ─────────────────────────────────────────────────────────
  'elote':                   'maíz',
  'choclo':                  'maíz',
  'jojoto':                  'maíz',
  'maíz pira':               'maíz',
  'maíz blanco trillado':    'maíz',
  'maíz amarillo trillado':  'maíz',

  // ── Frijol / judía / poroto ───────────────────────────────────────────────
  'judía':                   'frijol',
  'poroto':                  'frijol',
  'habichuela':              'frijol',
  'frijol cargamanto':       'frijol',
  'frijol bolo':             'frijol',
  'frijol radical':          'frijol',
  'frijol rojo nacional':    'frijol rojo',
  'caraota':                 'frijol negro',
  'caraotas':                'frijol negro',

  // ── Aguacate / palta ──────────────────────────────────────────────────────
  'palta':                   'aguacate',

  // ── Cilantro ──────────────────────────────────────────────────────────────
  'culantro':                'cilantro',
  'coriandro':               'cilantro',
  'cilantro cimarrón':       'cilantro de monte',
  'cimarrón':                'cilantro de monte',

  // ── Pimiento / ají ────────────────────────────────────────────────────────
  'morrón':                  'pimiento',
  'capsicum':                'pimiento',
  'locoto':                  'ají picante',
  'chile chipotle':          'chile ahumado',
  'chile mulato':            'chile seco',
  'ají dulce cacique':       'ají dulce',
  'ají pimiento':            'pimiento',
  'ají rocoto':              'ají picante',
  'cebolla cabezona blanca': 'cebolla blanca',
  'cebolla cabezona roja':   'cebolla roja',
  'cebolla cabezona':        'cebolla',
  'cebolla junca':           'cebolla de verdeo',
  'cebolla larga':           'cebolla de verdeo',
  'cebolla de rama':         'cebolla de verdeo',

  // ── Frutas con variantes regionales ──────────────────────────────────────
  'mora castilla':           'mora',
  'mora larga':              'mora',
  'mora de castilla':        'mora',
  'maracuyá amarillo':       'maracuyá',
  'maracuyá morado':         'maracuyá',
  'guayaba manzana':         'guayaba',
  'guayaba pera':            'guayaba',
  'mango tommy':             'mango',
  'mango criollo':           'mango',
  'mango de azúcar':         'mango',
  'naranja valencia':        'naranja',
  'naranja tangelo':         'naranja',
  'limón tahití':            'limón',
  'limón tahiti':            'limón',
  'limón pajarito':          'limón',
  'mandarina arrayana':      'mandarina',
  'mandarina oneco':         'mandarina',
  'piña manzana':            'piña',
  'piña cayena':             'piña',

  // ── Carne y aves ─────────────────────────────────────────────────────────
  'pollo de engorde':        'pollo',
  'pollo campesino':         'pollo',
  'carne de res criolla':    'carne de res',
  'res criolla':             'carne de res',
  'cerdo criollo':           'cerdo',

  // ── Yuca y tubérculos andinos ────────────────────────────────────────────
  'yuca casabe':             'yuca',
  'yuca blanca':             'yuca',
  'ñame espino':             'ñame',
  'ñame criollo':            'ñame',
  'jilo':                    'berenjena pequeña',
  'guatila':                 'chayote',
  'cidra':                   'chayote',
  'cubio':                   'papa nabo',
  'ruba':                    'papa nabo',
  'bore':                    'malanga',

  // ── Lácteos ───────────────────────────────────────────────────────────────
  'leche entera pasteurizada': 'leche',
  'leche pasteurizada':      'leche',
  'crema de leche nacional': 'crema de leche',
  'queso campesino':         'queso fresco',
  'queso costeño':           'queso',
  'queso doble crema':       'queso',
  'suero costeño':           'crema agria',

  // ── Aceites y grasas ─────────────────────────────────────────────────────
  'aceite vegetal refinado': 'aceite vegetal',
  'aceite de maíz':          'aceite vegetal',
  'aceite de girasol':       'aceite vegetal',
  'aceite de palma':         'aceite vegetal',
  'margarina vegetal':       'mantequilla',

  // ── Endulzantes ───────────────────────────────────────────────────────────
  'panela raspadura':        'panela',
  'panela molida':           'panela',
  'azúcar blanca':           'azúcar',
  'azúcar refinada':         'azúcar',
  'arequipe':                'dulce de leche',

  // ── Condimentos ───────────────────────────────────────────────────────────
  'achiote en semilla':      'achiote',
  'color vegetal':           'achiote',
  'sal marina fina':         'sal',
  'sal refinada':            'sal',
  'hogao':                   'sofrito',
  'guascas':                 'hierbas secas',
  'bocadillo':               'pasta de guayaba',
}

// Sufijos de "ruido" a eliminar si no aportan significado
const NOISE_SUFFIXES = [
  ' fresco', ' fresca',
  ' natural', ' artesanal',
  ' cruda', ' crudo',
  ' pasteurizado', ' pasteurizada',
  ' importado', ' importada',
  ' nacional',
  ' de primera calidad', ' de calidad', ' orgánico', ' orgánica',
]

// ─────────────────────────────────────────────────────────────────────────────

/** Devuelve el nombre canónico (minúsculas, sin variante regional) */
export function normalizeIngrediente(raw: string): string {
  if (!raw) return raw
  let n = raw.trim().toLowerCase()

  // 1. Match exacto en CANON
  if (CANON[n]) return CANON[n]

  // 2. Match por clave contenida al inicio ("zapallo verde" → "calabaza")
  for (const [key, val] of Object.entries(CANON)) {
    if (n.startsWith(key)) return val
  }

  // 3. Eliminar sufijos de ruido
  for (const suffix of NOISE_SUFFIXES) {
    if (n.endsWith(suffix)) {
      n = n.slice(0, -suffix.length).trim()
      break
    }
  }

  // 4. Capitalizar primera letra
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** True si dos nombres de ingrediente refieren al mismo producto */
export function isSameIngrediente(a: string, b: string): boolean {
  return normalizeIngrediente(a).toLowerCase() === normalizeIngrediente(b).toLowerCase()
}

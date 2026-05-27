import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getMondayOfWeek } from '../lib/motorMenu'
import type { FridgeItem } from './fridgeStore'

export interface ShoppingListItem {
  id:                 string
  shopping_list_id:   string
  ingrediente_nombre: string
  cantidad_total:     number
  unidad:             string
  categoria_pasillo:  string
  en_nevera:          boolean
  faltante:           boolean
  comprado:           boolean
  recetas_origen:     string[]
}

interface ShoppingListState {
  listId:    string | null
  items:     ShoppingListItem[]
  loading:   boolean
  generating: boolean

  loadList:     (familyId: string) => Promise<void>
  generateList: (familyId: string, fridgeItems: FridgeItem[]) => Promise<void>
  toggleComprado: (itemId: string, value: boolean) => Promise<void>
}

// ── Mapeo categoría de ingrediente → pasillo ──────────────────────────────────
const CATEGORIA_A_PASILLO: Record<string, string> = {
  proteina_animal: 'carniceria',
  embutido:        'carniceria',
  lacteo:          'lacteos_huevos',
  vegetal:         'frutas_verduras',
  fruta:           'frutas_verduras',
  grano:           'granos_pastas',
  legumbre:        'granos_pastas',
  condimento:      'aceites_condimentos',
  bebida:          'bebidas',
  snack:           'snacks_dulces',
  otro:            'otros',
}

// Override de pasillo por nombre — búsqueda por prefijo/inclusión en resolverPasillo()
// Organizado por categoría. Cubre >95% de ingredientes comunes colombianos.
const KEYWORDS_PASILLO: [string, string][] = [
  // FRUTAS Y VERDURAS
  ...['manzana','banana','platano','platano maduro','platano verde','naranja','limon','mandarina','fresa','mango','papaya','pina','sandia','melon','uva','pera','durazno','ciruela','granadilla','lulo','maracuya','mora','guayaba','tomate de arbol','kiwi','aguacate','lechuga','espinaca','acelga','kale','rucula','tomate','cebolla','cebolla larga','cebolleta','cebollita','cebollino','ajo','zanahoria','papa','papa criolla','yuca','name','batata','arracacha','remolacha','rabano','pepino','calabacin','zapallo','ahuyama','brocoli','coliflor','repollo','apio','pimenton','aji','jalapen','choclo','mazorca','habichuela','judia verde','vaina','alverja','arveja','frijol verde','esparrago','alcachofa','cilantro','perejil','hierbabuena','menta','albahaca','romero','tomillo','oregano fresco','hinojo','champinon','portobello','jengibre','curcuma','limonaria','palmito','guineo','platano','palta','ñame'].map(k => [k, 'frutas_verduras'] as [string, string]),

  // CARNICERÍA
  ...['carne','res','ternera','pollo','gallina','pavo','cerdo','marrano','chuleta','lomo','costilla','pierna','pernil','pechuga','muslo','contramuslo','ala ','alitas','carne molida','carne para asar','posta','sobrebarriga','higado','rinon','corazon','lengua','mondongo','callos','bofes','chorizo','salchicha','salchichon','jamon','tocino','tocineta','panceta','butifarra','longaniza','cabano','mortadela','salami','prosciutto'].map(k => [k, 'carniceria'] as [string, string]),

  // PESCADERÍA
  ...['pescado','tilapia','mojarra','robalo','pargo','dorado','sierra','mero','trucha','bonito','lenguado','bagre','capaz','bocachico','anchoa','sardina','camaron','langostino','gamba','calamar','pulpo','mejillon','almeja','ostra','langosta','jaiba','cangrejo','salmon','atun'].map(k => [k, 'pescaderia'] as [string, string]),

  // LÁCTEOS Y HUEVOS
  ...['leche','leche entera','leche descremada','leche deslactosada','leche de coco','leche de almendra','queso','queso campesino','queso costeno','queso parmesano','queso cheddar','queso mozzarella','queso blanco','queso fresco','ricota','requeson','yogurt','yogur','kumis','kefir','mantequilla','margarina','ghee','crema de leche','crema agria','suero','suero costeno','huevo','claras','yemas'].map(k => [k, 'lacteos_huevos'] as [string, string]),

  // PANADERÍA
  ...['pan ','baguette','pan tajado','pan campesino','pan integral','pan de hamburguesa','pan de molde','croissant','brioche','arepa','buñuelo','mantecada','pretzel','tortilla de harina','tortilla de maiz'].map(k => [k, 'panaderia'] as [string, string]),

  // GRANOS Y PASTAS
  ...['arroz','pasta','espagueti','fideos','macarrones','ravioli','lasagna','fettuccine','penne','rigatoni','lenteja','frijol','garbanzo','alubia','judia seca','soja','edamame','quinoa','quinua','avena','salvado','cebada','trigo','bulgur','cuscus','mijo','amaranto','harina de maiz','harina de trigo','harina de almendra','harina de coco','pan rallado','polenta','semola','maicena','fecula','almidon'].map(k => [k, 'granos_pastas'] as [string, string]),

  // ENLATADOS Y CONSERVAS
  ...['atun en lata','sardina enlatada','anchoas en lata','pasta de tomate','tomate triturado','tomate en lata','frijol enlatado','garbanzo enlatado','lentejas enlatadas','leche condensada','leche evaporada','maiz dulce en lata','palmitos en lata','alcachofas en lata','aceitunas','alcaparras','pepinillos','choclo en lata'].map(k => [k, 'enlatados'] as [string, string]),

  // ACEITES, CONDIMENTOS Y ESPECIAS
  ...['aceite','vinagre','sal ','sal marina','pimienta','comino','paprika','pimenton en polvo','aji en polvo','oregano','albahaca seca','tomillo seco','romero seco','laurel','canela','clavo','nuez moscada','cardamomo','anis','hinojo seco','cilantro seco','perejil seco','eneldo','estragón','jengibre en polvo','curcuma','curry','garam masala','mostaza','salsa de soya','salsa inglesa','salsa worcestershire','tabasco','sriracha','mayonesa','ketchup','salsa bbq','vainilla','levadura','polvo de hornear','bicarbonato','gelatina','azucar','azucar morena','azucar de coco','panela','miel','sirope','melaza','jarabe de arce','edulcorante','stevia'].map(k => [k, 'aceites_condimentos'] as [string, string]),

  // SNACKS Y DULCES
  ...['chocolate','cacao en polvo','chips de chocolate','galletas','papas fritas','nachos','doritos','palomitas','maiz pira','mantequilla de mani','nutella','mermelada','arequipe','dulce de leche','almendras','nueces','pistachos','mani','marañones','anacardos','pasas','datiles','higos secos','arandanos secos','ciruelas pasas'].map(k => [k, 'snacks_dulces'] as [string, string]),

  // BEBIDAS
  ...['agua mineral','agua con gas','agua tonica','jugo de naranja','refresco','gaseosa','cola','vino tinto','vino blanco','cerveza','aguardiente','cafe molido','cafe en grano','cafe instantaneo','te verde','te negro','te de manzanilla','kombucha'].map(k => [k, 'bebidas'] as [string, string]),

  // ASEO/HOGAR
  ...['detergente','jabon de manos','jabón en barra','lavaplatos','suavizante','blanqueador','papel higienico','servilletas','papel cocina','esponja','bolsa de basura','desinfectante'].map(k => [k, 'aseo_hogar'] as [string, string]),
]

// Función principal de categorización por nombre
function resolverPasilloNombre(nombre: string): string | null {
  const n = norm(nombre)
  // Búsqueda exacta primero
  for (const [kw, pasillo] of KEYWORDS_PASILLO) {
    if (n === norm(kw)) return pasillo
  }
  // Búsqueda por inclusión (el nombre contiene la keyword o viceversa)
  for (const [kw, pasillo] of KEYWORDS_PASILLO) {
    const nkw = norm(kw)
    if (n.includes(nkw) || nkw.includes(n)) return pasillo
  }
  return null
}

// Detectar pescadería por nombre (cuando categoria = proteina_animal pero es pescado)
const PALABRAS_PESCADO = ['pescado','salmon','tilapia','atun','sardina','bacalao','trucha','merluza','bagre','mojarra','corvina','cachama','robalo','calamar','pulpo','camaron','langostino','cangrejo','mejillon','almeja','ostra','langosta','pargo','mero','dorado','bonito','lenguado','capaz','bocachico','anchoa','gamba','jaiba']
function esPescado(nombre: string) {
  const n = nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  return PALABRAS_PESCADO.some(p => n.includes(p))
}

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

// ── Sistema de normalización para lista de compras ───────────────────────────
// Regla: mostrar QUÉ se compra en la tienda, no cómo se prepara en casa.

// Aliases: variantes de nombre → producto estándar de compra
const ALIASES: Record<string, string> = {
  // Cebollas — en Colombia: cabezona=regular, larga=cebolleta, morada=roja
  'cebolla cabezona': 'cebolla', 'cebollas cabezonas': 'cebolla',
  'cebolla blanca': 'cebolla', 'cebollas blancas': 'cebolla',
  'cebolla cabezona blanca': 'cebolla',
  'cebollas': 'cebolla',
  'cebolla roja': 'cebolla morada', 'cebollas rojas': 'cebolla morada',
  'cebolla junca': 'cebolla larga',  // junca = larga en algunas regiones
  // Pimentones
  'pimenton rojo': 'pimenton', 'pimientos rojos': 'pimenton',
  'pimiento rojo': 'pimenton',
  // Champiñones
  'champinones': 'champinon', 'champiñones': 'champinon',
  'hongo': 'champinon', 'hongos': 'champinon',
  // Tomates — unificar variantes de compra
  'tomates': 'tomate',
  'tomate cherry': 'tomate', 'tomates cherry': 'tomate',
  'tomate roma': 'tomate', 'tomate pera': 'tomate', 'tomates pera': 'tomate',
  // Papas
  'papa comun': 'papa', 'papa pastusa': 'papa', 'papa sabanera': 'papa',
  // Ajos y limones
  'ajos': 'ajo',
  'limones': 'limon',
  // Otros
  'pimientos': 'pimenton', 'pimiento': 'pimenton',
  'hierbabuena': 'menta',
}

// Productos que deben mantenerse tal cual (se compran así en la tienda)
const MANTENER_EXACTO = [
  'carne molida','carne de res molida','pollo molido','cerdo molido',
  'tomate cherry','tomates cherry','tomate chonto','tomates chonto',
  'tomate pera','tomates pera','lomo de cerdo','lomo de res',
  'pasta de tomate','pasta de aji','pasta de chile',
  'leche de coco','crema de leche','leche condensada',
  'pan rallado','pan molido','azucar morena','azucar negra',
  'arroz integral','arroz blanco','arroz negro',
  'frijoles negros','frijoles rojos','lentejas verdes','lentejas rojas',
]

// Prefijos de procesamiento → el ingrediente base es lo que viene después
// "jugo de limón" → "limón", "pasta de ajo" → "ajo", "sopera de edulcorante" → "edulcorante"
const PREFIJOS_PROC = [
  // Partes del ingrediente → el ingrediente base
  'ralladura de cascara de','ralladura de','cascara de',
  'jugo de','zumo de','extracto de','esencia de',
  'pasta de','pure de','puro de','pulpa de',
  'hojas de','semillas de',
  'crema de','mantequilla de',
  'harina de','vinagre de','salsa de',
  // Unidades de medida usadas como nombre: "sopera de X" → X
  'cucharada sopera de','cucharadas soperas de',
  'cucharadita de','cucharaditas de',
  'cucharada de','cucharadas de',
  'sopera de','soperas de',
  'taza de','tazas de',
  'pizca de','pizcas de',
]

// Preparaciones que se hacen en CASA (no cambian lo que comprás en la tienda)
const PREP_CASA = [
  // Corte y procesamiento
  'picado','picada','picados','picadas',
  'rallado','rallada','rallados','ralladas',
  'aplastado','aplastada','aplastados','aplastadas',
  'exprimido','exprimida','exprimidos','exprimidas',
  'triturado','triturada','triturados','trituradas',
  'machacado','machacada','machacados','machacadas',
  'molido','molida','molidos','molidas',
  'troceado','troceada','troceados','troceadas',
  'cortado','cortada','cortados','cortadas',
  'rebanado','rebanada','rebanados','rebanadas',
  'fileteado','fileteada','fileteados','fileteadas',
  'deshuesado','deshuesada','deshuesados','deshuesadas',
  'pelado','pelada','pelados','peladas',
  'desmenuzado','desmenuzada',
  // Forma
  'en rodajas','en cubos','en tiras','en juliana','en brunoise',
  'en trozos','en dados','en laminas','en rebanadas','en mitades',
  'en pedazos','en lascas','en bastones',
  // Cocción
  'cocido','cocida','cocidos','cocidas',
  'crudo','cruda','crudos','crudas',
  'asado','asada','asados','asadas',
  'horneado','horneada',
  'frito','frita','fritos','fritas',
  // Estado
  'fresco','fresca','frescos','frescas',
  'seco','seca','secos','secas',
  'deshidratado','deshidratada',
  'maduro','madura','maduros','maduras',
  'entero','entera','enteros','enteras',
  'natural','naturales',
  'puro','pura','puros','puras',
  // Tamaño
  'mediano','mediana','medianos','medianas',
  'grande','grandes',
  'pequeno','pequena','pequenos','pequenas',
  'chico','chica','chicos','chicas',
  'cabezona','cabezonas','cabezon',
  // Textura/presentación
  'finamente','grueso','gruesa','gruesos','gruesas',
  'fino','fina','finos','finas',
  'al gusto','al dente',
]

function normIngrediente(s: string): string {
  let n = norm(s)

  // 1. Quitar números y fracciones al inicio: "1/2 cebolla" → "cebolla"
  n = n.replace(/^[\d\/\.,\s]+/, '').trim()

  // 2. Revisar si es un producto especial que mantener exacto
  for (const exacto of MANTENER_EXACTO) {
    if (n.includes(norm(exacto))) return norm(exacto)
  }

  // 3. Quitar prefijos de procesamiento: "jugo de limón" → "limón"
  for (const pref of PREFIJOS_PROC) {
    if (n.startsWith(pref)) {
      n = n.slice(pref.length).trim()
      break
    }
  }

  // 4. Quitar unidades de conteo al inicio: "dientes de ajo" → "ajo"
  n = n.replace(/^(dientes?|hojas?|ramas?|cabezas?|trozos?|filetes?|presas?|manojos?|lonjas?|rodajas?|piezas?|gotas?)\s+de\s+/, '')

  // 4b. Quitar unidades de medida embebidas al inicio: "taza de zanahoria" → "zanahoria"
  //     (puede quedar después del strip de número si el ingresado era "1 taza de zanahoria")
  n = n.replace(/^(tazas?|cucharadas?|cucharaditas?|soperas?|gramos?|kilos?|litros?|mililitros?)\s+(de\s+)?/, '')

  // 5. Quitar preparaciones de casa en cualquier posición
  for (const p of PREP_CASA) {
    n = n.replace(new RegExp(`(^|\\s)${p.replace(/\s+/g,'\\s+')}(\\s|$)`, 'g'), ' ').trim()
  }

  // 5b. Quitar palabras sueltas colgadas al final (preposiciones sin complemento)
  // "champiñones shitake en" → "champiñones shitake"
  n = n.replace(/\s+(en|de|con|para|a|y|o)$/, '').trim()
  // "zanahoria para sopa" → "zanahoria"
  n = n.replace(/\s+(para|con)\s+.*$/, '').trim()

  // 6. Aplicar aliases explícitos
  if (ALIASES[n]) n = ALIASES[n]

  return n.trim()
}

// ── Conversión de unidades a base común ───────────────────────────────────────
type Medida = { cantidad: number; unidad: string }

// Unidades de conteo que equivalen a "unidades" para agrupar ingredientes
const UNIDADES_CONTEO = new Set([
  'diente','dientes','hoja','hojas','rama','ramas','cabeza','cabezas',
  'trozo','trozos','filete','filetes','presa','presas','manojo','manojos',
  'loncha','lonchas','rebanada','rebanadas','pieza','piezas','gota','gotas',
  'pizca','pellizco',
])

function normUnidad(u: string): string {
  const ub = (u ?? '').toLowerCase().trim()
  if (UNIDADES_CONTEO.has(ub)) return 'unidades'
  return ub || 'unidades'
}

function convertirABase(cantidad: number, unidad: string): Medida {
  const u = normUnidad(unidad)
  if (u === 'kg')  return { cantidad: cantidad * 1000, unidad: 'g' }
  if (u === 'l')   return { cantidad: cantidad * 1000, unidad: 'ml' }
  return { cantidad, unidad: u }
}

function convertirDesdeBase(cantidad: number, unidad: string): Medida {
  if (unidad === 'g'  && cantidad >= 1000) return { cantidad: cantidad / 1000, unidad: 'kg' }
  if (unidad === 'ml' && cantidad >= 1000) return { cantidad: cantidad / 1000, unidad: 'l' }
  return { cantidad: Math.round(cantidad * 10) / 10, unidad }
}

// ── Generación de la lista ────────────────────────────────────────────────────
async function buildItems(
  familyId: string,
  fridgeItems: FridgeItem[]
): Promise<Omit<ShoppingListItem, 'id' | 'shopping_list_id'>[]> {

  const weekStart = getMondayOfWeek()

  // 1. Traer el menú activo con recetas e ingredientes
  const { data: menuEntries } = await supabase
    .from('weekly_menu')
    .select('recipe_id, servings, meal_type, recipes(nombre, porciones, ingredientes)')
    .eq('family_id', familyId)
    .eq('week_start', weekStart)
    .eq('is_main_recipe', true)

  if (!menuEntries?.length) return []

  // 2. Acumular ingredientes
  // clave: norm(nombre)::unidad_base → { nombre, cantBase, unidadBase, recetas, categoria }
  const acum = new Map<string, {
    nombre: string; cantBase: number; unidadBase: string
    recetas: Set<string>; categoria: string
  }>()

  for (const entry of menuEntries) {
    const recipe = (entry as Record<string, unknown>).recipes as {
      nombre: string; porciones: number | null; ingredientes: { nombre: string; cantidad: number | null; unidad: string | null; categoria: string; esencial: boolean }[]
    } | null
    if (!recipe) continue

    const scale = (recipe.porciones && recipe.porciones > 0)
      ? (entry.servings ?? 1) / recipe.porciones
      : 1

    for (const ing of (recipe.ingredientes ?? [])) {
      if (!ing.esencial) continue
      const cantRaw = (ing.cantidad ?? 1) * scale
      const { cantidad: cantBase, unidad: unidadBase } = convertirABase(cantRaw, ing.unidad ?? 'unidades')
      const nombreBase = normIngrediente(ing.nombre)
      // Clave = solo nombre normalizado — misma clave sin importar la unidad
      const clave = nombreBase

      if (acum.has(clave)) {
        const e = acum.get(clave)!
        // Sumar solo si la unidad base coincide; si difiere, preferir unidad de peso/volumen
        if (e.unidadBase === unidadBase) {
          e.cantBase += cantBase
        } else if (['g','ml'].includes(unidadBase) && !['g','ml'].includes(e.unidadBase)) {
          // La nueva entrada tiene mejor unidad (peso/volumen) → reemplazar
          e.cantBase = cantBase; e.unidadBase = unidadBase
        }
        // Si unidades difieren y la existente ya es g/ml, no reemplazar — simplemente agregar cantidad
        else if (!['g','ml'].includes(unidadBase)) {
          e.cantBase += cantBase  // ambas son conteo → sumar igual
        }
        e.recetas.add(recipe.nombre)
      } else {
        acum.set(clave, {
          nombre:     nombreBase,
          cantBase,
          unidadBase,
          recetas:    new Set([recipe.nombre]),
          categoria:  ing.categoria ?? 'otro',
        })
      }
    }
  }

  // 3. Cruzar con nevera
  const fridgeNorm = fridgeItems.map(f => ({
    nombre: norm(f.name),
    cantidad: f.quantity ?? 0,
    unidad:   (f.unit ?? 'unidades').toLowerCase(),
  }))

  const result: Omit<ShoppingListItem, 'id' | 'shopping_list_id'>[] = []

  for (const [, v] of acum.entries()) {
    const { cantidad, unidad } = convertirDesdeBase(v.cantBase, v.unidadBase)

    // Match contra nevera (nombre normalizado, coincidencia parcial)
    const fridgeMatch = fridgeNorm.find(f =>
      f.nombre.includes(norm(v.nombre)) || norm(v.nombre).includes(f.nombre)
    )

    let enNevera = false
    let faltante = true
    let cantFaltante = cantidad

    if (fridgeMatch) {
      enNevera = true
      const { cantidad: fridgeCantBase } = convertirABase(fridgeMatch.cantidad, fridgeMatch.unidad)
      if (fridgeCantBase >= v.cantBase * 0.8) {
        // Tiene suficiente (80% o más)
        faltante = false
        cantFaltante = 0
      } else {
        // Tiene parcial
        cantFaltante = Math.max(0, cantidad - fridgeMatch.cantidad)
      }
    }

    // Pasillo — orden: keywords ampliados > pescadería por nombre > categoria BD
    const nombreNorm = norm(v.nombre)
    const esFish = esPescado(nombreNorm)

    let pasillo = resolverPasilloNombre(nombreNorm)
      ?? (esFish ? 'pescaderia' : null)
      ?? CATEGORIA_A_PASILLO[v.categoria]
      ?? 'otros'

    result.push({
      ingrediente_nombre: v.nombre,
      cantidad_total:     faltante ? cantFaltante : 0,
      unidad,
      categoria_pasillo:  pasillo,
      en_nevera:          enNevera,
      faltante,
      comprado:           false,
      recetas_origen:     [...v.recetas],
    })
  }

  // Deduplicación final por nombre normalizado (red de seguridad)
  const dedup = new Map<string, typeof result[0]>()
  for (const item of result) {
    const k = normIngrediente(item.ingrediente_nombre)
    if (dedup.has(k)) {
      const existing = dedup.get(k)!
      existing.cantidad_total += item.cantidad_total
      existing.recetas_origen = [...new Set([...existing.recetas_origen, ...item.recetas_origen])]
      if (item.en_nevera) existing.en_nevera = true
      if (!item.faltante) existing.faltante = false
    } else {
      dedup.set(k, { ...item })
    }
  }

  return [...dedup.values()].sort((a, b) => a.categoria_pasillo.localeCompare(b.categoria_pasillo))
}

export const useShoppingListStore = create<ShoppingListState>((set) => ({
  listId:    null,
  items:     [],
  loading:   false,
  generating: false,

  loadList: async (familyId) => {
    set({ loading: true })
    const weekStart = getMondayOfWeek()
    const { data: list } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('family_id', familyId)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (!list) { set({ listId: null, items: [], loading: false }); return }

    const { data: items } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', list.id)
      .order('categoria_pasillo')

    set({ listId: list.id, items: (items ?? []) as ShoppingListItem[], loading: false })
  },

  generateList: async (familyId, fridgeItems) => {
    set({ generating: true })
    const weekStart = getMondayOfWeek()

    // Borrar lista anterior de esta semana si existe
    await supabase.from('shopping_lists')
      .delete().eq('family_id', familyId).eq('week_start', weekStart)

    // Crear nueva lista
    const { data: list } = await supabase
      .from('shopping_lists')
      .insert({ family_id: familyId, week_start: weekStart })
      .select('id').single()

    if (!list) { set({ generating: false }); return }

    // Construir items
    const items = await buildItems(familyId, fridgeItems)

    if (items.length > 0) {
      await supabase.from('shopping_list_items').insert(
        items.map(item => ({ ...item, shopping_list_id: list.id }))
      )
    }

    // Recargar
    const { data: savedItems } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('shopping_list_id', list.id)
      .order('categoria_pasillo')

    set({ listId: list.id, items: (savedItems ?? []) as ShoppingListItem[], generating: false })
  },

  toggleComprado: async (itemId, value) => {
    await supabase.from('shopping_list_items').update({ comprado: value }).eq('id', itemId)
    set(s => ({ items: s.items.map(i => i.id === itemId ? { ...i, comprado: value } : i) }))
  },
}))

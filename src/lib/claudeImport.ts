// Librería cliente para importación de recetas vía /api/import-recipe

export interface IngredienteImport {
  nombre:    string
  categoria: string
  cantidad:  number | null
  unidad:    string | null
  esencial:  boolean
}

export interface RecipeImport {
  nombre:                 string
  descripcion_corta:      string | null
  origen:                 string | null
  tipo_comida:            string[]
  ocasion:                string[]
  tiempo_total_min:       number | null
  tiempo_preparacion_min: number | null
  tiempo_coccion_min:     number | null
  dificultad:             'facil' | 'media' | 'dificil' | null
  porciones:              number | null
  costo_estimado:         'bajo' | 'medio' | 'alto' | null
  ingredientes:           IngredienteImport[]
  pasos:                  string[]
  tags:                   string[]
  info_nutricional_aprox: {
    calorias_porcion:  number
    proteina_g:        number
    carbohidratos_g:   number
    grasa_g:           number
    sodio_mg:          number | null
    azucar_g:          number | null
    fibra_g:           number | null
  } | null
  perfiles: {
    ninos?:           boolean
    vegetariana?:     boolean
    deficit_calorico?:boolean
    embarazadas?:     boolean
    adultos_mayores?: boolean
    keto?:            boolean
  }
  filtros_nutricionales: {
    bajo_sodio?:        boolean
    bajo_azucar?:       boolean
    alto_proteina?:     boolean
    bajo_carbohidratos?:boolean
    alta_fibra?:        boolean
    sin_gluten?:        boolean
    sin_lacteos?:       boolean
    bajo_grasa?:        boolean
    bajo_potasio?:      boolean
    bajo_purinas?:      boolean
  }
  source_url:       string | null
  source_platform:  string | null
  language_original:string | null
  confidence:       'high' | 'medium' | 'low'
  imagen_url?:      string | null
  imagen_credito?:  { fotografo: string; perfil_url: string } | null
}

async function callImportApi(body: object): Promise<RecipeImport> {
  const res = await fetch('/api/import-recipe', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)
  return data.recipe as RecipeImport
}

export async function importFromText(text: string): Promise<RecipeImport> {
  return callImportApi({ type: 'text', content: text })
}

export async function importFromUrl(url: string): Promise<RecipeImport> {
  return callImportApi({ type: 'url', content: url })
}

export async function importFromSocial(url: string): Promise<RecipeImport> {
  return callImportApi({ type: 'social', content: url })
}

export async function importFromPhoto(base64: string, mime = 'image/jpeg'): Promise<RecipeImport> {
  return callImportApi({ type: 'photo', imageBase64: base64, imageMime: mime })
}

/** Convierte File a base64 data (sin el prefijo data:image/...) */
export async function fileToBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve({ base64, mime: file.type || 'image/jpeg' })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Receta vacía para FormaManual */
export function emptyRecipeImport(): RecipeImport {
  return {
    nombre: '',
    descripcion_corta: null,
    origen: null,
    tipo_comida: [],
    ocasion: [],
    tiempo_total_min: null,
    tiempo_preparacion_min: null,
    tiempo_coccion_min: null,
    dificultad: null,
    porciones: 4,
    costo_estimado: null,
    ingredientes: [],
    pasos: [''],
    tags: [],
    info_nutricional_aprox: null,
    perfiles: {},
    filtros_nutricionales: {},
    source_url: null,
    source_platform: 'manual',
    language_original: 'es',
    confidence: 'high',
    imagen_url: null,
    imagen_credito: null,
  }
}

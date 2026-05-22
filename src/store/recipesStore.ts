import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface Ingredient {
  nombre:    string
  categoria: string
  cantidad:  number | null
  unidad:    string | null
  esencial:  boolean
}

export interface NutricionAprox {
  calorias_porcion:  number
  proteina_g:        number
  carbohidratos_g:   number
  grasa_g:           number
  sodio_mg?:         number
  azucar_g?:         number
  fibra_g?:          number
}

export interface Recipe {
  id:                     string
  family_id:              string | null
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
  ingredientes:           Ingredient[]
  pasos:                  string[]
  tags:                   string[]
  info_nutricional_aprox: NutricionAprox | null
  is_base_recipe:         boolean
  rating_promedio:        number | null
  imagen_url:             string | null
  imagen_credito:         { fotografo: string; perfil_url: string } | null
  created_at:             string
  // Oleada 1 — campos nuevos
  visibility?:            'private' | 'public'
  created_by_user_id?:    string | null
  created_in_family_id?:  string | null
  source?:                string | null
  source_url?:            string | null
  source_platform?:       string | null
  is_active_for_menu?:    boolean
  perfiles?: {
    ninos?:                 boolean
    vegetariana?:           boolean
    vegana?:                boolean
    sin_gluten?:            boolean
    sin_lacteos?:           boolean
    diabetes_friendly?:     boolean
    hipertension_friendly?: boolean
    embarazo_friendly?:     boolean
    lactancia_friendly?:    boolean
    adulto_mayor_friendly?: boolean
  }
  filtros_nutricionales?: {
    bajo_sodio?:    boolean
    alto_proteina?: boolean
    bajo_carbo?:    boolean
    alto_fibra?:    boolean
    bajo_grasa?:    boolean
    bajo_azucar?:   boolean
  }
}

interface RecipesState {
  recipes:   Recipe[]
  loading:   boolean
  loadRecipes: (familyId: string) => Promise<void>
  addRecipe:   (recipe: Omit<Recipe, 'id' | 'created_at'>) => Promise<string | null>
  deleteRecipe:(id: string) => Promise<void>
}

export const useRecipesStore = create<RecipesState>((set) => ({
  recipes: [],
  loading: true,

  loadRecipes: async (familyId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .or(`is_base_recipe.eq.true,family_id.eq.${familyId}`)
      .order('nombre')
    set({ recipes: (data ?? []) as Recipe[], loading: false })
  },

  addRecipe: async (recipe) => {
    const { data, error } = await supabase
      .from('recipes')
      .insert(recipe)
      .select()
      .single()
    if (error) return error.message
    set(s => ({ recipes: [...s.recipes, data as Recipe].sort((a,b) => a.nombre.localeCompare(b.nombre, 'es')) }))
    return null
  },

  deleteRecipe: async (id) => {
    await supabase.from('recipes').delete().eq('id', id)
    set(s => ({ recipes: s.recipes.filter(r => r.id !== id) }))
  },
}))

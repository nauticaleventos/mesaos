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

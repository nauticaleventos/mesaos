import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { getMondayOfWeek } from '../lib/motorMenu'

export interface Leftover {
  id:              string
  family_id:       string
  week_start:      string
  ingredient_name: string   // "pollo asado", "carne molida", "salmón"
  quantity:        string | null
  created_at:      string
}

interface LeftoversState {
  leftovers: Leftover[]
  loading:   boolean
  loadLeftovers:  (familyId: string) => Promise<void>
  addLeftover:    (familyId: string, name: string, quantity?: string) => Promise<void>
  removeLeftover: (id: string) => Promise<void>
}

export const useLeftoversStore = create<LeftoversState>((set, get) => ({
  leftovers: [],
  loading:   false,

  loadLeftovers: async (familyId) => {
    set({ loading: true })
    const weekStart = getMondayOfWeek()
    const { data } = await supabase
      .from('weekly_leftovers')
      .select('*')
      .eq('family_id', familyId)
      .eq('week_start', weekStart)
      .order('created_at', { ascending: false })
    set({ leftovers: (data ?? []) as Leftover[], loading: false })
  },

  addLeftover: async (familyId, name, quantity) => {
    const weekStart = getMondayOfWeek()
    const { data } = await supabase
      .from('weekly_leftovers')
      .insert({ family_id: familyId, week_start: weekStart, ingredient_name: name, quantity: quantity ?? null })
      .select()
      .single()
    if (data) set(s => ({ leftovers: [data as Leftover, ...s.leftovers] }))
  },

  removeLeftover: async (id) => {
    await supabase.from('weekly_leftovers').delete().eq('id', id)
    set(s => ({ leftovers: s.leftovers.filter(l => l.id !== id) }))
  },
}))

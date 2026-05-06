import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface FamilyMember {
  id?: string
  family_id?: string
  name: string
  emoji: string
  type: 'adult' | 'child'
  age: number | null
  weight_kg: number | null
  height_cm: number | null
  goal: 'deficit' | 'deficit_agresivo' | 'mantenimiento' | 'volumen' | 'crecimiento' | null
  activity_level: 'sedentary' | 'moderate' | 'active' | 'very_active' | null
  eating_style: string
  conditions: string[]
  allergies: string[]
  prohibited: string[]
  dislikes: string[]
  restrictions_prep: string[]
}

export interface Family {
  id: string
  name: string
  owner_id: string
}

interface FamilyState {
  family: Family | null
  members: FamilyMember[]
  loading: boolean
  loadFamily: (userId: string) => Promise<void>
  createFamily: (name: string, userId: string) => Promise<string | null>
  addMember: (member: FamilyMember) => Promise<string | null>
  updateMember: (id: string, member: Partial<FamilyMember>) => Promise<string | null>
  deleteMember: (id: string) => Promise<void>
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  family:  null,
  members: [],
  loading: true,

  loadFamily: async (userId) => {
    set({ loading: true })
    const { data: family } = await supabase
      .from('families')
      .select('*')
      .eq('owner_id', userId)
      .single()

    if (!family) {
      set({ family: null, members: [], loading: false })
      return
    }

    const { data: members } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at')

    set({ family, members: members ?? [], loading: false })
  },

  createFamily: async (name, userId) => {
    const { data, error } = await supabase
      .from('families')
      .insert({ name, owner_id: userId })
      .select()
      .single()

    if (error) return error.message
    set({ family: data })
    return null
  },

  addMember: async (member) => {
    const { family } = get()
    if (!family) return 'No hay familia creada'

    const { data, error } = await supabase
      .from('family_members')
      .insert({ ...member, family_id: family.id })
      .select()
      .single()

    if (error) return error.message
    set(s => ({ members: [...s.members, data] }))
    return null
  },

  updateMember: async (id, member) => {
    const { error } = await supabase
      .from('family_members')
      .update(member)
      .eq('id', id)

    if (error) return error.message
    set(s => ({
      members: s.members.map(m => m.id === id ? { ...m, ...member } : m)
    }))
    return null
  },

  deleteMember: async (id) => {
    await supabase.from('family_members').delete().eq('id', id)
    set(s => ({ members: s.members.filter(m => m.id !== id) }))
  },
}))

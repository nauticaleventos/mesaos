import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Family, FamilyUser, FamilyMember } from '../lib/types'
export type { FamilyMember } from '../lib/types'
import { DEFAULT_PERMISSIONS } from '../lib/types'

interface FamilyState {
  family:        Family | null
  familyUser:    FamilyUser | null   // el usuario actual dentro de la familia
  members:       FamilyMember[]
  loading:       boolean

  loadFamily:    (userId: string) => Promise<void>
  createFamily:  (name: string, displayName: string, userId: string) => Promise<string | null>
  addMember:     (member: Omit<FamilyMember, 'id' | 'family_id' | 'created_at' | 'updated_at'>) => Promise<string | null>
  updateMember:  (id: string, data: Partial<FamilyMember>) => Promise<string | null>
  deleteMember:  (id: string) => Promise<void>
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  family:     null,
  familyUser: null,
  members:    [],
  loading:    true,

  loadFamily: async (userId) => {
    set({ loading: true })

    // Buscar si el usuario pertenece a alguna familia
    const { data: fu } = await supabase
      .from('family_users')
      .select('*, families(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single()

    if (!fu) {
      set({ family: null, familyUser: null, members: [], loading: false })
      return
    }

    const family = fu.families as unknown as Family

    const { data: members } = await supabase
      .from('family_members')
      .select('*')
      .eq('family_id', family.id)
      .order('created_at')

    set({
      family,
      familyUser: fu as FamilyUser,
      members: members ?? [],
      loading: false,
    })
  },

  createFamily: async (name, displayName, userId) => {
    // 1. Crear familia
    const { data: family, error: e1 } = await supabase
      .from('families')
      .insert({ name, owner_user_id: userId })
      .select()
      .single()

    if (e1 || !family) return e1?.message ?? 'Error creando familia'

    // 2. Agregar al owner como family_user
    const { data: fu, error: e2 } = await supabase
      .from('family_users')
      .insert({
        family_id:    family.id,
        user_id:      userId,
        display_name: displayName,
        base_role:    'owner',
        permissions:  DEFAULT_PERMISSIONS.owner,
      })
      .select()
      .single()

    if (e2 || !fu) return e2?.message ?? 'Error creando usuario de familia'

    // 3. Crear config de notificaciones con defaults
    await supabase
      .from('notifications_config')
      .insert({ family_id: family.id })

    set({ family: family as Family, familyUser: fu as FamilyUser, members: [] })
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
    set(s => ({ members: [...s.members, data as FamilyMember] }))
    return null
  },

  updateMember: async (id, data) => {
    const { error } = await supabase
      .from('family_members')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) return error.message
    set(s => ({
      members: s.members.map(m => m.id === id ? { ...m, ...data } : m)
    }))
    return null
  },

  deleteMember: async (id) => {
    await supabase.from('family_members').delete().eq('id', id)
    set(s => ({ members: s.members.filter(m => m.id !== id) }))
  },
}))

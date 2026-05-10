import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { Family, FamilyUser, FamilyMember, MemberActivity } from '../lib/types'
export type { FamilyMember } from '../lib/types'
import { DEFAULT_PERMISSIONS } from '../lib/types'

export interface WeeklyAttendance {
  id:           string
  family_id:    string
  week_start:   string
  member_id:    string
  is_active:    boolean
  guests_extra: number
  created_at:   string
}

interface FamilyState {
  family:        Family | null
  familyUser:    FamilyUser | null
  members:       FamilyMember[]
  loading:       boolean
  activities:    MemberActivity[]
  attendance:    WeeklyAttendance[]

  loadFamily:       (userId: string) => Promise<void>
  createFamily:     (name: string, displayName: string, userId: string) => Promise<string | null>
  addMember:        (member: Omit<FamilyMember, 'id' | 'family_id' | 'created_at' | 'updated_at'>) => Promise<string | null>
  updateMember:     (id: string, data: Partial<FamilyMember>) => Promise<string | null>
  deleteMember:     (id: string) => Promise<void>
  // Activities
  loadActivities:   (memberId: string) => Promise<void>
  addActivity:      (activity: Omit<MemberActivity, 'id' | 'created_at'>) => Promise<string | null>
  updateActivity:   (id: string, changes: Partial<MemberActivity>) => Promise<string | null>
  deleteActivity:   (id: string) => Promise<void>
  // Weekly attendance
  loadAttendance:   (familyId: string) => Promise<void>
  setMemberActive:  (memberId: string, isActive: boolean) => Promise<void>
  setGuestsExtra:   (memberId: string, guests: number) => Promise<void>
  // Healthy mode
  setHealthyMode:   (active: boolean) => Promise<void>
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  family:     null,
  familyUser: null,
  members:    [],
  loading:    true,
  activities: [],
  attendance: [],

  loadFamily: async (userId) => {
    set({ loading: true })

    const { data: fu } = await supabase
      .from('family_users')
      .select('*, families(*)')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()                     // maybeSingle: no lanza error si no hay fila

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
    // GUARD: verificar si ya existe una familia para este usuario
    const { data: existing } = await supabase
      .from('family_users')
      .select('family_id, families(id, name)')
      .eq('user_id', userId)
      .eq('base_role', 'owner')
      .eq('is_active', true)
      .maybeSingle()

    if (existing) {
      // Ya tiene familia — recargar en vez de crear otra
      await get().loadFamily(userId)
      return null
    }

    // 1. Crear familia
    const { data: family, error: e1 } = await supabase
      .from('families')
      .insert({ name, owner_user_id: userId })
      .select()
      .single()

    if (e1 || !family) return 'No se pudo crear la familia. Intentá de nuevo.'

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

    if (e2 || !fu) return 'No se pudo registrar el usuario en la familia.'

    // 3. Crear config de notificaciones — UPSERT para evitar duplicados
    await supabase
      .from('notifications_config')
      .upsert({ family_id: family.id }, { onConflict: 'family_id' })

    set({ family: family as Family, familyUser: fu as FamilyUser, members: [] })
    return null
  },

  addMember: async (member) => {
    const { family, members } = get()
    if (!family) return 'No hay familia creada.'

    // GUARD: verificar nombre duplicado (case-insensitive) en memoria primero
    const nameLower = member.name.trim().toLowerCase()
    const exists = members.some(m => m.name.toLowerCase() === nameLower)
    if (exists) return `Ya existe un miembro llamado "${member.name}" en tu familia.`

    const { data, error } = await supabase
      .from('family_members')
      .insert({ ...member, name: member.name.trim(), family_id: family.id })
      .select()
      .single()

    // El índice único en BD también lo bloquea si hay race condition
    if (error) {
      if (error.code === '23505') return `Ya existe un miembro llamado "${member.name}" en tu familia.`
      return 'No se pudo guardar el miembro. Intentá de nuevo.'
    }

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

  // ── Actividades ───────────────────────────────────────────────────────────
  loadActivities: async (memberId) => {
    const { data } = await supabase
      .from('member_activities')
      .select('*')
      .eq('member_id', memberId)
      .order('day_of_week')
    set({ activities: (data ?? []) as MemberActivity[] })
  },

  addActivity: async (activity) => {
    const { data, error } = await supabase
      .from('member_activities')
      .insert(activity)
      .select()
      .single()
    if (error) return error.message
    set(s => ({ activities: [...s.activities, data as MemberActivity] }))
    return null
  },

  updateActivity: async (id, changes) => {
    const { error } = await supabase
      .from('member_activities')
      .update(changes)
      .eq('id', id)
    if (error) return error.message
    set(s => ({ activities: s.activities.map(a => a.id === id ? { ...a, ...changes } : a) }))
    return null
  },

  deleteActivity: async (id) => {
    await supabase.from('member_activities').delete().eq('id', id)
    set(s => ({ activities: s.activities.filter(a => a.id !== id) }))
  },

  // ── Asistencia semanal ────────────────────────────────────────────────────
  loadAttendance: async (familyId) => {
    const monday = getMondayISO()
    const { data } = await supabase
      .from('weekly_attendance')
      .select('*')
      .eq('family_id', familyId)
      .eq('week_start', monday)
    set({ attendance: (data ?? []) as WeeklyAttendance[] })
  },

  setMemberActive: async (memberId, isActive) => {
    const { family, attendance } = get()
    if (!family) return
    const monday = getMondayISO()
    const existing = attendance.find(a => a.member_id === memberId)
    if (existing) {
      await supabase.from('weekly_attendance').update({ is_active: isActive }).eq('id', existing.id)
      set(s => ({ attendance: s.attendance.map(a => a.id === existing.id ? { ...a, is_active: isActive } : a) }))
    } else {
      const { data } = await supabase.from('weekly_attendance')
        .insert({ family_id: family.id, week_start: monday, member_id: memberId, is_active: isActive, guests_extra: 0 })
        .select().single()
      if (data) set(s => ({ attendance: [...s.attendance, data as WeeklyAttendance] }))
    }
  },

  setGuestsExtra: async (memberId, guests) => {
    const { family, attendance } = get()
    if (!family) return
    const monday = getMondayISO()
    const existing = attendance.find(a => a.member_id === memberId)
    if (existing) {
      await supabase.from('weekly_attendance').update({ guests_extra: guests }).eq('id', existing.id)
      set(s => ({ attendance: s.attendance.map(a => a.id === existing.id ? { ...a, guests_extra: guests } : a) }))
    } else {
      const { data } = await supabase.from('weekly_attendance')
        .insert({ family_id: family.id, week_start: monday, member_id: memberId, is_active: true, guests_extra: guests })
        .select().single()
      if (data) set(s => ({ attendance: [...s.attendance, data as WeeklyAttendance] }))
    }
  },

  // ── Modo saludable ────────────────────────────────────────────────────────
  setHealthyMode: async (active) => {
    const { family } = get()
    if (!family) return
    await supabase.from('families').update({ healthy_mode_active: active }).eq('id', family.id)
    set(s => ({ family: s.family ? { ...s.family, healthy_mode_active: active } : null }))
  },
}))

function getMondayISO(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1 - day)
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

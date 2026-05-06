import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export interface FridgeItem {
  id: string
  family_id: string
  name: string
  quantity: number | null
  unit: string | null
  category: string
  location: 'nevera' | 'congelador' | 'despensa'
  expiry_date: string | null   // YYYY-MM-DD
  conservation_tip: string | null
  calories_per_100g: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  added_by_photo: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export type NewFridgeItem = Omit<FridgeItem, 'id' | 'family_id' | 'created_at' | 'updated_at'>

interface FridgeState {
  items:   FridgeItem[]
  loading: boolean
  loadItems:   (familyId: string) => Promise<void>
  addItem:     (item: NewFridgeItem, familyId: string) => Promise<string | null>
  updateItem:  (id: string, data: Partial<FridgeItem>) => Promise<void>
  deleteItem:  (id: string) => Promise<void>
}

export const useFridgeStore = create<FridgeState>((set) => ({
  items:   [],
  loading: true,

  loadItems: async (familyId) => {
    set({ loading: true })
    const { data } = await supabase
      .from('fridge_items')
      .select('*')
      .eq('family_id', familyId)
      .order('expiry_date', { ascending: true, nullsFirst: false })
    set({ items: data ?? [], loading: false })
  },

  addItem: async (item, familyId) => {
    const { data, error } = await supabase
      .from('fridge_items')
      .insert({ ...item, family_id: familyId })
      .select()
      .single()
    if (error) return error.message
    set(s => ({
      items: [...s.items, data as FridgeItem].sort((a, b) => {
        if (!a.expiry_date) return 1
        if (!b.expiry_date) return -1
        return a.expiry_date.localeCompare(b.expiry_date)
      })
    }))
    return null
    return null
  },

  updateItem: async (id, data) => {
    await supabase.from('fridge_items').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
    set(s => ({ items: s.items.map(i => i.id === id ? { ...i, ...data } : i) }))
  },

  deleteItem: async (id) => {
    await supabase.from('fridge_items').delete().eq('id', id)
    set(s => ({ items: s.items.filter(i => i.id !== id) }))
  },
}))

// ── Helpers de vencimiento ────────────────────────────────────────────────────
export function expiryStatus(dateStr: string | null): 'expired' | 'critical' | 'warning' | 'ok' | 'none' {
  if (!dateStr) return 'none'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp   = new Date(dateStr + 'T00:00:00')
  const days  = Math.ceil((exp.getTime() - today.getTime()) / 86400000)
  if (days < 0)  return 'expired'
  if (days <= 2) return 'critical'
  if (days <= 7) return 'warning'
  return 'ok'
}

export function expiryLabel(dateStr: string | null): string {
  if (!dateStr) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const exp   = new Date(dateStr + 'T00:00:00')
  const days  = Math.ceil((exp.getTime() - today.getTime()) / 86400000)
  if (days < 0)  return `Venció hace ${Math.abs(days)} día${Math.abs(days) > 1 ? 's' : ''}`
  if (days === 0) return 'Vence hoy'
  if (days === 1) return 'Vence mañana'
  if (days <= 7) return `Vence en ${days} días`
  const d = new Date(dateStr + 'T00:00:00')
  return `Vence ${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`
}

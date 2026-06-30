import { create } from 'zustand'
import type { Action } from '../lib/tiers'

interface LimiteState {
  accion: Action | null
  modo:   'limite' | 'info'
  abrir:  (a: Action, modo?: 'limite' | 'info') => void
  cerrar: () => void
}

// Modal global. modo='limite' = se alcanzó un tope; modo='info' = ver beneficios.
export const useLimiteStore = create<LimiteState>(set => ({
  accion: null,
  modo:   'limite',
  abrir:  (a, modo = 'limite') => set({ accion: a, modo }),
  cerrar: () => set({ accion: null }),
}))

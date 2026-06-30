import { create } from 'zustand'
import type { Action } from '../lib/tiers'

interface LimiteState {
  accion: Action | null
  abrir:  (a: Action) => void
  cerrar: () => void
}

// Modal global "límite alcanzado". Cualquier acción puede abrirlo.
export const useLimiteStore = create<LimiteState>(set => ({
  accion: null,
  abrir:  (a) => set({ accion: a }),
  cerrar: () => set({ accion: null }),
}))

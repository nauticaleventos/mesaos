-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 010 — Gustos alimenticios por miembro
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS proteinas_animales_que_si_come  TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS proteinas_vegetales_que_si_come TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gustos_notas                    TEXT,
  ADD COLUMN IF NOT EXISTS favorite_recipes                TEXT[] DEFAULT '{}';

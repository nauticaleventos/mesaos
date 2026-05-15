-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 017 — Entradas custom en weekly_menu (sobras)
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Hacer recipe_id nullable para permitir entradas sin receta (sobras manuales)
ALTER TABLE weekly_menu ALTER COLUMN recipe_id DROP NOT NULL;

-- Columna para nombre personalizado cuando no hay receta
ALTER TABLE weekly_menu ADD COLUMN IF NOT EXISTS nombre_custom TEXT;

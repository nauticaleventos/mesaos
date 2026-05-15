-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 019 — rating_prompted en weekly_menu
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE weekly_menu ADD COLUMN IF NOT EXISTS rating_prompted BOOLEAN DEFAULT false;

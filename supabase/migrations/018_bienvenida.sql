-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 018 — Flag bienvenida_vista en families
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE families ADD COLUMN IF NOT EXISTS bienvenida_vista BOOLEAN DEFAULT false;

-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 022 — Lonchera escolar
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- meal_type = 'lonchera_escolar' es TEXT libre, no requiere ALTER.
-- Documentado aquí para trazabilidad.

-- 1. Campos por miembro
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS lleva_lonchera BOOLEAN  DEFAULT false,
  ADD COLUMN IF NOT EXISTS lonchera_hora  TIME,
  ADD COLUMN IF NOT EXISTS lonchera_dias  TEXT[];   -- ['lun','mar','mie','jue','vie']

-- 2. Campos por familia
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS lonchera_modo  TEXT DEFAULT 'unica',    -- 'unica' | 'personalizada'
  ADD COLUMN IF NOT EXISTS pais_festivos  TEXT DEFAULT 'CO';       -- CO, MX, AR, PE

-- 3. Flag en recetas
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS apta_lonchera BOOLEAN DEFAULT false;

-- 4. Etiquetar recetas existentes que son aptas para lonchera
--    (fácil, ≤20 min, tipo adecuado)
UPDATE recipes
SET apta_lonchera = true
WHERE is_active_for_menu = true
  AND (tiempo_total_min IS NULL OR tiempo_total_min <= 30)
  AND (dificultad = 'facil' OR dificultad IS NULL)
  AND (
    tipo_componente IN ('plato_unico', 'merienda', 'bebida')
    OR nombre ILIKE '%sandwich%'
    OR nombre ILIKE '%wrap%'
    OR nombre ILIKE '%ensalada%'
    OR nombre ILIKE '%fruta%'
    OR nombre ILIKE '%muffin%'
    OR nombre ILIKE '%galleta%'
    OR nombre ILIKE '%arepa%'
    OR nombre ILIKE '%torta%'
    OR nombre ILIKE '%pincho%'
    OR nombre ILIKE '%rollito%'
  );

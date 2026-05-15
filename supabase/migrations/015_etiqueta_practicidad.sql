-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 015 — Etiqueta practicidad en recetas
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS etiqueta_practicidad TEXT
    CHECK (etiqueta_practicidad IN ('diario','para_lucirme','batch'));

CREATE INDEX IF NOT EXISTS idx_recipes_practicidad
  ON recipes(etiqueta_practicidad);

-- Clasificación automática por reglas:

-- 1. Batch: nombre con keywords O tipo_componente salsa/vinagreta
UPDATE recipes SET etiqueta_practicidad = 'batch'
WHERE etiqueta_practicidad IS NULL
  AND (
    nombre ILIKE '%batch%' OR nombre ILIKE '%tanda%'
    OR nombre ILIKE '%para la semana%' OR nombre ILIKE '%congelar%'
    OR tipo_componente IN ('salsa','vinagreta')
  );

-- 2. Para lucirme: >= 60 min O dificultad difícil
UPDATE recipes SET etiqueta_practicidad = 'para_lucirme'
WHERE etiqueta_practicidad IS NULL
  AND (tiempo_total_min >= 60 OR dificultad = 'dificil');

-- 3. Resto → diario (caso intermedio + rápidas/fáciles)
UPDATE recipes SET etiqueta_practicidad = 'diario'
WHERE etiqueta_practicidad IS NULL;

-- Reporte
SELECT etiqueta_practicidad, COUNT(*) as cantidad
FROM recipes
GROUP BY etiqueta_practicidad
ORDER BY cantidad DESC;

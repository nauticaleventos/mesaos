-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 011 — Condiciones de salud por miembro
-- + tabla de log de recetas auto-generadas
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Columna con claves estandarizadas para el motor
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS condiciones_salud TEXT[] DEFAULT '{}';

-- Log de generación automática de recetas
CREATE TABLE IF NOT EXISTS auto_generated_recipes_log (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_generacion      DATE        NOT NULL,
  condicion             TEXT        NOT NULL,
  usuarios_con_condicion INTEGER    NOT NULL DEFAULT 0,
  recetas_generadas     INTEGER     NOT NULL DEFAULT 0,
  costo_estimado        DECIMAL(10,4),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE auto_generated_recipes_log ENABLE ROW LEVEL SECURITY;

-- Solo el service role puede leer/escribir este log
CREATE POLICY "solo_service_role" ON auto_generated_recipes_log
  FOR ALL USING (false);

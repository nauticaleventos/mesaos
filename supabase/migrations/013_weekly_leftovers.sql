-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 013 — weekly_leftovers (sobrantes semana)
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Tabla para registrar qué sobró de comidas durante la semana
CREATE TABLE IF NOT EXISTS weekly_leftovers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id       UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start      DATE        NOT NULL,
  ingredient_name TEXT        NOT NULL,
  quantity        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_leftovers_family_week
  ON weekly_leftovers(family_id, week_start DESC);

ALTER TABLE weekly_leftovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver sobrantes de mi familia" ON weekly_leftovers
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "gestionar sobrantes owner" ON weekly_leftovers
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────────
-- Columna dia_dificil en weekly_menu (si no existe aún)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE weekly_menu
  ADD COLUMN IF NOT EXISTS dia_dificil BOOLEAN DEFAULT false;

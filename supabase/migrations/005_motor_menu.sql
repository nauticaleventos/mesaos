-- =====================================================
-- mesa.os — Migración 005 — Motor de Menú Semanal
-- Ejecutar en Supabase SQL Editor
-- =====================================================

CREATE TABLE IF NOT EXISTS menu_config (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id        UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  planear_desayuno BOOLEAN     DEFAULT false,
  planear_almuerzo BOOLEAN     DEFAULT true,
  planear_cena     BOOLEAN     DEFAULT true,
  planear_snacks   BOOLEAN     DEFAULT false,
  distinguir_finde BOOLEAN     DEFAULT true,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id)
);

CREATE TABLE IF NOT EXISTS weekly_menu (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start     DATE        NOT NULL,
  day_of_week    INTEGER     NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  meal_type      TEXT        NOT NULL CHECK (meal_type IN ('desayuno','almuerzo','cena','snack')),
  recipe_id      UUID        NOT NULL REFERENCES recipes(id),
  member_id      UUID        REFERENCES family_members(id),
  is_main_recipe BOOLEAN     DEFAULT true,
  servings       INTEGER     NOT NULL DEFAULT 1,
  status         TEXT        DEFAULT 'planned'
    CHECK (status IN ('planned','cooked','skipped','swapped')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_menu_family_week ON weekly_menu(family_id, week_start);
CREATE INDEX IF NOT EXISTS idx_weekly_menu_status      ON weekly_menu(family_id, status);

ALTER TABLE menu_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver config de mi familia" ON menu_config
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "gestionar config — owner" ON menu_config
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "ver menú de mi familia" ON weekly_menu
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "gestionar menú — owner" ON weekly_menu
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

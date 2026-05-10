-- =====================================================
-- mesa.os — Migración 004 — Oleadas 1 + 2
-- PAUSAR ANTES DE APLICAR — ejecutar en Supabase SQL Editor
-- =====================================================

-- ──────────────────────────────────────────────────
-- OLEADA 1 — A.2: Columnas nuevas en recipes
-- ──────────────────────────────────────────────────

ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS visibility          TEXT    DEFAULT 'public'
    CHECK (visibility IN ('private', 'public')),
  ADD COLUMN IF NOT EXISTS created_by_user_id  UUID    REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS created_in_family_id UUID   REFERENCES families(id),
  ADD COLUMN IF NOT EXISTS source              TEXT,
  ADD COLUMN IF NOT EXISTS is_active_for_menu  BOOLEAN DEFAULT TRUE NOT NULL;

-- Recetas base existentes: visibilidad pública, activas para menú
UPDATE recipes
  SET visibility = 'public', is_active_for_menu = TRUE
  WHERE created_by_user_id IS NULL;

-- ──────────────────────────────────────────────────
-- OLEADA 2 — B.5: Modo saludable en families
-- ──────────────────────────────────────────────────

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS healthy_mode_active BOOLEAN DEFAULT FALSE NOT NULL;

-- ──────────────────────────────────────────────────
-- OLEADA 2 — B.1: Sugerencias de recetas
-- (Opción A: tabla nueva, semántica separada de reactions)
-- ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipe_suggestions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  member_id           UUID        NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  suggested_by_user_id UUID       NOT NULL REFERENCES auth.users(id),
  status              TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'tried', 'dismissed')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(recipe_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_recipe_suggestions_member ON recipe_suggestions(member_id);
CREATE INDEX IF NOT EXISTS idx_recipe_suggestions_recipe ON recipe_suggestions(recipe_id, status);

-- ──────────────────────────────────────────────────
-- OLEADA 2 — B.2/B.3: Source en recipe_reactions + conflictos
-- ──────────────────────────────────────────────────

-- Agregar source a recipe_reactions para distinguir origen de valoración
ALTER TABLE recipe_reactions
  ADD COLUMN IF NOT EXISTS source TEXT
    CHECK (source IN ('member_judgment','owner_judgment','chef_judgment','cooked_postmeal','not_tried','skipped'));

-- Tabla de conflictos de valoración
CREATE TABLE IF NOT EXISTS rating_conflicts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id           UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  member_id           UUID        NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  rating_a_id         UUID        NOT NULL,  -- primera valoración
  rating_b_id         UUID        NOT NULL,  -- valoración que generó el conflicto
  resolution_status   TEXT        NOT NULL DEFAULT 'pending'
    CHECK (resolution_status IN ('pending','resolved','dismissed')),
  resolution_choice   TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rating_conflicts_pending ON rating_conflicts(recipe_id, member_id, resolution_status);

-- ──────────────────────────────────────────────────
-- OLEADA 2 — B.4: Asistencia semanal
-- ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weekly_attendance (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start   DATE        NOT NULL,  -- siempre lunes
  member_id    UUID        NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  guests_extra INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, week_start, member_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_attendance_family_week ON weekly_attendance(family_id, week_start);

-- ──────────────────────────────────────────────────
-- RLS en tablas nuevas
-- ──────────────────────────────────────────────────

ALTER TABLE recipe_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_conflicts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_attendance  ENABLE ROW LEVEL SECURITY;

-- recipe_suggestions: visible para miembros de la familia del miembro
CREATE POLICY "ver sugerencias de mi familia" ON recipe_suggestions
  FOR SELECT USING (
    member_id IN (
      SELECT fm.id FROM family_members fm WHERE is_family_member(fm.family_id)
    )
  );

CREATE POLICY "gestionar sugerencias — owner" ON recipe_suggestions
  FOR ALL USING (
    member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN families f ON f.id = fm.family_id
      WHERE f.owner_user_id = auth.uid()
    )
  );

-- rating_conflicts
CREATE POLICY "ver conflictos de mi familia" ON rating_conflicts
  FOR SELECT USING (
    member_id IN (
      SELECT fm.id FROM family_members fm WHERE is_family_member(fm.family_id)
    )
  );

CREATE POLICY "gestionar conflictos — owner" ON rating_conflicts
  FOR ALL USING (
    member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN families f ON f.id = fm.family_id
      WHERE f.owner_user_id = auth.uid()
    )
  );

-- weekly_attendance
CREATE POLICY "ver asistencia de mi familia" ON weekly_attendance
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "gestionar asistencia — owner" ON weekly_attendance
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

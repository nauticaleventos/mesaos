-- =====================================================
-- mesa.os — Migración v2
-- Elimina el schema v1 y crea el modelo completo nuevo
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- DROP tablas v1 (orden inverso a foreign keys)
DROP TABLE IF EXISTS family_members CASCADE;
DROP TABLE IF EXISTS families CASCADE;

-- =====================================================
-- HELPER FUNCTION — RLS
-- =====================================================
CREATE OR REPLACE FUNCTION is_family_member(fam_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_users
    WHERE family_id = fam_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
$$;

-- =====================================================
-- FAMILIAS
-- =====================================================
CREATE TABLE families (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  owner_user_id UUID        NOT NULL REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- USUARIOS DE LA APP EN UNA FAMILIA
-- =====================================================
CREATE TABLE family_users (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id           UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name        TEXT        NOT NULL,
  base_role           TEXT        NOT NULL CHECK (base_role IN ('owner','chef','contributor')),
  permissions         JSONB       NOT NULL DEFAULT '{}',
  invited_by_user_id  UUID        REFERENCES auth.users(id),
  invited_at          TIMESTAMPTZ,
  joined_at           TIMESTAMPTZ DEFAULT NOW(),
  is_active           BOOLEAN     DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

-- =====================================================
-- MIEMBROS PARA QUIENES SE COCINA
-- =====================================================
CREATE TABLE family_members (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id             UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name                  TEXT        NOT NULL,
  emoji                 TEXT,
  color                 TEXT,
  member_type           TEXT        NOT NULL CHECK (member_type IN ('adult','child','infant','teen','elder')),
  age                   INTEGER,
  weight_kg             DECIMAL(5,2),
  height_cm             DECIMAL(5,2),

  -- Sistema de porciones
  is_portion_anchor     BOOLEAN     DEFAULT FALSE,
  portion_multiplier    DECIMAL(3,2) DEFAULT 1.0,

  -- Objetivos
  goal                  TEXT        CHECK (goal IN ('deficit','deficit_agresivo','mantenimiento','volumen','crecimiento')),
  goal_target_weight_kg DECIMAL(5,2),
  goal_target_date      DATE,

  -- Actividad y calorías
  activity_level        TEXT        CHECK (activity_level IN ('sedentary','moderate','active','very_active')),
  calories_default      INTEGER,
  calories_per_day      JSONB       DEFAULT '{}',
  protein_g_default     INTEGER,
  carbs_g_default       INTEGER,
  fat_g_default         INTEGER,

  -- Restricciones
  conditions            TEXT[]      DEFAULT '{}',
  allergies             TEXT[]      DEFAULT '{}',
  prohibited            TEXT[]      DEFAULT '{}',
  dislikes              TEXT[]      DEFAULT '{}',
  loves                 TEXT[]      DEFAULT '{}',
  restrictions_prep     TEXT[]      DEFAULT '{}',

  -- Comidas por miembro
  meals_per_day         JSONB       DEFAULT '[]',

  -- Vínculo con usuario de la app
  linked_user_id        UUID        REFERENCES auth.users(id),

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Un solo anchor por familia
CREATE UNIQUE INDEX one_anchor_per_family
  ON family_members(family_id)
  WHERE is_portion_anchor = TRUE;

-- =====================================================
-- ACTIVIDADES DE MIEMBROS
-- =====================================================
CREATE TABLE member_activities (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id               UUID        NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  activity_name           TEXT        NOT NULL,
  day_of_week             INTEGER     CHECK (day_of_week BETWEEN 0 AND 6),
  time_start              TIME,
  duration_minutes        INTEGER,
  intensity               TEXT        CHECK (intensity IN ('low','moderate','high')),
  calories_burned_estimate INTEGER,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INVITACIONES
-- =====================================================
CREATE TABLE invitations (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id             UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invited_by_user_id    UUID        NOT NULL REFERENCES auth.users(id),
  email                 TEXT,
  base_role             TEXT        NOT NULL CHECK (base_role IN ('chef','contributor')),
  permissions_template  JSONB       DEFAULT '{}',
  token                 TEXT        NOT NULL UNIQUE,
  expires_at            TIMESTAMPTZ NOT NULL,
  used_at               TIMESTAMPTZ,
  used_by_user_id       UUID        REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TAREAS
-- =====================================================
CREATE TABLE tasks (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id             UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  task_type             TEXT        NOT NULL CHECK (task_type IN ('shopping','cooking','fridge_cleanup','fridge_organize','other')),
  title                 TEXT        NOT NULL,
  description           TEXT,
  assigned_to_user_id   UUID        REFERENCES auth.users(id),
  assigned_by_user_id   UUID        NOT NULL REFERENCES auth.users(id),
  due_date              DATE,
  due_time              TIME,
  related_data          JSONB       DEFAULT '{}',
  status                TEXT        DEFAULT 'pending' CHECK (status IN ('pending','in_progress','done','cancelled')),
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  completed_at          TIMESTAMPTZ
);

-- =====================================================
-- CONFIGURACIÓN DE NOTIFICACIONES
-- =====================================================
CREATE TABLE notifications_config (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id            UUID        NOT NULL UNIQUE REFERENCES families(id) ON DELETE CASCADE,
  defrost_hours_before INTEGER     DEFAULT 12,
  sleep_start          TIME        DEFAULT '22:30',
  sleep_end            TIME        DEFAULT '06:30',
  night_limit          TIME        DEFAULT '21:00',
  morning_summary_time TIME        DEFAULT '07:00',
  routing              JSONB       DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONTRIBUTION PROMPTS
-- =====================================================
CREATE TABLE contribution_prompts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id        UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  target_user_id   UUID        NOT NULL REFERENCES auth.users(id),
  prompt_text      TEXT        NOT NULL,
  context          TEXT        NOT NULL CHECK (context IN ('onboarding','gap_filling','low_rating','weekly','theme')),
  related_data     JSONB       DEFAULT '{}',
  status           TEXT        DEFAULT 'pending' CHECK (status IN ('pending','seen','completed','dismissed')),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ
);

-- =====================================================
-- ÍNDICES
-- =====================================================
CREATE INDEX idx_family_users_family   ON family_users(family_id);
CREATE INDEX idx_family_users_user     ON family_users(user_id);
CREATE INDEX idx_family_members_family ON family_members(family_id);
CREATE INDEX idx_member_activities     ON member_activities(member_id);
CREATE INDEX idx_tasks_family_status   ON tasks(family_id, status);
CREATE INDEX idx_tasks_assigned        ON tasks(assigned_to_user_id);
CREATE INDEX idx_invitations_token     ON invitations(token);
CREATE INDEX idx_contribution_prompts  ON contribution_prompts(target_user_id, status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE families             ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_prompts ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES RLS
-- =====================================================

-- families
CREATE POLICY "ver familia propia" ON families
  FOR SELECT USING (owner_user_id = auth.uid() OR is_family_member(id));

CREATE POLICY "crear familia" ON families
  FOR INSERT WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "editar familia propia" ON families
  FOR UPDATE USING (owner_user_id = auth.uid());

-- family_users
CREATE POLICY "ver usuarios de mi familia" ON family_users
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "el owner gestiona usuarios" ON family_users
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "autoregistro al aceptar invitación" ON family_users
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- family_members
CREATE POLICY "ver miembros de mi familia" ON family_members
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "gestionar miembros — owner" ON family_members
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

-- member_activities
CREATE POLICY "ver actividades de mi familia" ON member_activities
  FOR SELECT USING (
    member_id IN (SELECT id FROM family_members WHERE is_family_member(family_id))
  );

CREATE POLICY "gestionar actividades — owner" ON member_activities
  FOR ALL USING (
    member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN families f ON f.id = fm.family_id
      WHERE f.owner_user_id = auth.uid()
    )
  );

-- invitations
CREATE POLICY "ver invitaciones de mi familia" ON invitations
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "owner crea invitaciones" ON invitations
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

-- tasks
CREATE POLICY "ver tareas de mi familia" ON tasks
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "gestionar tareas" ON tasks
  FOR ALL USING (is_family_member(family_id));

-- notifications_config
CREATE POLICY "ver config de mi familia" ON notifications_config
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "owner gestiona config" ON notifications_config
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

-- contribution_prompts
CREATE POLICY "ver mis prompts" ON contribution_prompts
  FOR SELECT USING (target_user_id = auth.uid());

CREATE POLICY "owner crea prompts" ON contribution_prompts
  FOR INSERT WITH CHECK (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "actualizar mis prompts" ON contribution_prompts
  FOR UPDATE USING (target_user_id = auth.uid());

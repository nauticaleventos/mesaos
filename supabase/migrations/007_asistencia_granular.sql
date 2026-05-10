-- =====================================================
-- mesa.os — Migración 007
-- Reemplaza weekly_attendance con control granular
-- por día/comida. Agrega weekly_guests.
-- =====================================================

DROP TABLE IF EXISTS weekly_attendance CASCADE;

CREATE TABLE weekly_attendance (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start  DATE        NOT NULL,
  member_id   UUID        NOT NULL REFERENCES family_members(id) ON DELETE CASCADE,
  day_of_week INTEGER     NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  meal_type   TEXT        NOT NULL CHECK (meal_type IN ('desayuno','almuerzo','cena','snack')),
  is_eating   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, week_start, member_id, day_of_week, meal_type)
);

CREATE INDEX idx_weekly_attendance_lookup ON weekly_attendance(family_id, week_start);

CREATE TABLE IF NOT EXISTS weekly_guests (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start  DATE        NOT NULL,
  day_of_week INTEGER     NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  meal_type   TEXT        NOT NULL CHECK (meal_type IN ('desayuno','almuerzo','cena','snack')),
  cantidad    INTEGER     NOT NULL DEFAULT 1,
  notas       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_guests_lookup ON weekly_guests(family_id, week_start);

ALTER TABLE weekly_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_guests     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver asistencia familia" ON weekly_attendance
  FOR SELECT USING (is_family_member(family_id));
CREATE POLICY "gestionar asistencia owner" ON weekly_attendance
  FOR ALL USING (family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid()));

CREATE POLICY "ver invitados familia" ON weekly_guests
  FOR SELECT USING (is_family_member(family_id));
CREATE POLICY "gestionar invitados owner" ON weekly_guests
  FOR ALL USING (family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid()));

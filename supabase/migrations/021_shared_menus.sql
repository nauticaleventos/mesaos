-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 021 — Menús compartidos (link público 7 días)
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shared_menus (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start   DATE        NOT NULL,
  token        TEXT        NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  views_count  INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_menus_token     ON shared_menus(token);
CREATE INDEX IF NOT EXISTS idx_shared_menus_family    ON shared_menus(family_id);
CREATE INDEX IF NOT EXISTS idx_shared_menus_expires   ON shared_menus(expires_at);

ALTER TABLE shared_menus ENABLE ROW LEVEL SECURITY;

-- Owner puede crear y ver sus links
CREATE POLICY "shared_menus_owner" ON shared_menus
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

-- Lectura pública por token (sin auth) — para /menu/compartido/:token
CREATE POLICY "shared_menus_public_read" ON shared_menus
  FOR SELECT USING (true);

-- Función para incrementar vistas sin exponer la tabla completa
CREATE OR REPLACE FUNCTION increment_shared_menu_views(menu_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE shared_menus
  SET views_count = views_count + 1
  WHERE id = menu_id;
$$;

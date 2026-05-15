-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 016 — Lista de mercado
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS shopping_lists (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start  DATE        NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, week_start)
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  shopping_list_id    UUID    NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  ingrediente_nombre  TEXT    NOT NULL,
  cantidad_total      NUMERIC NOT NULL DEFAULT 0,
  unidad              TEXT    NOT NULL DEFAULT 'unidades',
  categoria_pasillo   TEXT    NOT NULL DEFAULT 'otros',
  en_nevera           BOOLEAN DEFAULT false,
  faltante            BOOLEAN DEFAULT true,
  comprado            BOOLEAN DEFAULT false,
  recetas_origen      TEXT[]  DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_family   ON shopping_lists(family_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list ON shopping_list_items(shopping_list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_pasillo ON shopping_list_items(categoria_pasillo);

ALTER TABLE shopping_lists      ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver lista de mi familia" ON shopping_lists
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "gestionar lista owner" ON shopping_lists
  FOR ALL USING (family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid()));

CREATE POLICY "ver items de mi familia" ON shopping_list_items
  FOR SELECT USING (
    shopping_list_id IN (SELECT id FROM shopping_lists WHERE is_family_member(family_id))
  );

CREATE POLICY "gestionar items owner" ON shopping_list_items
  FOR ALL USING (
    shopping_list_id IN (
      SELECT id FROM shopping_lists
      WHERE family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
    )
  );

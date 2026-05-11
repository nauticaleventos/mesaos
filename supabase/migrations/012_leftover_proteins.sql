-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 012 — Sobras de proteína
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS leftover_proteins (
  id             UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id      UUID    NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  recipe_id      UUID    REFERENCES recipes(id),
  protein_nombre TEXT    NOT NULL,
  cantidad_aprox TEXT,
  cooking_date   DATE    NOT NULL,
  consumed_date  DATE,
  available      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leftover_proteins_family_date
  ON leftover_proteins(family_id, cooking_date DESC);

ALTER TABLE leftover_proteins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver sobras de mi familia" ON leftover_proteins
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "gestionar sobras owner" ON leftover_proteins
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

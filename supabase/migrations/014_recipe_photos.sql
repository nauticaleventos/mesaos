-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 014 — Fotos de recetas subidas por usuarios
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- Tabla principal
CREATE TABLE IF NOT EXISTS recipe_photos (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id    UUID        NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  family_id    UUID        NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  uploaded_by  UUID        REFERENCES family_members(id) ON DELETE SET NULL,
  storage_path TEXT        NOT NULL,
  public_url   TEXT        NOT NULL,
  is_primary   BOOLEAN     DEFAULT false,
  visibility   TEXT        DEFAULT 'family_and_owner'
               CHECK (visibility IN ('family_only','family_and_owner','community')),
  votes_count  INTEGER     DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipe_photos_recipe     ON recipe_photos(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_photos_family     ON recipe_photos(family_id);
CREATE INDEX IF NOT EXISTS idx_recipe_photos_visibility ON recipe_photos(visibility);

-- Solo puede haber una foto principal por receta+familia
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipe_photos_one_primary
  ON recipe_photos(recipe_id, family_id) WHERE is_primary = true;

ALTER TABLE recipe_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ver fotos de mi familia" ON recipe_photos
  FOR SELECT USING (is_family_member(family_id));

CREATE POLICY "subir fotos miembro familia" ON recipe_photos
  FOR INSERT WITH CHECK (is_family_member(family_id));

CREATE POLICY "borrar mis fotos o si soy owner" ON recipe_photos
  FOR DELETE USING (
    uploaded_by IN (SELECT id FROM family_members WHERE user_id = auth.uid())
    OR family_id IN (SELECT id FROM families WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "actualizar fotos de mi familia" ON recipe_photos
  FOR UPDATE USING (is_family_member(family_id));

-- ────────────────────────────────────────────────────────────────
-- STORAGE BUCKET — correr esto también en el SQL Editor
-- (Supabase crea el bucket vía función interna)
-- ────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'recipe-photos',
  'recipe-photos',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
CREATE POLICY "upload fotos receta" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'recipe-photos');

CREATE POLICY "ver fotos receta" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'recipe-photos');

CREATE POLICY "borrar mis fotos storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'recipe-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

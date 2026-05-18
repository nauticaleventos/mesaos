-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 020 — Tabla import_usage (monitoreo)
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS import_usage (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma   TEXT        NOT NULL,   -- tiktok | youtube | instagram | facebook | web
  url          TEXT,
  success      BOOLEAN     DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_usage_plataforma ON import_usage(plataforma);
CREATE INDEX IF NOT EXISTS idx_import_usage_fecha ON import_usage(created_at DESC);

ALTER TABLE import_usage ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver métricas de uso
CREATE POLICY "import_usage_admin" ON import_usage
  FOR ALL USING (auth.role() = 'service_role');

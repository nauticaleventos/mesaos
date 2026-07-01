-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 023 — Pagos y suscripciones
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════
--
-- Dos bloques:
--   A) Columnas de TIER — ya existen en la BD (se crearon a mano en su
--      momento). Se documentan acá con IF NOT EXISTS para dejar el SQL
--      versionado en el repo. Correrlo NO cambia las columnas existentes.
--   B) Columnas de PAGO — nuevas. Diseño AGNÓSTICO de pasarela:
--      el estado de la suscripción (plan/subscription_status/current_period_end)
--      NO sabe qué pasarela cobró. `payment_gateway` guarda cuál fue.
--      Los datos propios de Wompi van en columnas `wompi_*`; cuando sumemos
--      una pasarela internacional, agregará sus propias `*_*` sin tocar esto.
-- ════════════════════════════════════════════════════════════════

-- ── A) TIER (documentación — ya vive en la BD) ──────────────────────────────
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS tier       TEXT        DEFAULT 'free',   -- 'free' | 'plus' | 'pro'
  ADD COLUMN IF NOT EXISTS tier_until TIMESTAMPTZ,                  -- NULL = permanente; fecha = vence (trial o período pago)
  ADD COLUMN IF NOT EXISTS uso_mes    JSONB       DEFAULT '{"generar_menu":0,"chat_tita":0,"importar_ia":0,"fotos_nevera":0,"cambios_receta":0,"lonchera":0,"desbloqueos":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS mes_reset  DATE        DEFAULT (date_trunc('month', now())::date);

-- ── B) PAGO / SUSCRIPCIÓN ───────────────────────────────────────────────────
ALTER TABLE families
  -- Agnóstico de pasarela (lo que lee la lógica de tier):
  ADD COLUMN IF NOT EXISTS plan                TEXT,           -- 'plus' | 'pro' (plan pagado; NULL = sin suscripción)
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,           -- 'active' | 'payment_failed' | 'cancelled' (NULL = nunca suscrito)
  ADD COLUMN IF NOT EXISTS current_period_end  TIMESTAMPTZ,    -- fin del período pago vigente (lo renueva el webhook)
  ADD COLUMN IF NOT EXISTS last_transaction_id TEXT,           -- id de la última transacción aprobada (idempotencia)
  ADD COLUMN IF NOT EXISTS payment_gateway     TEXT,           -- 'wompi' | 'stripe'... (qué pasarela cobró; para el desacople)
  -- Específico de Wompi:
  ADD COLUMN IF NOT EXISTS wompi_payment_source_id BIGINT,     -- id numérico de la fuente de pago (para renovar sin pedir tarjeta)
  ADD COLUMN IF NOT EXISTS wompi_customer_email    TEXT;       -- email usado en Wompi (requerido por su API de transacciones)

-- Índice para el futuro cron de renovación (Fase 4): buscar suscripciones por vencer.
CREATE INDEX IF NOT EXISTS idx_families_period_end
  ON families(current_period_end)
  WHERE subscription_status = 'active';

-- =====================================================
-- mesa.os — Migración 003
-- Constraints únicos para prevenir duplicados
-- =====================================================

-- 1. Un solo owner por familia en family_users
CREATE UNIQUE INDEX IF NOT EXISTS one_owner_per_family
  ON family_users(family_id)
  WHERE base_role = 'owner';

-- 2. No dos miembros con el mismo nombre en la misma familia
--    (case-insensitive usando LOWER)
CREATE UNIQUE INDEX IF NOT EXISTS unique_member_name_per_family
  ON family_members(family_id, LOWER(name));

-- 3. notifications_config ya tiene UNIQUE(family_id) del schema v2
--    Solo verificamos que exista (no hacer nada si ya está)

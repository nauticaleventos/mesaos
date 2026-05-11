-- =====================================================
-- mesa.os — Migración 008
-- Componentes por comida, frecuencia de cocción,
-- preferencias de acompañamiento por miembro
-- =====================================================

-- 1. Componente de cada entrada del menú semanal
ALTER TABLE weekly_menu
  ADD COLUMN IF NOT EXISTS meal_component TEXT DEFAULT 'completo'
    CHECK (meal_component IN ('completo','proteina','carbohidrato','ensalada','salsa'));

-- 2. Frecuencia de cocción de la familia
ALTER TABLE menu_config
  ADD COLUMN IF NOT EXISTS cocina_frequency TEXT DEFAULT 'daily'
    CHECK (cocina_frequency IN ('daily','2x_week','1x_week'));

-- 3. Preferencias de acompañamiento por miembro
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS side_prefs JSONB DEFAULT '{"include_carbs": true, "include_salad": true, "notas": ""}';

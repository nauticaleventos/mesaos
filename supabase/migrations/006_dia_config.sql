-- Agrega columna de configuración por día/comida a menu_config
ALTER TABLE menu_config
  ADD COLUMN IF NOT EXISTS dia_config JSONB DEFAULT '{}';

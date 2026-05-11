-- ════════════════════════════════════════════════════════════════
-- mesa.os — Migración 009 — Motor Inteligente
-- Ejecutar en Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════

-- ── 1. Plantilla de comida por miembro ────────────────────────────────────────
ALTER TABLE family_members
  ADD COLUMN IF NOT EXISTS plantilla_comida TEXT NOT NULL DEFAULT 'clasico_colombiano'
    CHECK (plantilla_comida IN ('clasico_colombiano','liviano','lowcarb_keto','vegetariano','personalizado')),
  ADD COLUMN IF NOT EXISTS guarniciones_por_comida INTEGER NOT NULL DEFAULT 2
    CHECK (guarniciones_por_comida BETWEEN 0 AND 3),
  ADD COLUMN IF NOT EXISTS quiere_ensalada BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiere_salsa    BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Tabla de sustituciones de ingredientes ─────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredient_substitutions (
  id                   UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  ingrediente_original TEXT    NOT NULL,
  sustitutos           JSONB   NOT NULL,
  contexto             TEXT    NOT NULL DEFAULT 'general',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ingrediente_original, contexto)
);

ALTER TABLE ingredient_substitutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos pueden leer sustitutos" ON ingredient_substitutions
  FOR SELECT USING (true);

-- ── 3. Datos de sustituciones ─────────────────────────────────────────────────
INSERT INTO ingredient_substitutions (ingrediente_original, sustitutos, contexto) VALUES
('harina de trigo', '[
  {"nombre":"harina de almendras","ratio":1.0,"nota":"versión low-carb / sin gluten"},
  {"nombre":"harina de coco","ratio":0.25,"nota":"absorbe más líquido, usar 1/4"},
  {"nombre":"harina de avena","ratio":1.0,"nota":"más fibra"},
  {"nombre":"harina de arroz","ratio":1.0,"nota":"sin gluten, neutra"}
]'::jsonb, 'saludable'),

('azúcar', '[
  {"nombre":"stevia","ratio":0.04,"nota":"muy dulce, usar muy poco"},
  {"nombre":"panela","ratio":1.0,"nota":"sabor más caramelo"},
  {"nombre":"miel","ratio":0.75,"nota":"reducir líquido en la receta"},
  {"nombre":"azúcar de coco","ratio":1.0,"nota":"índice glucémico más bajo"}
]'::jsonb, 'saludable'),

('leche de vaca', '[
  {"nombre":"leche de almendras","ratio":1.0,"nota":"sin lácteos, sabor suave"},
  {"nombre":"leche de coco","ratio":1.0,"nota":"sin lácteos, sabor a coco"},
  {"nombre":"leche de ajonjolí","ratio":1.0,"nota":"alta en calcio"},
  {"nombre":"leche de avena","ratio":1.0,"nota":"neutra y cremosa"}
]'::jsonb, 'sin_lacteos'),

('leche', '[
  {"nombre":"leche de almendras","ratio":1.0,"nota":"sin lácteos"},
  {"nombre":"leche de coco","ratio":1.0,"nota":"sin lácteos"},
  {"nombre":"leche de avena","ratio":1.0,"nota":"neutra"}
]'::jsonb, 'sin_lacteos'),

('mantequilla', '[
  {"nombre":"aceite de coco","ratio":1.0,"nota":"sólido a temperatura ambiente"},
  {"nombre":"aceite de oliva","ratio":0.75,"nota":"para recetas saladas"},
  {"nombre":"puré de aguacate","ratio":1.0,"nota":"para horneados"},
  {"nombre":"margarina vegetal","ratio":1.0,"nota":"sin lácteos"}
]'::jsonb, 'saludable'),

('crema de leche', '[
  {"nombre":"crema de coco","ratio":1.0,"nota":"sin lácteos, sabor a coco"},
  {"nombre":"yogur griego","ratio":1.0,"nota":"más proteína"},
  {"nombre":"leche de coco","ratio":0.75,"nota":"más líquida"}
]'::jsonb, 'sin_lacteos'),

('queso', '[
  {"nombre":"queso de almendras","ratio":1.0,"nota":"sin lácteos"},
  {"nombre":"tofu firme","ratio":1.0,"nota":"sin lácteos, similar textura"},
  {"nombre":"queso de coco","ratio":1.0,"nota":"sin lácteos"}
]'::jsonb, 'sin_lacteos'),

('pollo', '[
  {"nombre":"pavo","ratio":1.0,"nota":"más magro, sabor similar"},
  {"nombre":"tofu","ratio":1.0,"nota":"versión vegetariana"},
  {"nombre":"tempeh","ratio":1.0,"nota":"versión vegetariana, más firme"}
]'::jsonb, 'general'),

('carne de res', '[
  {"nombre":"carne de cerdo","ratio":1.0,"nota":"sabor diferente, similar textura"},
  {"nombre":"pavo molido","ratio":1.0,"nota":"más magro"},
  {"nombre":"lentejas","ratio":1.5,"nota":"versión vegana, agregar más"}
]'::jsonb, 'general'),

('arroz blanco', '[
  {"nombre":"quinoa","ratio":1.0,"nota":"más proteína y fibra"},
  {"nombre":"arroz integral","ratio":1.0,"nota":"más fibra, cocinar más tiempo"},
  {"nombre":"arroz de coliflor","ratio":1.0,"nota":"low-carb"}
]'::jsonb, 'saludable'),

('papa', '[
  {"nombre":"yuca","ratio":1.0,"nota":"sabor similar"},
  {"nombre":"batata","ratio":1.0,"nota":"más dulce, más fibra"},
  {"nombre":"coliflor","ratio":1.0,"nota":"low-carb"}
]'::jsonb, 'general'),

('aceite vegetal', '[
  {"nombre":"aceite de oliva","ratio":1.0,"nota":"más saludable"},
  {"nombre":"aceite de coco","ratio":1.0,"nota":"resistente al calor"}
]'::jsonb, 'general'),

('huevo', '[
  {"nombre":"huevo de codorniz","ratio":4.0,"nota":"usar 4 por cada huevo"},
  {"nombre":"linaza molida","ratio":0.0,"nota":"1 cda linaza + 3 cda agua = 1 huevo (para horneados)"},
  {"nombre":"chía","ratio":0.0,"nota":"1 cda chía + 3 cda agua = 1 huevo (para horneados)"}
]'::jsonb, 'sin_huevo'),

('limón', '[
  {"nombre":"naranja","ratio":1.0,"nota":"más dulce, menor acidez"},
  {"nombre":"vinagre de manzana","ratio":0.5,"nota":"usar la mitad"},
  {"nombre":"maracuyá","ratio":1.0,"nota":"más ácido y aromático"}
]'::jsonb, 'general')

ON CONFLICT (ingrediente_original, contexto) DO NOTHING;

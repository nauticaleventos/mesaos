// scripts/seed-salsas.mjs
// Inserta 20 salsas base en BD
// Uso:
//   node scripts/seed-salsas.mjs          → dry-run
//   node scripts/seed-salsas.mjs --apply  → inserta en BD

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

const APPLY = process.argv.includes('--apply')

const TIPO_COMIDA_TODO = ['desayuno', 'almuerzo', 'cena', 'snack', 'merienda']

const PERFILES_COMUN = {
  keto: false, ninos: true, embarazadas: true,
  vegetariana: true, adultos_mayores: true, deficit_calorico: true,
}

const SALSAS = [
  {
    nombre: 'Chimichurri argentino',
    descripcion_corta: 'La salsa argentina clásica de perejil y ajo. Va con todo: carnes, pollo, vegetales a la parrilla.',
    tiempo_total_min: 10,
    porciones: 8,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'perejil fresco', cantidad: 50, unidad: 'g', esencial: true, categoria: 'vegetal' },
      { nombre: 'ajo', cantidad: 4, unidad: 'dientes', esencial: true, categoria: 'vegetal' },
      { nombre: 'aceite de oliva', cantidad: 120, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'vinagre de vino tinto', cantidad: 30, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'orégano seco', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
      { nombre: 'ají rojo seco', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
    ],
    pasos: [
      'Picá el perejil muy finamente con un cuchillo afilado. No uses procesadora para que quede textura.',
      'Picá el ajo en trocitos muy pequeños o machalos en mortero.',
      'Mezclá el perejil y el ajo en un frasco. Añadí el orégano y el ají.',
      'Agregá el aceite de oliva y el vinagre. Mezclá bien y corregí sal.',
      'Dejá reposar 30 minutos antes de servir para que los sabores se integren. Guardá en nevera hasta 1 semana.',
    ],
    info_nutricional_aprox: { calorias_porcion: 90, proteina_g: 0, carbohidratos_g: 1, grasa_g: 10, fibra_g: 0, azucar_g: 0, sodio_mg: 80 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Hogao colombiano',
    descripcion_corta: 'La base de la cocina colombiana. Sofrito de tomate y cebolla larga que acompaña arroz, frijoles, huevos y carnes.',
    tiempo_total_min: 15,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'tomate maduro', cantidad: 3, unidad: 'unidades', esencial: true, categoria: 'vegetal' },
      { nombre: 'cebolla larga (cebollín)', cantidad: 4, unidad: 'tallos', esencial: true, categoria: 'vegetal' },
      { nombre: 'aceite vegetal', cantidad: 30, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'comino', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
      { nombre: 'cilantro fresco', cantidad: null, unidad: null, esencial: false, categoria: 'vegetal' },
    ],
    pasos: [
      'Picá el tomate en cubos pequeños quitando las semillas. Picá la cebolla larga en rodajas finas.',
      'Calentá el aceite en sartén a fuego medio.',
      'Sofreí la cebolla hasta que transparente, unos 3-4 minutos.',
      'Añadí el tomate y cociná revolviendo hasta que pierda líquido y quede una pasta espesa, 8-10 minutos.',
      'Sazonás con sal, comino y cilantro. Listo para usar o guardar en nevera hasta 5 días.',
    ],
    info_nutricional_aprox: { calorias_porcion: 45, proteina_g: 1, carbohidratos_g: 4, grasa_g: 3, fibra_g: 1, azucar_g: 2, sodio_mg: 120 },
    perfiles: PERFILES_COMUN,
  },
  {
    nombre: 'Mojo cubano',
    descripcion_corta: 'Salsa cubana de ajo y naranja agria. Imprescindible para marinadas, yuca, pollo y cerdo.',
    tiempo_total_min: 8,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'ajo', cantidad: 8, unidad: 'dientes', esencial: true, categoria: 'vegetal' },
      { nombre: 'jugo de naranja agria (o mitad naranja + mitad limón)', cantidad: 80, unidad: 'ml', esencial: true, categoria: 'fruta' },
      { nombre: 'aceite de oliva', cantidad: 60, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'comino molido', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'orégano seco', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
    ],
    pasos: [
      'Machacá el ajo con sal en mortero hasta obtener una pasta.',
      'Calentá el aceite en sartén pequeña a fuego medio-alto hasta que humee ligeramente.',
      'Vertí el aceite caliente sobre el ajo machacado con cuidado (va a chisporrotear).',
      'Añadí el jugo de naranja agria, el comino y el orégano. Mezclá bien.',
      'Usá inmediatamente como marinada o dejá enfriar para servir como salsa.',
    ],
    info_nutricional_aprox: { calorias_porcion: 100, proteina_g: 0, carbohidratos_g: 2, grasa_g: 10, fibra_g: 0, azucar_g: 1, sodio_mg: 100 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Crema de ají amarillo',
    descripcion_corta: 'Salsa peruana de ají amarillo. Base de la cocina limeña, va con causa, papa a la huancaína y más.',
    tiempo_total_min: 10,
    porciones: 8,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'ají amarillo fresco (o pasta)', cantidad: 3, unidad: 'unidades', esencial: true, categoria: 'vegetal' },
      { nombre: 'aceite vegetal', cantidad: 60, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'ajo', cantidad: 2, unidad: 'dientes', esencial: true, categoria: 'vegetal' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'jugo de limón', cantidad: 15, unidad: 'ml', esencial: false, categoria: 'fruta' },
    ],
    pasos: [
      'Si usás ají fresco: abrilo, quitá semillas y venas, herví 3 minutos, descartá el agua.',
      'En licuadora, procesá el ají con el ajo y un poco de sal.',
      'Con la licuadora en marcha, añadí el aceite en hilo fino para emulsionar.',
      'Ajustá sal y limón. La crema debe quedar suave y brillante.',
      'Guardá en frasco hasta 1 semana en nevera.',
    ],
    info_nutricional_aprox: { calorias_porcion: 80, proteina_g: 0, carbohidratos_g: 2, grasa_g: 8, fibra_g: 0, azucar_g: 1, sodio_mg: 90 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Salsa rosada',
    descripcion_corta: 'La clásica salsa rosada: mayonesa con ketchup. Va con hamburguesas, mariscos, papas y ensaladas.',
    tiempo_total_min: 5,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'mayonesa', cantidad: 80, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'ketchup', cantidad: 30, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'jugo de limón', cantidad: null, unidad: null, esencial: false, categoria: 'fruta' },
      { nombre: 'salsa inglesa (worcestershire)', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
    ],
    pasos: [
      'Mezclá la mayonesa y el ketchup en proporción 3:1.',
      'Añadí gotas de limón y salsa inglesa al gusto.',
      'Probá y ajustá. Guardá en nevera hasta 1 semana.',
    ],
    info_nutricional_aprox: { calorias_porcion: 110, proteina_g: 0, carbohidratos_g: 3, grasa_g: 11, fibra_g: 0, azucar_g: 2, sodio_mg: 180 },
    perfiles: { ...PERFILES_COMUN, keto: false, deficit_calorico: false },
  },
  {
    nombre: 'Salsa golf argentina',
    descripcion_corta: 'Versión argentina de la salsa rosada, más refinada. Clásica para mariscos y ensaladas.',
    tiempo_total_min: 5,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'mayonesa', cantidad: 80, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'ketchup', cantidad: 25, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'jugo de limón', cantidad: 10, unidad: 'ml', esencial: true, categoria: 'fruta' },
      { nombre: 'cognac o whisky (opcional)', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
      { nombre: 'sal y pimienta', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
    ],
    pasos: [
      'Mezclá mayonesa y ketchup.',
      'Añadí el jugo de limón y el cognac si usás.',
      'Salpimentá y guardá en nevera.',
    ],
    info_nutricional_aprox: { calorias_porcion: 105, proteina_g: 0, carbohidratos_g: 3, grasa_g: 10, fibra_g: 0, azucar_g: 2, sodio_mg: 170 },
    perfiles: { ...PERFILES_COMUN, keto: false, deficit_calorico: false },
  },
  {
    nombre: 'Salsa de tomate natural',
    descripcion_corta: 'Salsa de tomate fresco hecha en casa. Base para pastas, pizzas, carnes y guisos.',
    tiempo_total_min: 20,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'tomate maduro', cantidad: 500, unidad: 'g', esencial: true, categoria: 'vegetal' },
      { nombre: 'ajo', cantidad: 3, unidad: 'dientes', esencial: true, categoria: 'vegetal' },
      { nombre: 'cebolla', cantidad: 0.5, unidad: 'unidad', esencial: true, categoria: 'vegetal' },
      { nombre: 'aceite de oliva', cantidad: 30, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'albahaca fresca', cantidad: null, unidad: null, esencial: false, categoria: 'vegetal' },
      { nombre: 'sal y pimienta', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'azúcar (pizca)', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
    ],
    pasos: [
      'Pelá y picá los tomates. Picá la cebolla y el ajo.',
      'Sofreí la cebolla y el ajo en aceite hasta transparentar, 3 min.',
      'Añadí el tomate, una pizca de azúcar, sal y pimienta.',
      'Cociná a fuego medio-bajo 15 minutos revolviendo ocasionalmente.',
      'Triturá con licuadora o dejalo con trozos según preferencia. Añadí albahaca al final.',
    ],
    info_nutricional_aprox: { calorias_porcion: 50, proteina_g: 1, carbohidratos_g: 5, grasa_g: 3, fibra_g: 1, azucar_g: 3, sodio_mg: 120 },
    perfiles: { ...PERFILES_COMUN, keto: false },
  },
  {
    nombre: 'Pesto genovés',
    descripcion_corta: 'Pesto italiano clásico de albahaca, piñones y parmesano. Para pasta, tostadas, pollo y ensaladas.',
    tiempo_total_min: 10,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'albahaca fresca', cantidad: 60, unidad: 'g', esencial: true, categoria: 'vegetal' },
      { nombre: 'aceite de oliva extra virgen', cantidad: 80, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'parmesano rallado', cantidad: 40, unidad: 'g', esencial: true, categoria: 'lacteo' },
      { nombre: 'piñones (o nueces)', cantidad: 30, unidad: 'g', esencial: true, categoria: 'frutos secos' },
      { nombre: 'ajo', cantidad: 2, unidad: 'dientes', esencial: true, categoria: 'vegetal' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
    ],
    pasos: [
      'Tostá los piñones en sartén seca 2 minutos hasta dorar ligeramente.',
      'En procesadora o mortero, triturá el ajo con sal hasta pasta.',
      'Añadí la albahaca y los piñones. Procesá.',
      'Incorporá el aceite en hilo mientras procesás.',
      'Agregá el parmesano y mezclá. Ajustá sal. Usá fresco o guardá cubierto con aceite.',
    ],
    info_nutricional_aprox: { calorias_porcion: 160, proteina_g: 4, carbohidratos_g: 2, grasa_g: 16, fibra_g: 0, azucar_g: 0, sodio_mg: 140 },
    perfiles: { ...PERFILES_COMUN, keto: true, vegetariana: true },
  },
  {
    nombre: 'Salsa de tahini',
    descripcion_corta: 'Salsa de sésamo de Medio Oriente. Va con falafel, vegetales, ensaladas y carnes.',
    tiempo_total_min: 5,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'tahini (pasta de sésamo)', cantidad: 80, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'jugo de limón', cantidad: 40, unidad: 'ml', esencial: true, categoria: 'fruta' },
      { nombre: 'ajo', cantidad: 1, unidad: 'diente', esencial: true, categoria: 'vegetal' },
      { nombre: 'agua fría', cantidad: 40, unidad: 'ml', esencial: true, categoria: 'otros' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'comino (opcional)', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
    ],
    pasos: [
      'Machacá el ajo con sal.',
      'Mezclá el tahini con el jugo de limón — la mezcla se espesará.',
      'Añadí el agua fría de a poco revolviendo hasta lograr consistencia de crema.',
      'Incorporá el ajo y el comino. Ajustá sal y limón.',
    ],
    info_nutricional_aprox: { calorias_porcion: 100, proteina_g: 3, carbohidratos_g: 4, grasa_g: 9, fibra_g: 1, azucar_g: 0, sodio_mg: 80 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Tzatziki griego',
    descripcion_corta: 'Salsa griega de yogur y pepino. Fresca, ligera, perfecta para carnes, pita y vegetales.',
    tiempo_total_min: 10,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'yogur griego natural', cantidad: 200, unidad: 'g', esencial: true, categoria: 'lacteo' },
      { nombre: 'pepino', cantidad: 1, unidad: 'unidad', esencial: true, categoria: 'vegetal' },
      { nombre: 'ajo', cantidad: 2, unidad: 'dientes', esencial: true, categoria: 'vegetal' },
      { nombre: 'aceite de oliva', cantidad: 15, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'eneldo fresco (o menta)', cantidad: null, unidad: null, esencial: false, categoria: 'vegetal' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'jugo de limón', cantidad: null, unidad: null, esencial: false, categoria: 'fruta' },
    ],
    pasos: [
      'Rallá el pepino, ponelo en un colador con sal 5 minutos y exprimí el exceso de agua.',
      'Mezclá el yogur con el ajo machacado.',
      'Añadí el pepino escurrido, el aceite y el eneldo.',
      'Ajustá sal y limón. Refrigerá 30 minutos antes de servir.',
    ],
    info_nutricional_aprox: { calorias_porcion: 50, proteina_g: 4, carbohidratos_g: 3, grasa_g: 3, fibra_g: 0, azucar_g: 2, sodio_mg: 100 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Guacamole',
    descripcion_corta: 'El guacamole mexicano clásico. Para tacos, tostadas, snack con chips, o como acompañamiento.',
    tiempo_total_min: 10,
    porciones: 4,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'aguacate maduro', cantidad: 2, unidad: 'unidades', esencial: true, categoria: 'vegetal' },
      { nombre: 'jugo de limón', cantidad: 20, unidad: 'ml', esencial: true, categoria: 'fruta' },
      { nombre: 'cebolla morada', cantidad: 0.25, unidad: 'unidad', esencial: true, categoria: 'vegetal' },
      { nombre: 'cilantro fresco', cantidad: null, unidad: null, esencial: true, categoria: 'vegetal' },
      { nombre: 'chile jalapeño o serrano', cantidad: 0.5, unidad: 'unidad', esencial: false, categoria: 'vegetal' },
      { nombre: 'tomate', cantidad: 1, unidad: 'unidad', esencial: false, categoria: 'vegetal' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
    ],
    pasos: [
      'Abrí los aguacates, retirá el hueso y sacá la pulpa.',
      'Aplastá con tenedor, dejando algo de textura.',
      'Picá la cebolla, el cilantro, el chile y el tomate muy finamente.',
      'Mezclá todo, añadí el limón y sal.',
      'Para guardar, colocá el hueso adentro y cubrí con film pegado a la superficie.',
    ],
    info_nutricional_aprox: { calorias_porcion: 120, proteina_g: 2, carbohidratos_g: 7, grasa_g: 11, fibra_g: 5, azucar_g: 1, sodio_mg: 90 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Salsa criolla colombiana',
    descripcion_corta: 'Salsa fresca de cebolla, tomate y cilantro. El acompañamiento número 1 del asado colombiano.',
    tiempo_total_min: 10,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'cebolla cabezona blanca', cantidad: 1, unidad: 'unidad', esencial: true, categoria: 'vegetal' },
      { nombre: 'tomate', cantidad: 2, unidad: 'unidades', esencial: true, categoria: 'vegetal' },
      { nombre: 'cilantro fresco', cantidad: null, unidad: null, esencial: true, categoria: 'vegetal' },
      { nombre: 'vinagre blanco', cantidad: 20, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'limón', cantidad: null, unidad: null, esencial: false, categoria: 'fruta' },
    ],
    pasos: [
      'Cortá la cebolla en plumas finas. Sumergila en agua fría 5 minutos para suavizar el sabor fuerte.',
      'Cortá el tomate en cubos pequeños quitando las semillas.',
      'Picá el cilantro finamente.',
      'Escurrí bien la cebolla y mezclá todo.',
      'Aliñá con vinagre, sal y limón. Reposá 10 minutos antes de servir.',
    ],
    info_nutricional_aprox: { calorias_porcion: 20, proteina_g: 1, carbohidratos_g: 4, grasa_g: 0, fibra_g: 1, azucar_g: 2, sodio_mg: 80 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Vinagreta básica',
    descripcion_corta: 'La vinagreta francesa clásica. Para cualquier ensalada verde o de vegetales.',
    tiempo_total_min: 5,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'aceite de oliva', cantidad: 60, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'vinagre de vino blanco', cantidad: 20, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'mostaza dijon', cantidad: 5, unidad: 'g', esencial: false, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'pimienta negra', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'ajo en polvo', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
    ],
    pasos: [
      'Mezclá el vinagre con la mostaza y la sal en un frasco.',
      'Añadí el aceite y cerrá el frasco.',
      'Agitá vigorosamente hasta emulsionar.',
      'Ajustá con pimienta y ajo en polvo al gusto.',
    ],
    info_nutricional_aprox: { calorias_porcion: 90, proteina_g: 0, carbohidratos_g: 0, grasa_g: 10, fibra_g: 0, azucar_g: 0, sodio_mg: 70 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Salsa de yogur con ajo',
    descripcion_corta: 'Salsa ligera y fresca de yogur y ajo. Va perfecta con falafel, pollo a la plancha y vegetales.',
    tiempo_total_min: 5,
    porciones: 4,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'yogur natural (no griego)', cantidad: 150, unidad: 'g', esencial: true, categoria: 'lacteo' },
      { nombre: 'ajo', cantidad: 2, unidad: 'dientes', esencial: true, categoria: 'vegetal' },
      { nombre: 'jugo de limón', cantidad: 10, unidad: 'ml', esencial: true, categoria: 'fruta' },
      { nombre: 'aceite de oliva', cantidad: 10, unidad: 'ml', esencial: false, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
      { nombre: 'menta o perejil', cantidad: null, unidad: null, esencial: false, categoria: 'vegetal' },
    ],
    pasos: [
      'Machacá el ajo con sal en mortero o rallálo fino.',
      'Mezclá con el yogur, el limón y el aceite.',
      'Añadí hierbas al gusto. Refrigerá hasta usar.',
    ],
    info_nutricional_aprox: { calorias_porcion: 45, proteina_g: 3, carbohidratos_g: 3, grasa_g: 2, fibra_g: 0, azucar_g: 2, sodio_mg: 80 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Salsa BBQ casera',
    descripcion_corta: 'Salsa BBQ ahumada hecha en casa. Para costillas, pollo, hamburguesas y pinchos.',
    tiempo_total_min: 15,
    porciones: 8,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'ketchup', cantidad: 150, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'vinagre de manzana', cantidad: 30, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'azúcar morena', cantidad: 30, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'salsa inglesa (worcestershire)', cantidad: 15, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'mostaza', cantidad: 10, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'ajo en polvo', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
      { nombre: 'pimentón ahumado', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
    ],
    pasos: [
      'Mezclá todos los ingredientes en una olla pequeña.',
      'Cociná a fuego medio-bajo revolviendo hasta que el azúcar se disuelva, unos 8-10 minutos.',
      'La salsa debe reducir y espesar ligeramente.',
      'Enfriá antes de usar. Guardá hasta 2 semanas en nevera.',
    ],
    info_nutricional_aprox: { calorias_porcion: 60, proteina_g: 0, carbohidratos_g: 14, grasa_g: 0, fibra_g: 0, azucar_g: 12, sodio_mg: 280 },
    perfiles: { ...PERFILES_COMUN, keto: false, deficit_calorico: false },
  },
  {
    nombre: 'Salsa de mostaza y miel',
    descripcion_corta: 'Salsa dulce-picante de mostaza y miel. Para pollo, sándwiches, nuggets y vegetales asados.',
    tiempo_total_min: 5,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'mostaza dijon', cantidad: 60, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'miel', cantidad: 40, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'mayonesa', cantidad: 30, unidad: 'g', esencial: false, categoria: 'condimento' },
      { nombre: 'vinagre de manzana', cantidad: 10, unidad: 'ml', esencial: false, categoria: 'condimento' },
      { nombre: 'sal y pimienta', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
    ],
    pasos: [
      'Mezclá la mostaza con la miel.',
      'Añadí la mayonesa y el vinagre si usás.',
      'Salpimentá y guardá en nevera.',
    ],
    info_nutricional_aprox: { calorias_porcion: 75, proteina_g: 0, carbohidratos_g: 10, grasa_g: 4, fibra_g: 0, azucar_g: 9, sodio_mg: 150 },
    perfiles: { ...PERFILES_COMUN, keto: false },
  },
  {
    nombre: 'Salsa de soya con limón',
    descripcion_corta: 'Salsa asiática de soya y limón. Para arroz, sushi, carnes a la plancha y vegetales salteados.',
    tiempo_total_min: 5,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'salsa de soya', cantidad: 60, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'jugo de limón', cantidad: 30, unidad: 'ml', esencial: true, categoria: 'fruta' },
      { nombre: 'aceite de sésamo', cantidad: 10, unidad: 'ml', esencial: false, categoria: 'condimento' },
      { nombre: 'jengibre fresco rallado', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
      { nombre: 'ajo', cantidad: 1, unidad: 'diente', esencial: false, categoria: 'vegetal' },
      { nombre: 'cebolla de verdeo picada', cantidad: null, unidad: null, esencial: false, categoria: 'vegetal' },
    ],
    pasos: [
      'Mezclá la soya con el jugo de limón.',
      'Añadí el aceite de sésamo, el jengibre y el ajo rallado.',
      'Ajustá con más limón o soya según preferencia.',
    ],
    info_nutricional_aprox: { calorias_porcion: 20, proteina_g: 1, carbohidratos_g: 2, grasa_g: 1, fibra_g: 0, azucar_g: 1, sodio_mg: 480 },
    perfiles: { ...PERFILES_COMUN, keto: true },
  },
  {
    nombre: 'Mayonesa casera',
    descripcion_corta: 'Mayonesa hecha en casa, cremosa y fresca. Base para mil salsas y aderezos.',
    tiempo_total_min: 8,
    porciones: 8,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'huevo', cantidad: 1, unidad: 'unidad', esencial: true, categoria: 'proteina' },
      { nombre: 'aceite de girasol', cantidad: 200, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'jugo de limón', cantidad: 15, unidad: 'ml', esencial: true, categoria: 'fruta' },
      { nombre: 'mostaza (opcional)', cantidad: null, unidad: null, esencial: false, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
    ],
    pasos: [
      'Ponés el huevo entero en el fondo del vaso de la minipimer.',
      'Añadís el aceite, el limón y la sal encima.',
      'Metés la minipimer hasta el fondo sin moverla y arrancás.',
      'Cuando empiece a emulsionar, subís lentamente la minipimer.',
      'Guardá en nevera tapada. Consume en 3-4 días.',
    ],
    info_nutricional_aprox: { calorias_porcion: 150, proteina_g: 1, carbohidratos_g: 0, grasa_g: 17, fibra_g: 0, azucar_g: 0, sodio_mg: 80 },
    perfiles: { ...PERFILES_COMUN, keto: true, vegetariana: true, ninos: true },
  },
  {
    nombre: 'Salsa de champiñones',
    descripcion_corta: 'Salsa cremosa de champiñones. Va con carnes a la plancha, pasta, arroz y pollo.',
    tiempo_total_min: 15,
    porciones: 4,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'champiñones', cantidad: 250, unidad: 'g', esencial: true, categoria: 'vegetal' },
      { nombre: 'crema de leche', cantidad: 100, unidad: 'ml', esencial: true, categoria: 'lacteo' },
      { nombre: 'ajo', cantidad: 2, unidad: 'dientes', esencial: true, categoria: 'vegetal' },
      { nombre: 'mantequilla', cantidad: 15, unidad: 'g', esencial: true, categoria: 'lacteo' },
      { nombre: 'vino blanco (opcional)', cantidad: 30, unidad: 'ml', esencial: false, categoria: 'condimento' },
      { nombre: 'sal, pimienta y perejil', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
    ],
    pasos: [
      'Laminá los champiñones y picá el ajo finamente.',
      'Derretí la mantequilla en sartén a fuego alto.',
      'Sofreí los champiñones hasta dorar bien, sin moverlos demasiado, 4-5 min.',
      'Añadí el ajo y el vino. Cociná 1 minuto.',
      'Bajá el fuego, añadí la crema y cociná 3 minutos hasta espesar. Salpimentá y añadí perejil.',
    ],
    info_nutricional_aprox: { calorias_porcion: 120, proteina_g: 3, carbohidratos_g: 4, grasa_g: 11, fibra_g: 1, azucar_g: 2, sodio_mg: 160 },
    perfiles: { ...PERFILES_COMUN, keto: true, vegetariana: true },
  },
  {
    nombre: 'Salsa de maracuyá',
    descripcion_corta: 'Salsa dulce-ácida de maracuyá. Para pollo, cerdo, ensaladas y postres.',
    tiempo_total_min: 10,
    porciones: 6,
    dificultad: 'facil',
    ingredientes: [
      { nombre: 'pulpa de maracuyá', cantidad: 100, unidad: 'ml', esencial: true, categoria: 'fruta' },
      { nombre: 'azúcar', cantidad: 40, unidad: 'g', esencial: true, categoria: 'condimento' },
      { nombre: 'vinagre de vino blanco', cantidad: 15, unidad: 'ml', esencial: true, categoria: 'condimento' },
      { nombre: 'aceite de oliva', cantidad: 30, unidad: 'ml', esencial: false, categoria: 'condimento' },
      { nombre: 'sal', cantidad: null, unidad: null, esencial: true, categoria: 'condimento' },
    ],
    pasos: [
      'Pasá la pulpa de maracuyá por un colador para separar semillas si preferís.',
      'En olla pequeña, calentá el jugo con el azúcar hasta disolver y reducir ligeramente, 3-4 min.',
      'Retirá del fuego, añadí el vinagre y el aceite.',
      'Ajustá azúcar y sal según gusto. Servís fría o tibia.',
    ],
    info_nutricional_aprox: { calorias_porcion: 70, proteina_g: 0, carbohidratos_g: 12, grasa_g: 3, fibra_g: 1, azucar_g: 10, sodio_mg: 40 },
    perfiles: { ...PERFILES_COMUN, keto: false },
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${APPLY ? '🚀 APPLY' : '📋 DRY-RUN'} — ${SALSAS.length} salsas\n`)

  // Verificar cuáles ya existen para no duplicar
  const { data: existentes } = await supabase
    .from('recipes')
    .select('nombre')
    .in('nombre', SALSAS.map(s => s.nombre))

  const nombresExistentes = new Set(existentes?.map(r => r.nombre) ?? [])

  const nuevas   = SALSAS.filter(s => !nombresExistentes.has(s.nombre))
  const ya_estan = SALSAS.filter(s =>  nombresExistentes.has(s.nombre))

  if (ya_estan.length) {
    console.log(`⏭️  Ya existen (${ya_estan.length}):`)
    ya_estan.forEach(s => console.log(`   • ${s.nombre}`))
    console.log()
  }

  if (!nuevas.length) {
    console.log('✅ Todas las salsas ya están en BD. Nada que insertar.')
    return
  }

  console.log(`✅ A insertar (${nuevas.length}):`)
  nuevas.forEach(s => console.log(`   • ${s.nombre}  (${s.tiempo_total_min} min)`))

  if (!APPLY) {
    console.log(`\n─────────────────────────────────────────`)
    console.log(`DRY-RUN — no se hizo ningún cambio.`)
    console.log(`Para insertar: node --env-file=.env scripts/seed-salsas.mjs --apply`)
    return
  }

  // ── Insertar ────────────────────────────────────────────────────────────────
  const rows = nuevas.map(s => ({
    nombre:              s.nombre,
    descripcion_corta:   s.descripcion_corta,
    tipo_comida:         TIPO_COMIDA_TODO,
    tipo_componente:     'salsa',
    tiempo_total_min:    s.tiempo_total_min,
    dificultad:          s.dificultad,
    porciones:           s.porciones,
    ingredientes:        s.ingredientes,
    pasos:               s.pasos,
    info_nutricional_aprox: s.info_nutricional_aprox,
    perfiles:            s.perfiles,
    is_base_recipe:      true,
    is_active_for_menu:  true,
    source:              'semilla_salsas',
    visibility:          'public',
    family_id:           null,
    etiqueta_practicidad: 'diario',
  }))

  const { data, error } = await supabase.from('recipes').insert(rows).select('id, nombre')

  if (error) {
    console.error('\n✗ Error al insertar:', error.message)
    process.exit(1)
  }

  console.log(`\n✅ ${data.length} salsas insertadas en BD:`)
  data.forEach(r => console.log(`   • ${r.nombre}  [${r.id}]`))
}

main().catch(console.error)

# mesa.os — Documento Maestro v6

**Última actualización:** 27 mayo 2026  
**URL producción:** https://mesa-os-beta.vercel.app  
**Repo:** GitHub nauticaleventos/mesaos  
**Stack:** React + Vite + TypeScript + Tailwind + Zustand / Supabase / Vercel Hobby  
**Deploy manual:** `npx vercel deploy --prod` (auto-deploy no siempre funciona en Hobby)

---

## ¿Qué es mesa.os?

Coach de gestión del tiempo en cocina para familias latinoamericanas.  
**Objetivo central: minimizar el tiempo en cocina sin sacrificar los gustos.**  
No es una app de recetas — es un sistema que piensa por vos.

---

## Tita — Voz de marca

La IA de mesa.os se llama **Tita**. Características:
- Cálida, directa, latina
- Habla de igual a igual, no como asistente corporativa
- Entiende la realidad de cocinar para una familia ocupada
- 3 pantallas de bienvenida post-signup antes del onboarding
- Presente en mensajes de estado, sugerencias y flujos vacíos

---

## Familia de prueba activa

**Cuenta:** alesofiad@gmail.com

| Miembro | Edad | Objetivo | Restricciones | Comidas configuradas |
|---------|------|----------|---------------|----------------------|
| Ale | 41 | Déficit calórico | Ninguna | Desayuno, Almuerzo, Merienda tarde, Cena |
| Sarah | 7 | Mantenimiento | **Alergia a huevo** | Desayuno, Merienda mañana, Almuerzo, Merienda tarde, Cena |
| Abel | — | — | No está creado en BD todavía | — |

**Nota importante:** "Merienda mañana" y "Merienda tarde" se guardan como `meal_type` en la BD con ese nombre exacto. El motor los normaliza internamente a 'snack' para buscar recetas.

---

## Lo que está funcionando ✅

### Motor de menú (motorMenu.ts)
- Genera menú semanal 7 días respetando `meals_per_day` por miembro
- **Regla de oro: 1 receta para todos** — solo genera entradas individuales cuando hay restricción real (alergia, vegano, etc.)
- Prioridad de selección: universal fresca (≥3 días) → universal con gap relajado → per-miembro → repetición como último recurso
- **Regla de 3 días**: no repite la misma receta en menos de 3 días. Tracking con `Map<recipeId, dayNumber>`
- Respeta: alergias, estilo alimenticio (vegetariano/vegano/keto), condiciones de salud, proteínas excluidas
- Batch cooking: sabe qué días cocinar → calentar/descongelar los demás
- Día difícil ⚡: simplifica próximas N comidas (usa `meal_time` del usuario para determinar cuáles siguen)
- Prioriza recetas con ingredientes en nevera: bonus 500/300/150/50 por % de match
- Bonus por sobras, sugerencias, ratings, recetas favoritas
- Ruido aleatorio ±8 para variedad entre regeneraciones
- **Salsas/ensaladas/guarniciones NUNCA aparecen como plato principal** en merienda/desayuno

### Recetario
- ~871 recetas activas clasificadas
- Import: PDF, texto, URL web, foto, IA (2 campos → Claude completa)
- Import redes sociales: TikTok + YouTube (oEmbed + Groq Whisper), Instagram (Apify)
- Fotos propias subibles (Supabase Storage)
- Detalle: ingredientes con porciones dinámicas, pasos con checkmark
- Rating post-cocción (modal estrellas al marcar "La cociné")
- Swipe tipo Tinder, Bookmark ⭐

### Menú semanal (DiaCard + MealSection)
- Vista por día con secciones por tipo de comida
- Cada componente (proteína, guarnición, ensalada, salsa) tiene su propio botón **Cambiar** (RefreshCw)
- **Cambiar** busca alternativas del mismo `tipo_componente` (guarnición→guarniciones, ensalada→ensaladas)
- Paginación "Ver más" en cambiar (5+5) y en agregar (5+5, limit 50)
- Botón **"+ Agrega más"** con popover de opciones según slot
- AccionesRow expandible: Ver receta / Cocinada / Saltar / Cambiar
- Badge ♻️ cuando hay sobra asignada al slot
- Badge ⚡ cuando es Día difícil
- Porciones visuales inline (palma/puño por miembro)

### Día difícil ⚡
- Sheet con 3 opciones (1/2/3 próximas comidas)
- Usa `meal_time` configurado por el usuario para determinar qué comida sigue
- Cutoffs: desayuno 08:00, merienda mañana 10:30, almuerzo 14:00, merienda tarde 16:30, cena 20:00, snack noche 21:30
- 30 min de gracia después del inicio de la comida
- Prioriza por score: etiqueta_practicidad='diario' (+100) → dificultad='facil' (+50) → menor tiempo

### Sobras
- Registro en `weekly_leftovers`
- **Picker automático** al agregar sobra: pregunta "¿Cuándo la usás?" inmediatamente
- Slots disponibles según hora actual + comidas futuras configuradas
- Badge ♻️ en DiaCard cuando la sobra está asignada
- Sugerencia de salsa cuando se asigna proteína sobrante

### Lista de mercado
- Genera desde menú semanal × nevera
- Normalización exhaustiva de ingredientes: quita preparaciones (picado, rallado, en hojuelas, muy, bien, recién, laminado, etc.)
- Prefijos de procesamiento: "ralladura de cáscara de X" → X, "hojas de X" → X, "jugo de X" → X
- MANTENER_EXACTO: ajo en polvo, avena en hojuelas, mantequilla sin sal, yogurt griego, pan integral, linaza molida, etc.
- Agrupación y suma de cantidades con conversión de unidades (kg↔g, l↔ml)
- Cruce con nevera: match parcial, calcula lo que falta
- Categorización: 200+ keywords → objetivo <5% en "Otros"
- Categorías: frutas_verduras, carniceria, pescaderia, lacteos_huevos, panaderia, granos_pastas, enlatados, aceites_condimentos, snacks_dulces, bebidas, aseo_hogar
- Herbs/especias (romero, tomillo, laurel, albahaca) → aceites_condimentos
- Widget nevera en MenuPage: expandible con nombres de recetas que requieren compra

### Nevera
- Inventario por ubicación (nevera/congelador/despensa)
- Auto-clasificación en `handleSubmit` (funciona en mobile)
- Badge match en cada receta
- 18 salsas latinoamericanas con `tipo_comida=[]` (accesorios, no platos)

### Onboarding
- 3 pantallas de bienvenida de Tita post-signup
- Wizard 7 campos: nombre, tipo, objetivo, peso, altura, edad, alergias
- calcularMacros.ts: Mifflin-St Jeor → calorías, macros, fibra, agua
- El formulario completo queda como "Editar perfil"

### Infraestructura
- Deploy: `npx vercel deploy --prod` + alias automático a mesa-os-beta.vercel.app
- Variables de entorno: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY, GROQ_API_KEY, APIFY_API_TOKEN, ANTHROPIC_API_KEY
- Migraciones ejecutadas: 001–020

---

## Salsas en BD

**Regla:** Las salsas tienen `tipo_comida=[]` (no van en ningún slot como plato principal).  
Aparecen solo cuando el usuario las agrega vía botón "+". Se buscan por `tipo_componente='salsa'`.

18 salsas sembradas: Chimichurri, Hogao colombiano, Mojo cubano, Crema de ají amarillo, Salsa rosada, Salsa golf argentina, Salsa de tomate natural, Pesto genovés, Salsa de tahini, Tzatziki griego, Salsa criolla colombiana, Vinagreta básica, Salsa de yogur con ajo, Salsa BBQ casera, Salsa de mostaza y miel, Salsa de soya con limón, Salsa de champiñones, Salsa de maracuyá.

Script para re-aplicar si se borran: `node scripts/seed-salsas.mjs --apply`  
Script para corregir tipo_comida de accesorios: `node scripts/fix-tipo-comida-accesorios.mjs --apply`

---

## Lo que está a medias ⚠️

| Feature | Estado | Notas |
|---------|--------|-------|
| Macros Fase 1 | calcularMacros.ts existe | Falta mostrar calorías del día por persona en home del menú |
| Shortcut iOS | Página /importar creada | Pendiente configurar en el dispositivo de la usuaria |
| Instagram import | Implementado con Apify | Pendiente probar con link real copiado desde la app |
| Facebook import | Implementado vía Apify | Sin probar |

---

## Lo que falta 🔴

### Alta prioridad
1. **Abel como miembro** — crearlo en la app con su perfil y comidas
2. **Excel 42 recetas sospechosas** — abrir `recetas-app/auditorias/recetas-sospechosas-revisar.xlsx`, revisar, correr `node scripts/aplicar-correcciones-auditoria.mjs --apply`
3. **Macros Fase 1** — calorías del día por persona en home del menú (calcularMacros.ts ya existe)

### Media prioridad
4. **Estadísticas Día difícil** — dato ya existe en `weekly_menu.dia_dificil=true`. Query: `SELECT week_start, COUNT(*) FROM weekly_menu WHERE family_id=? AND dia_dificil=true GROUP BY week_start`
5. **Bienvenida Tita** — ajustes de diseño anotados por la usuaria
6. **Plan cocción visual** — orden inteligente de preparación
7. **Lista de mercado: Claude para "Otros"** — último 5% de ingredientes sin categoría, inferir con Claude

### Baja prioridad (Fase 4)
8. Notificaciones push (noche anterior: descongelar, marinar)
9. Roles diferenciados chef / miembro
10. Galería comunitaria de fotos
11. Sistema de invitados con restricciones

---

## Backlog de ideas

- **Motor de menú inteligente** — aprendizaje pasivo de patrones familiares (Fase 3)
- **Predicción de inventario** — cuándo se va a acabar cada ingrediente
- **Reciclaje cruzado de sobras** — usar sobras de almuerzo en cena del mismo día
- **Menú según estado emocional** — "tengo ganas de algo rico" vs "modo supervivencia"
- **Compartir menú con el chef** — link público de 7 días (ya implementado, ver VistaMenu)
- **Import desde foto con IA** — ya funciona vía FormaFoto
- **Versión app nativa** (PWA o React Native) — cuando haya >100 usuarios activos
- **Comunidad de recetas** — visibilidad pública entre familias

---

## Decisiones arquitectónicas (no cambiar sin revisión)

| Decisión | Razón |
|----------|-------|
| UX import: 2 pasos siempre (¿cuándo? + ¿qué es?) | Evita recetas mal clasificadas |
| Motor: nevera ≥60% → solo recetas con match | Reduce compras, prioriza lo que hay |
| Sorpréndeme: NUNCA salsas/vinagretas como plato | Son accesorios, no platos |
| Recetas para lucirse ⭐: solo super usuario marca | Evita que el motor las ponga en días difíciles |
| Desayuno = UNA sola receta + acompañamiento manual | Simplifica la mañana |
| Cocción configurable por día | Permite planear con anticipación |
| Motor respeta TODAS las comidas configuradas por miembro | Flexibilidad real de la familia |
| Porciones: solo enteros y mitades (½ o 1) | Más fácil de visualizar |
| memberId=null en weekly_menu = toda la familia come esa receta | Menos filas, más claro |
| salsas/ensaladas/guarniciones tienen tipo_comida=[] | Solo aparecen vía botón +, nunca como plato |
| Regla 3 días entre repeticiones | Balance variedad vs pool limitado |
| Universal (1 receta para todos) > per-miembro | Minimizar tiempo en cocina |

---

## Stack técnico completo

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Frontend | React 18 + Vite + TypeScript | |
| UI | Tailwind CSS + Lucide icons | Design tokens en tailwind.config |
| Estado | Zustand + persist middleware | Stores: menu, fridge, family, shopping, etc. |
| Backend | Supabase (PostgreSQL + Auth + Storage + RLS) | |
| IA | Claude Sonnet 4.6 (Anthropic) | Import, nutrición, receta manual |
| Audio/Video | Groq Whisper | Import TikTok/YouTube |
| Scraping | Apify | Import Instagram/Facebook |
| Deploy | Vercel Hobby | `npx vercel deploy --prod` |
| Repo | GitHub nauticaleventos/mesaos | |

### Archivos clave

```
src/
  lib/
    motorMenu.ts          ← Algoritmo puro de generación de menú (NO tiene side effects)
    matchReceta.ts        ← Score de match ingredientes vs nevera
    porcionEmoji.ts       ← Inferencia de emojis de porción por receta
    calcularMacros.ts     ← Mifflin-St Jeor + macros por miembro
  store/
    menuStore.ts          ← Estado menú + generarMenu + simplificarComidas + buscarAlternativas
    shoppingListStore.ts  ← Lista de mercado: normIngrediente, buildItems, resolverPasilloNombre
    fridgeStore.ts        ← Nevera
    familyStore.ts        ← Familia + miembros
    leftoversStore.ts     ← Sobras semanales
  components/menu/
    DiaCard.tsx           ← Card por día con MealSection, AgregarPanel, CambiarSheet
    CambiarSheet.tsx      ← Sheet para cambiar receta (paginado 5+5)
    DiaDificilSheet.tsx   ← Sheet día difícil
    SobradosSheet.tsx     ← Registro y asignación de sobras
  pages/menu/
    MenuPage.tsx          ← Página principal con WidgetNevera
scripts/
  seed-salsas.mjs              ← Siembra 18 salsas base (usar con --apply)
  fix-tipo-comida-accesorios.mjs ← Limpia tipo_comida de salsas/ensaladas/guarniciones
```

### Migraciones SQL ejecutadas

| # | Descripción |
|---|---|
| 001–016 | Schema base, motor, fotos, etiquetas |
| 017 | recipe_id nullable + nombre_custom en weekly_menu |
| 018 | bienvenida_vista en families |
| 019 | rating_prompted en weekly_menu |
| 020 | tabla import_usage (monitoreo imports por plataforma) |

---

## Commits recientes (sesión 27 mayo 2026)

```
245157e  fix(mercado): BUG 3 normalización exhaustiva ingredientes
75fb482  fix(motor): TypeScript errors
9d045b9  fix(motor): regla 3 días entre repeticiones
ed7c247  fix(mercado): widget nevera muestra recetas que requieren compra
cb7a7b3  feat(motor): R4 bonus nevera 500/300/150
2bccb58  feat(mercado): R1+R2 normalización completa
f33a74a  feat(mercado): R5 categorías 200+ keywords
1f6c727  fix(motor): variedad semanal universal fresca > repetida
f772a19  fix(cambiar): botón Cambiar por componente
a6de1c0  feat(agregar): paginación 5+5 Ver más
35bd349  fix(motor): forzar 1 receta cuando es universal
1bc7181  fix(motor): siempre 1 receta para todos
049aad8  fix(cambiar): alternativas por tipo_componente
a7bcf10  feat(ux): botón + Agrega más con texto
702e1d1  fix(motor): excluir salsas de pool snack/desayuno
03349ad  fix(motor): búsqueda universal antes de por-miembro
bccf3cf  fix(dia-dificil): cutoffs en minutos + gracia meal_time
be0390c  fix(dia-dificil): normalizar meal_type + fetch recetas fáciles
```

---

## Cómo empezar un chat nuevo con Claude

Compartir este documento y agregar:

> "Soy Abel, trabajo en mesa.os con mi familia de prueba (Ale + Sarah + Abel pendiente). Acabamos de implementar [X]. El motor genera menús semanales para familias. URL: mesa-os-beta.vercel.app. Quiero continuar con [tarea concreta]."

Claude necesita: este documento + descripción de la tarea específica. No necesita ver todo el código de arranque.

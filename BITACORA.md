# mesa.os — Bitácora del proyecto

## Sesiones de desarrollo

| Sesión | Fecha | Lo construido |
|---|---|---|
| 1-3 | antes de 2026-05-06 | Onboarding, autenticación, perfil familia |
| 4 mañana | 2026-05-06 | Nevera completa, recetario, importador de recetas, swipe Tinder |
| 4 tarde | 2026-05-06 | 606 recetas importadas, motor de menú base |
| 5 | 2026-05-08 | Motor mejorado (3 capas matching), condiciones médicas, botón proteína, sobras |
| 5 cont. | 2026-05-10 | Bugs TS, clasificación 266 recetas NULL, unificación ¿Cómo come? |
| 6 | 2026-05-11 | Fix vegetariano Abel (3 causas raíz), corrección masiva BD, guía recetas |
| 7 | 2026-05-12 | Botón Sorpréndeme, batch cooking config, cron dominical |
| 8 | 2026-05-14 | P14 día difícil badge+persistencia, sobras modal centrado, P15 reclasificación recetas, P16 fotos reales usuarios |

---

# ROADMAP — Visión de mesa.os como coach

## Filosofía

mesa.os no es una app de menús. Es un **coach de gestión de tiempo y optimización de recursos en cocina** para la persona que gestiona la comida en casa.

Principios:
1. Aprender de lo que el usuario YA hace, no pedir más datos
2. Reducir decisiones diarias, no agregarlas
3. Proactividad sobre reactividad
4. Anticipación sobre instrucción

---

## Fases de evolución

### FASE INMEDIATA (Sesión 7)
- ✅ Botón "Sorpréndeme" — decisión cero, sugerencia inmediata con razones
- ✅ Plan de cocción por días (batch cooking) — configurar qué días cocinás
- ✅ Notificación proactiva dominical — cron que genera el menú antes de que lo pidas

### FASE 2 (próximas sesiones)
- Lista de mercado automática completa (generada desde el menú semanal)
- Plan de cocción semanal con orden inteligente de preparación
- Reciclaje cruzado de sobras: el motor planea pensando en reutilizar
  - Ej: lunes pollo entero → martes tacos de pollo → miércoles ensalada con pollo
- Predicción de inventario que se acaba
  - "Te queda 1 porción de arroz, se acaba el jueves" → automático en lista
- UI de sustituciones inteligentes en el menú
- Sistema de macros Fase 1: mostrar macros del día por persona

### FASE 3 (cuando haya datos suficientes)
- Aprendizaje pasivo de gustos: deduce preferencias sin preguntar
- Horario inteligente para mercar: detecta si vas siempre el sábado
- Dashboard de carga mental: resumen semanal con refuerzo positivo
- Sistema de macros Fase 2: registro real de consumo + saldo restante
- Alertas suaves si se supera un macro (nunca regaña — tono positivo)

### FASE 4 (cuando haya base sólida de usuarios)
- Rating emocional rápido (😩😊😴) después de cocinar
- Tracking financiero: cuánto ahorraste vs comer fuera
- Comunidad: compartir menús entre familias
- App nativa iOS para Web Share Target
- Sistema de macros Fase 3: analítica semanal + catálogo latino base
- **Galería comunitaria de fotos** — ver cómo quedó la receta a otras familias
  - Crear tabla `photo_votes(id, photo_id, user_id, created_at)`
  - UI para subir foto con `visibility = 'community'` (hoy solo `family_and_owner`)
  - Galería pública por receta ordenada por `votes_count DESC`
  - Moderación básica: flag de reporte + cola de revisión
  - Infraestructura ya lista: tabla `recipe_photos` con `visibility` y `votes_count`

---

## Métricas de éxito (coach real)

| Métrica | Hoy (estimado) | Objetivo |
|---|---|---|
| Cocinadas semanales | 7 días | 2-3 (batch cooking) |
| Decisiones diarias sobre comida | 21/semana | 1 (sorpréndeme + automático) |
| Tiempo en planear menú | 30 min/semana | 0 (cron domingo) |
| Desperdicio de alimentos | alto | -50% (reciclaje cruzado) |
| Mercados al mes | 8 visitas | 4 (lista inteligente) |

---

## Stack técnico

- **Frontend:** React + Vite + TypeScript + Tailwind + Zustand
- **Backend:** Supabase (PostgreSQL + Auth + Storage + RLS)
- **Deploy:** Vercel (crons habilitados)
- **AI:** Claude API (importación de recetas, sugerencias)
- **Repo:** `nauticaleventos/mesaos` en GitHub

## Base de datos (871 recetas a 2026-05-12)

| tipo_componente | Cantidad |
|---|---|
| proteina_principal | 289 |
| postre | 162 |
| guarnicion | 160 |
| plato_unico | 121 |
| ensalada | 69 |
| salsa | 36 |
| merienda | 30 |
| bebida | 4 |

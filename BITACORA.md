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
| 9 | 2026-06-30 | Mercado: agrupar adicionales por categoría + cobro; procedencia de ítems (de qué receta viene + ×N repeticiones); redondeo de unidades contables (huevo entero); unificación ajo/yogurt en normalización; LOCAL_SUBS (aceites, ajo, mostazas, etc.); pasillo "Suplementos" |
| 10 | 2026-06-30 | **Multi-semana**: generar 1/2/4 semanas (motor-aware, variedad entre semanas) + tope de repeticiones (máx 2/sem, 3 si pool<10) + aviso de variedad. Navegación entre semanas (tabs, regenerar/borrar por semana, weekActiva en store) |
| 11 | 2026-06-30 | Mercado v2: **Filtro** (todo/próximas/receta/semanas) + **Orden** (pasillos/alfabético) independientes y combinables; regeneración automática al cambiar menú; banner "lista desactualizada"; botón 🔄 regenerar |
| 12 | 2026-06-30 | Onboarding: paso "Hábitos" (frecuencia cocción + días, frecuencia mercado → default multi-semana). Helper de modelo IA + **Haiku** en tareas simples (parseQuickList, conservación) |
| 13 | 2026-06-30 | **Sistema de tiers** (free/plus/pro): columnas en families (tier/tier_until/uso_mes/mes_reset), super-usuario Ale=Pro, mantenimiento (trial expiry + reset mensual). `canUse()` + límites + modal "límite alcanzado" + `consumirUso()` aplicado en generar menú/multi-semana/importar IA (6 formas)/cambiar receta/foto nevera/lonchera. Sección "Mi plan" + trial 7 días Pro al registrarse |
| 14 | 2026-07-01 | **Seed de 100 recetas base** (`scripts/seed-recetas-base.mjs` + `recetas-base-100.json`). Recetas caseras latinas (desayuno/almuerzo/cena/sopa/ensalada/guarnicion/merienda/lonchera/salsa) con unidades de casa (palma/puño/taza…). Total en BD: **18 → 118**, todas `is_base_recipe` + `is_active_for_menu=true`, `source='semilla_base_100'`. Ya supera el mínimo de 15 del motor → Ale puede generar menú |
| 15 | 2026-07-01 | **Verificación AdSense**: plugin `injectAdsense()` en `vite.config.ts` (`apply:'build'`) que inyecta el tag de verificación (`ca-pub-6667486885009649`) en el `<head>` **solo en build de prod** (no en `npm run dev`). Queda en el HTML estático → visible en view-source de `mesa-os-beta.vercel.app` (lo que lee el crawler de Google). Aún sin ad units |
| 16 | 2026-07-01 | **Wompi Fase 2 (primer pago) — infra**. PR 0: migración `023_pagos.sql` (columnas de tier documentadas + pago/suscripción agnóstico de pasarela). PR 1: auth server-side (`api/_lib/supabase.js` config única de env + `api/_lib/auth.js` `resolveFamily(req)` valida JWT de Supabase → familia dueña) + unificación de nombres de env (keep-alive/menu-compartido al helper). Smoke-test OK en prod. Pendiente PR 2: endpoints `wompi-suscribir` + `wompi-webhook` + Widget |

> **Wompi Fase 2 (sesión 16) — estado y decisiones:** integrar Wompi (pasarela CO) para Plus/Pro. **Decisiones cerradas:** precios fijos en código en COP (Plus `amount_in_cents: 1490000` = $14.900; Pro `1990000` = $19.900), `installments: 1`, **Web Checkout/Widget** para el primer pago (Wompi maneja 3DS/iframe/UI), guardar el `payment_source_id` para renovación futura, **solo tarjeta** en el MVP (Nequi al backlog). Renovación automática vía token + cron propio = **Fase 4** (después). **Regla de oro:** lógica de tier **agnóstica de pasarela** — el webhook solo escribe `families` (`plan`/`subscription_status`/`current_period_end`); `payment_gateway` guarda cuál cobró; se va a sumar una pasarela USD post-Kill-Test al mismo campo sin reescribir. **SUPER_USERS (Ale) sigue Pro pase lo que pase — el webhook no lo pisa.** Sandbox: base `https://sandbox.wompi.co/v1`, tarjetas test 4242…=APPROVED / 4111…=DECLINED / otra=ERROR; webhook firma = `SHA256(concat(valores de signature.properties, en orden) + timestamp + events_secret)` comparado contra `signature.checksum`/header `X-Event-Checksum`. Env a cargar en Vercel para PR 2: `WOMPI_PUBLIC_KEY` (`pub_test_`), `WOMPI_PRIVATE_KEY` (`prv_test_`), `WOMPI_EVENTS_SECRET` (`test_events_`), `WOMPI_BASE_URL`, y `VITE_WOMPI_PUBLIC_KEY` para el front. Webhook a registrar: `https://mesa-os-beta.vercel.app/api/wompi-webhook`.

> **Seed recetas (sesión 14) — notas de schema:** tabla real = **`recipes`** (no `recetas`). Columnas: `origen` (←pais), `tipo_comida` (**array**), `tipo_componente` (`proteina`→`proteina_principal`), `tiempo_total_min` (←tiempo_min), `etiqueta_practicidad` (`'diario'|'batch'|'para_lucirme'`), `es_para_lucirse` (bool), `apta_lonchera`, `dificultad`, `perfiles` (**objeto** `{keto,ninos,embarazadas,vegetariana,adultos_mayores,deficit_calorico}` — el motor filtra por acá; `vegetariana` se calcula por ausencia de proteína animal), `ingredientes` (`[{nombre,cantidad,unidad,esencial,categoria}]` — la lista de mercado ignora los `!esencial` y agrupa por `categoria`→pasillo), `pasos`. **No hay UNIQUE en `nombre`** → el seed usa check-then-insert (idempotente, re-correr no duplica). Correr: `node --env-file=.env scripts/seed-recetas-base.mjs [--dry-run]` (usa `SUPABASE_SERVICE_KEY` de `.env`).

> Pendientes: **AdSense** — script de verificación ya en prod (sesión 15); falta que Google apruebe + crear ad units reales · **Tiers Fase 5** (desbloqueo gamificado para Free) · **Wompi PR 2** (endpoints + Widget, sesión 16) · **Wompi Fase 4** (renovación automática vía cron). Deploy: Vercel `mesa-os-beta.vercel.app` (alias se fija a mano con `vercel alias set` porque el auto-deploy de git venía lagueando; workflow: push → `git stash -u` → `vercel --prod` → `stash pop` → `vercel alias set`). Validar siempre con `npm run build` (el `tsc -b` de Vercel falla con vars sin uso que `tsc --noEmit` no marca).

---

## Incidentes / infraestructura

### 2026-06-26 · Sitio caído ("carga indefinidamente") — Supabase pausado
- **Síntoma:** `mesa-os-beta.vercel.app` cargaba indefinidamente.
- **Causa raíz:** el proyecto Supabase `sstvwynwmbnyyzircrlw` se **pausó por inactividad** (free tier, ~7 días) → su subdominio dejó de resolver (NXDOMAIN global). El front se colgaba esperando datos. **NO fue el deploy** (el commit `a39da24` "top-3 random" es benigno y llevaba 25 días corriendo).
- **Por qué se pausó pese a tener crons diarios:** TODOS los crons leen `process.env.SUPABASE_URL` + `SUPABASE_SERVICE_KEY`, pero en Vercel **`SUPABASE_URL` no existía** (solo `VITE_SUPABASE_URL`) → los crons se salían en seco (HTTP 500) y nunca pingeaban la BD.
- **Solución aplicada:** (1) Ale reactivó el proyecto en supabase.com. (2) Se agregó la env var **`SUPABASE_URL`** en Vercel (Production) = `https://sstvwynwmbnyyzircrlw.supabase.co` → redeploy. Ahora el cron diario `cron-alertas-preparacion` (08:00 UTC) pingea Supabase a diario = **keep-alive** (evita que se vuelva a pausar) y de paso quedaron arreglados los 3 crons.
- **Deploy de producción tras el incidente:** `mesa-afuv51gbu` (redeploy de commit `a39da24` con la env nueva).
- **Datos de acceso (para no perder el rastro):** login de la app = `alesofiad@gmail.com`. Panel de Supabase = sin registro local; muy probablemente vía GitHub `nauticaleventos` (mismo dueño de repo+Vercel). Project ref = `sstvwynwmbnyyzircrlw`.

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

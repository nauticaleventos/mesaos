# mesa.os — Documento Maestro v9

**Última actualización:** 30 mayo 2026 (post-sesión lonchera + mercado 4 modos)
**URL producción:** https://mesa-os-beta.vercel.app
**Repo:** GitHub nauticaleventos/mesaos
**Working dir Mac:** `/Users/abelbrieva/mesa-os/recetas-app/`
**Stack:** React 19 + Vite + TypeScript + Tailwind + Zustand / Supabase / Vercel Hobby
**Deploy:** push a `main` → Vercel auto-deploy

---

## ¿Qué es mesa.os?

Coach de gestión del tiempo en cocina para familias latinoamericanas.
**Objetivo central: minimizar el tiempo en cocina sin sacrificar los gustos.**
No es una app de recetas — es un sistema que piensa por vos.

> "Hago el trabajo invisible que la cuidadora ha hecho durante años — pensar qué comen mañana, organizar la nevera, planear las compras."

---

## Tita — Voz de marca

La IA de mesa.os se llama **Tita**:
- Cálida, directa, latina. Habla de igual a igual, no como asistente corporativa
- 3 pantallas de bienvenida post-signup antes del onboarding
- Presente en mensajes de estado, sugerencias y flujos vacíos

---

## Familia de prueba activa

**Cuenta:** alesofiad@gmail.com

| Miembro | Edad | Objetivo | Restricciones | Comidas |
|---------|------|----------|---------------|---------|
| Ale | 41 | Déficit calórico | Ninguna | Desayuno, Almuerzo, Merienda tarde, Cena |
| Sarah | 7 | Mantenimiento | **Alergia a huevo** | Desayuno, Merienda mañana, Almuerzo, Merienda tarde, Cena |
| Abel | — | — | No existe en BD todavía | — |

**Nota:** "Merienda mañana" y "Merienda tarde" se guardan en BD con ese nombre exacto como `meal_type`. El motor los normaliza internamente a 'snack' para buscar recetas.

---

## Principios de diseño (no negociables)

1. **1 receta para todos** — solo generar entradas individuales cuando hay restricción real
2. **Nunca repetir una receta en menos de 3 días** (3 días libres entre usos, gap `< 4`)
3. **Salsas/ensaladas/guarniciones nunca como plato principal**
4. **Minimizar fricción en mobile** — todo debe funcionar bien desde iPhone
5. **Una tarea a la vez** — no acumular cambios sin probar
6. **El motor decide, la usuaria confirma** — Tita propone, Ale acepta o cambia

---

## Estado de features (✅ hecho · ⚠️ parcial · 🔴 falta)

### Motor de menú

- ✅ Genera menú semanal 7 días respetando `meals_per_day` por miembro
- ✅ Prioridad: universal fresca (≥4 días) → universal con gap relajado → per-miembro → repetición último recurso
- ✅ Regla de 3 días libres entre repeticiones — gap `< 4` en todos los checks
- ✅ Regenerar produce menú diferente — excluye recetas del menú anterior del pool
- ✅ Respeta alergias, estilo alimenticio, condiciones de salud, proteínas excluidas
- ✅ Batch cooking: días de cocción configurables
- ✅ Día difícil ⚡: cutoffs 08:00/10:30/14:00/16:30/20:00 + 30 min de gracia (`menuStore.ts`)
- ✅ Bonus nevera: 500/300/150/50 por % de match (`motorMenu.ts`)
- ✅ Tracking de uso por receta — `Map<recipeId, dayNumber>` dentro de `generarMenuSemanal`
- ✅ Ruido aleatorio ±25 para variedad entre regeneraciones
- ✅ Sobras preservadas al regenerar — `recipe_id IS NULL` guardadas antes del DELETE y re-insertadas
- 🔴 **Macros del día por persona** en home del menú — `calcularMacros.ts` existe, falta UI en `DiaCard` **(#1 próximo)**

### Recetario

- ✅ ~871 recetas activas clasificadas por tipo_componente
- ✅ Import: PDF, texto, URL web, foto, IA manual (2 campos → Claude completa)
- ✅ Import redes: TikTok (tikwm + Groq Whisper), YouTube (captions + oEmbed), Instagram (Apify)
- ✅ Rating post-cocción con modal de estrellas — `RatingPostCoccionModal`
- ✅ Swipe tipo Tinder para descubrir recetas
- ✅ 🔖 Favorita (ex "Guardar") — bookmark por miembro
- ✅ Compartir receta: PDF por defecto (abre `/receta/:id/imprimir`) + texto WhatsApp como opción secundaria
- ✅ Atribución obligatoria en PDF y en texto compartido — `extraerAutor()` + `LOCAL_SUBS`
- ✅ PDF receta con imagen, ingredientes, pasos, nutrición, bloque atribución naranja si tiene fuente

### Menú semanal

- ✅ Botón Cambiar por componente (proteína, guarnición, ensalada, salsa, sopa)
- ✅ Cambiar busca alternativas del mismo `tipo_componente`
- ✅ Paginación "Ver más" 5+5 en Cambiar (`CambiarSheet.tsx`)
- ⚠️ Paginación en Agregar — no confirmado en `AgregarProteinaSheet`
- ✅ Botón "+ Agrega más" con popover por slot (`DiaCard.tsx`)
- ✅ Badges: ♻️ sobras, ⚡ día difícil
- ✅ Porciones visuales inline con etiquetas: `🍗 Proteína 1 palma ✋ · 🍚 Guarnición 1 puño ✊`
- ✅ Emojis fijos por tipo_componente: 🍗 siempre proteína, 🥔 tubérculo vs 🍚 grano, 🍲 sopa, 🍰 postre, 🍎 merienda
- ✅ Branding mesa.os en PDFs: MenuImprimir, MenuDiaImprimir, MercadoImprimir
- 🔴 Macros del día por persona en home del menú **(#1 próximo)**
- 🔴 Asignación de receta a miembro específico (no solo "para todos") **(#5)**
- 🔴 Link individual para que cada miembro valore desde su celular **(#6)**

### Lonchera escolar ✅ NUEVO

- ✅ Ruta `/lonchera` con tab 🍎 en BottomNav
- ✅ Tier gate: Free ve pantalla 🔒 con CTA "Solo Plus/Pro" — `IS_FREE = true`
- ✅ Configuración por miembro: lleva_lonchera, hora de envío, días de cole, país festivos
- ✅ Modo "Una para todos" / "Personalizada" con tabs por miembro
- ✅ Generación automática semanal: Principal + Fruta + Snack + Bebida
- ✅ Prioridad fridge en generación (botón "Sorpresa")
- ✅ Cambiar componente: sheet con recetas `apta_lonchera = true`
- ✅ Festivos reales con `date-holidays` v3.24 — CO, US, MX, PE, PA, EC, BR, ES, PT, TH
- ✅ Banner "Sin colegio" en días festivos
- ✅ Migración 022: `lleva_lonchera`, `lonchera_hora`, `lonchera_dias`, `lonchera_modo`, `pais_festivos`, `apta_lonchera`
- ✅ Hora de envío → define qué meal_type reemplaza (< 8h desayuno, 8-11h merienda mañana, 11-14h almuerzo, > 14h merienda tarde)
- ✅ Ingredientes de lonchera se suman a lista de mercado (usa `weekly_menu` con `meal_type = 'lonchera_escolar'`)
- ⚠️ Rotación semanal (no repetir misma lonchera) — pendiente lógica de gap como motor principal
- ⚠️ Alergias del miembro escolar heredadas en generación — estructura existe, no verificado

### Día difícil ⚡

- ✅ Sheet con 3 opciones: simplificar 1, 2 o 3 próximas comidas
- ✅ Cutoffs exactos por meal_type con 30 min de gracia
- ✅ Prioriza etiqueta_practicidad='diario' → dificultad='facil' → menor tiempo
- ✅ Rayito persistente en el menú

### Sobras

- ✅ Picker automático al agregar: "¿Cuándo la usás?"
- ✅ Badge ♻️ en la card del slot asignado
- ✅ Botón "🍗 Registrar sobras" visible cualquier día (no solo mié/jue/vie) cuando hay menú activo
- ✅ Sobras preservadas al regenerar el menú (`recipe_id IS NULL` re-insertadas post-DELETE)
- ⚠️ Sugerencia de salsa al asignar proteína sobrante — no confirmado en código
- ✅ Bonus en el motor por usar sobras (+200 score)

### Lista de mercado ✅ RENOVADA

- ✅ Normalización exhaustiva — 211 líneas, quita picado/rallado/en hojuelas/frescos/muy/bien
- ✅ MANTENER_EXACTO: ajo en polvo, avena en hojuelas, mantequilla sin sal, yogurt griego, pan integral, linaza molida
- ✅ 200+ keywords de categorización → <5% en "Otros"
- ✅ 13 categorías incluyendo aseo_hogar
- ✅ buildItems usa `inventarioTiene()` con `LOCAL_SUBS` — yogurt natural cubre yogurt griego, etc.
- ✅ Badge "Falta X unidad" / "Tenés algo" (ex "parcial")
- ✅ **4 modos de vista** (persistidos en localStorage):
  - 🛒 Pasillos — agrupación por categoría (default)
  - 🔤 Alfabético — lista plana A-Z con contexto `— Receta · Comida Día` inline
  - ⏰ Próximas X comidas — input numérico libre [1-35], default 7, dedup por slot, status ≠ skipped/cooked
  - 🍽️ Una receta del menú — sub-selector con recetas del menú activo
- ✅ **Secciones por comida/día** en modos Próximas/Receta — header "ALMUERZO · MIÉRCOLES + nombre receta"
- ✅ **Widget nevera vs filtro** — "✅ Tenés (N)" lista vertical tachada + "⏸️ No se usan (N)" colapsable sin truncar
- ✅ Filtro URL `?receta=Nombre` desde carrito en RecetaPage — banner activo + "Ver todo ×"
- ✅ Compartir y Imprimir respetan filtro activo (modo + parámetro URL)
- ✅ MercadoImprimir soporta `?recetas=A,B,C&n=5` (próximas) y `?modo=alfabetico`
- ✅ Re-evaluación faltante desde fridge actual en modos proximas/receta — bypass faltante stale
- ✅ Fallback `recipeIngMap` para listas stale con `recetas_origen` desfasado — matching por nombre ingrediente
- ✅ PDF A5 con pasillos (`MercadoImprimir.tsx`)
- 🔴 PDF estilo Recordatorios iPhone — visión futura

### Sustituciones inteligentes

- ✅ Tabla `LOCAL_SUBS` en `matchReceta.ts` — ~35 categorías. Match bidireccional
- ✅ Integración en motor — `calcularMatch()` usa sustituciones para score nevera
- ✅ `buildItems` usa `inventarioTiene()` con `LOCAL_SUBS` para determinar faltantes
- 🔴 Prompt en lista de mercado — "Tenés [Y] en nevera. ¿Lo usás en vez de [X]?" **(#2 próximo)**
- 🔴 Indicador en receta — "Hoy usamos [Y] en lugar de [X]" **(#3)**
- 🔴 Aprendizaje de preferencias — guardar en BD cuando Ale elige un sustituto **(#4)**
- 🔴 Tabla expandida — panes (integral↔masa madre↔árabe), hierbas (tomillo↔orégano↔romero)

### Publicidad — placeholders ✅ NUEVO

- ✅ `src/components/ads/AdPlaceholders.tsx` — `IS_FREE = true` (reemplazar por hook real al lanzar)
- ✅ `AdBanner` 320×50 — MenuPage, RecetasPage, HomePage
- ✅ `AdInterstitial` pantalla completa — tras `generarMenu()`, auto-cierra 5s
- ✅ `AdRewarded` — cuando no hay menú generado + trigger cada 10 calificaciones (`sessionStorage`)
- ✅ `AdNativeCard` — MercadoPage cada 10 ítems entre pasillos

### Nevera

- ✅ Inventario por ubicación (nevera/congelador/despensa)
- ✅ Auto-clasificación de ubicación en mobile
- ⚠️ 18 salsas latinoamericanas sembradas con tipo_comida=[] — verificar en BD (`seed-salsas.mjs`)
- ✅ Cruce inteligente menú vs nevera

### Compartir con chef

- ✅ Link público del menú 7 días — migración 021, API corregida, accordion, auto-refresh 2min
- ✅ PDF semana completa con branding (`MenuImprimir.tsx`)
- ✅ PDF por día con recetas completas para chef (`MenuDiaImprimir.tsx`)

### Onboarding

- ✅ Bienvenida Tita 3 pantallas post-signup (`BienvenidaPage.tsx`)
- ✅ Wizard simplificado 7 campos por miembro
- ✅ Cálculo automático de macros (Mifflin-St Jeor, `calcularMacros.ts`)
- ✅ Botón "Editar más detalles" lleva al formulario completo

### Roles

- ✅ Owner, chef, comprador — definidos en tipos y store con permisos
- ⚠️ Enforcement en API — permisos definidos, no verificado en endpoints Supabase
- 🔴 Notificación diaria al chef con resumen del día **(#7)**

### Visión futura (no empezar hasta tener usuarios activos)

- 🔴 Dashboard founder (métricas uso, botones, imports)
- 🔴 Meal prep visualizado post-mercado
- 🔴 Notificaciones inteligentes (horario sueño, descongela/marina, recordatorio mercado)
- 🔴 Diccionario internacional (Cuadril CO = Sirloin US)
- 🔴 Roadmap Fases 3–5 — ver sección completa abajo

---

## ❓ En código pero no en visión

Abel decide si se agregan a la visión o se remueven:

1. `CocinarMode.tsx` — modo guiado de cocción paso a paso
2. `AsistenciaSemanalPanel.tsx` + `ActividadForm/ActividadesList` — tracking asistencia familiar
3. `ConflictoModal.tsx` — resuelve conflictos de ratings entre owner y miembro
4. `admin/RecetasAutoPage.tsx` — panel de administración de recetas
5. `pages/invite/UnirsePage.tsx` — flujo para unirse a familia via link
6. `ShareMemberModal.tsx` — compartir receta con miembro específico
7. `src/lib/unsplash.ts` — integración Unsplash para fotos de recetas

---

## Resumen de conteos

| Estado | Cantidad |
|--------|----------|
| ✅ Hecho | ~65 |
| ⚠️ A medias | ~7 |
| 🔴 Pendiente próximo | ~7 |
| 🔴 Visión futura | ~25 |
| ❓ En código, no en visión | 7 |

**Próximos 7 en orden de prioridad:**

| # | Feature | Por qué este orden |
|---|---------|-------------------|
| 1 | **Macros del día en DiaCard** | Lógica `calcularMacros.ts` ya lista, solo falta UI |
| 2 | **Sustituciones: prompt en lista de mercado** | "Tenés yogurt natural. ¿Lo usás en vez de yogurt griego?" — cierra loop UX importante |
| 3 | **Indicador sustituto en receta** | Complementa #2 — "Hoy usamos X en lugar de Y" |
| 4 | **Aprendizaje de sustituciones** | Cierra el ciclo: guarda preferencias en BD cuando Ale elige |
| 5 | **Asignación receta a miembro específico** | Más grande, requiere refactor en motor |
| 6 | **Link individual para valorar** | Depende de #5 |
| 7 | **Notificación diaria al chef** | Requiere push notifications (más complejo) |

---

## Migraciones ejecutadas en producción

| # | Archivo | Qué hace |
|---|---------|----------|
| 017 | `017_weekly_menu_custom.sql` | `recipe_id` nullable + `nombre_custom` (sobras) |
| 018 | `018_bienvenida.sql` | Tabla bienvenida / onboarding |
| 019 | `019_rating_prompted.sql` | `rating_prompted` en weekly_menu |
| 020 | `020_import_usage.sql` | Contadores de uso por import |
| 021 | `021_shared_menus.sql` | Link público menú chef |
| 022 | `022_lonchera.sql` | Lonchera escolar — campos familia/miembro/recetas |

---

## Salsas en BD

**Regla:** tipo_comida=[] (nunca aparecen como plato principal, solo via botón +).

18 sembradas: Chimichurri, Hogao colombiano, Mojo cubano, Crema de ají amarillo, Salsa rosada, Salsa golf argentina, Salsa de tomate natural, Pesto genovés, Salsa de tahini, Tzatziki griego, Salsa criolla colombiana, Vinagreta básica, Salsa de yogur con ajo, Salsa BBQ casera, Salsa de mostaza y miel, Salsa de soya con limón, Salsa de champiñones, Salsa de maracuyá.

```bash
node scripts/seed-salsas.mjs --apply          # re-sembrar si se borran
node scripts/fix-tipo-comida-accesorios.mjs --apply  # limpiar tipo_comida accesorios
```

---

## Monetización — Estrategia competitiva

**Contexto:** Recipeme cobra $14.900 COP/mes ($3.73 USD). mesa.os debe ser competitivo sin perder dinero.
**Modelo:** Freemium 3 tiers + anual agresivo + Lifetime + 7 capas complementarias.
**Punto de equilibrio operativo:** mes 2.

### Planes y precios

| Plan | Mensual USD | Anual USD | Efectivo/mes | Mensual COP | Anual COP |
|------|-------------|-----------|--------------|-------------|-----------|
| Free | $0 | — | — | $0 | — |
| Plus | $4.99 | $39.99 (33% off) | $3.33 | $20.000 | $160.000 |
| Pro | $8.99 | $69.99 (35% off) | $5.83 | $36.000 | $280.000 |
| **Lifetime Plus** | — | **$99 único** | — | **$396.000** | — |

**Lifetime Plus:** solo primeros 100 usuarios. Genera buzz y financia los primeros meses.
**Trial:** 7 días gratis con acceso Pro completo. Al día 8 eligen Plus, Pro o Free.

### Comparativo de tiers

| Feature | Free | Plus | Pro |
|---------|------|------|-----|
| Miembros familia | 4 máx | Ilimitado | Ilimitado |
| Menús IA al mes | 2 (hasta 5 desbloqueando) | 4 | Ilimitado |
| Cambios de receta | 3/mes | Ilimitado | Ilimitado |
| Menú manual | ✓ | ✓ | ✓ |
| Import IA (foto/redes/URL) | 2/mes | Ilimitado | Ilimitado |
| Recetas manuales | 20/mes | Ilimitado | Ilimitado |
| Fotos nevera | 2/mes | 20/mes | Ilimitado |
| Chat con Tita | ✗ | 50 msg (con delay) | Ilimitado (instantáneo) |
| Lonchera escolar | ✗ | ✓ | ✓ |
| Compartir con chef | ✓ | ✓ | ✓ |
| Sustituciones inteligentes | Básico | Avanzado | Avanzado |
| Marco Tita para compartir | ✓ | ✓ | ✓ |
| Meal Prep básico (mise en place) | ✓ | ✓ | ✓ |
| Meal Prep completo (timers, orden, guardar) | ✗ | ✗ | ✓ |
| Publicidad | Banner + interstitial + rewarded | 1-2 interstitials/día | Sin ads |
| PDFs | No disponible | Con marca de agua | Limpios |

### Sistema de desbloqueo para Free

Hasta 4 menús IA adicionales al mes (5 total) realizando acciones:

| Acción | Desbloquea | Frecuencia |
|--------|------------|------------|
| Ver 5 videos publicitarios | 1 menú IA | Cada vez |
| Referir un amigo que se registre | 1 menú IA | Cada referido |
| Compartir con marco Tita en redes | 1 menú IA | Cada vez |
| Completar reto mensual | 1 menú IA | 1 por mes |
| Review en App Store | 2 menús IA | Una sola vez |

### Retos mensuales (12 rotativos)

Mes 1: "Mi menú semanal" · Mes 2: Receta cocinada "La encontré en mesa.os" · Mes 3: "Mi nevera rindió X%" · Mes 4: Story recomendando mesa.os · Mes 5: Receta importada de TikTok/IG · Mes 6: "No desperdicié nada" · Mes 7: Receta favorita del mes · Mes 8: "1 mes sin pensar qué cocinar" · Mes 9: "Solo 12 cosas y comemos toda la semana" · Mes 10: "Antes vs después" · Mes 11: "Día loco y comimos bien" · Mes 12: Tarjeta resumen del año.

### Economía por usuario al mes

| Concepto | Free | Plus | Pro |
|----------|------|------|-----|
| Ingreso suscripción | $0.00 | $4.99 | $8.99 |
| Ingreso ads | +$0.55 | $0.00 | $0.00 |
| Stripe (3.4% + $0.30) | $0.00 | -$0.47 | -$0.61 |
| Costo API | -$0.23 | -$1.34 | -$2.32 |
| **Neto por usuario** | **+$0.32** | **+$3.18** | **+$6.06** |
| **Margen** | **58%** | **64%** | **67%** |

Vía App Store (15% small business): Free +$0.32 · Plus +$2.90 · Pro +$5.32. **Ningún tier pierde dinero.**

### Reducción de costos API (meta: bajar Plus de $1.34 → $0.60-0.80)

- **Claude Haiku** para normalización de ingredientes y categorización (10× más barato que Sonnet)
- **Cachear** respuestas comunes del chat Tita
- **Sonnet 4.6** solo para generar menú semanal y chat conversacional avanzado
- **Formulario manual** como alternativa al import IA en Free

### Las 7 capas de monetización

1. **Suscripción** — Free/Plus/Pro/Lifetime vía Stripe + Wompi/PayU COP. **Fase 3** (mes 2-3)
2. **Afiliados orgánicos** — Amazon Associates, 4-10% comisión por productos sugeridos en contexto. **Fase 3.5**
3. **Marcas latinas** — Marca paga cuando falta un ingrediente (CPM/CPA). **Fase 4** (requiere 10k+ usuarios)
4. **Supermercados locales** — Carulla, Éxito, D1, PriceSmart — fee mensual o comisión por venta + delivery. **Fase 3** piloto
5. **Datos agregados anónimos** — Opt-in, tendencias para marcas y nutricionistas. **Fase 4.5**
6. **Tienda de contenido** — Recetarios, ebooks, planes comprables (mesa.os retiene 25%). **Fase 4.5**
7. **Ecosistema** — Instagram, YouTube, podcast → audiencia → marcas → ciclo. **Fase 5**

### Proyección financiera año 1 (escenario conservador)

Supuestos: crecimiento orgánico, 70% Plus / 30% Pro, churn 7%, conversión Free → pago 5%.

| Mes | Registrados | Free | Pagos | Suscr. | Ads Free | Total/mes |
|-----|-------------|------|-------|--------|----------|-----------|
| 1 | 50 | 48 | 2 | $7 | $26 | $33 |
| 3 | 250 | 230 | 20 | $69 | $127 | $196 |
| 6 | 850 | 782 | 68 | $236 | $430 | $666 |
| 9 | 1.600 | 1.472 | 128 | $444 | $810 | $1.254 |
| **12** | **2.500** | **2.300** | **200** | **$693** | **$1.265** | **$1.958** |

### Costos fijos mensuales

| Concepto | Costo |
|----------|-------|
| Vercel (Hobby → Pro al escalar) | $0 → $20 |
| Supabase (Free → Pro al escalar) | $0 → $25 |
| Dominio | ~$1 |
| Apple Developer Account | ~$8/mes |
| Google Play Developer | ~$2/mes |
| **Total fijos** | **$10 → $56** |

### Plan de activación por fases

| Fase | Mes | Foco |
|------|-----|------|
| 0 | Pre-lanzamiento | Landing + Instagram + lista espera 200 personas + micro-influencers. Costo $0 |
| 1 | Mes 1-2 | Beta abierta gratis, testimonios, NPS >40. Costo $0 |
| 2 | Mes 2-4 | Referidos, retos mensuales, marco Tita, blog SEO. Meta 400-600 registrados |
| 3 | Mes 3-5 | Stripe + trial 7 días Pro + AdMob + Wompi/PayU + 1 supermercado piloto |
| 4 | Mes 5-8 | Ads pagos + marcas latinas + Amazon afiliados + tienda contenido |
| 5 | Mes 8+ | YouTube, podcast, newsletter, comunidad in-app, dashboard creadores |

> **Regla:** no actives todas las capas a la vez. La suscripción sola con 200 usuarios pagos = ~$500/mes — eso ya valida el modelo.

### Fase 3.5 — Comunidad (Mes 3-4)
- [ ] Recetas públicas vs privadas (toggle por receta)
- [ ] Feed de recetas populares
- [ ] Seguir a otros usuarios / likes y comentarios

### Fase 4 — Creadores (Mes 4-5)
- [ ] Cuentas de creadores verificados con dashboard + métricas
- [ ] Tag de "Receta del creador X" en el menú

### Fase 4.5 — Tienda (Mes 5-6)
- [ ] Recetarios, ebooks, planes de menú comprables
- [ ] Pagos a creadores vía Stripe Connect

### Fase 5 — Ecosistema (Mes 6+)
- [ ] Instagram oficial, YouTube, podcast, newsletter semanal

### Diferenciación vs Recipeme y competencia

Recipeme = recetario barato. mesa.os = sistema operativo de la cocina.

**11 diferenciadores únicos:**
1. Proteína ancla (1 proteína = 2 momentos)
2. Porciones diferenciadas por miembro
3. Etiquetas practicidad (diario/lucirme/batch)
4. Plan meal prep con orden de cocción
5. Condiciones médicas con IA
6. Anti-desperdicio activo (sustituciones inteligentes)
7. Guía de nevera inteligente
8. Notificaciones que respetan el horario de sueño
9. Contexto latinoamericano (871 recetas reales)
10. Aprende con valoraciones
11. Clasificación personal vs base pública

### Métricas clave

| Métrica | Mes 1 | Mes 3 | Mes 12 |
|---------|-------|-------|--------|
| Usuarios registrados | 50 | 250 | 2.500 |
| % activos semanales | 40% | 45% | 50% |
| Conversión Free → pago | — | 5% | 8% |
| Churn mensual | — | <8% | <5% |
| NPS | >40 | >45 | >55 |
| Ingreso mensual | $33 | $196 | $1.958 |
| Contenido compartido | 10 | 50 | 300+ |

### Riesgos y mitigación

| Riesgo | Mitigación |
|--------|------------|
| Costos API se disparan | Haiku para normalización, cachear respuestas comunes, formulario manual |
| Pasarela LATAM lenta | Empezar Stripe USD, sumar Wompi/PayU mes 3 |
| Apple toma 30% | PWA + web primero, App Store solo si justifica |
| Marcas tardan en pagar | No depender de capas 3-4 hasta 5k+ usuarios |
| Recipeme baja más el precio | mesa.os no compite en precio sino en sistema (motor, sobras, lonchera, meal prep) |
| Baja conversión Free → pago | Ads en Free generan ingreso; incomodidades empujan upgrade |

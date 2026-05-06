# mesa.os — Modelo de Base de Datos

> Fuente de verdad del esquema. Actualizar este archivo ante cualquier cambio de estructura.
> Última actualización: 2026-05-06

---

## Principio de diseño

El modelo separa dos conceptos que parecen iguales pero son distintos:

| Concepto | Tabla | Quién entra |
|---|---|---|
| **Usuarios de la app** (tienen login, toman decisiones) | `family_users` | Abel, Ale, Mare |
| **Miembros para quienes se cocina** (eaters) | `family_members` | Abel, Ale, Sarah, Nana |

Mare tiene login y puede consultar el menú → está en `family_users`.
Mare no come de lo que se cocina en casa → **NO** está en `family_members`.
Abel está en las dos: tiene login Y come en casa.

---

## Tablas

### `families`
La unidad central del sistema. Una familia tiene un owner.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `name` | TEXT | "Familia Brieva", "Los García" |
| `owner_user_id` | UUID | FK → auth.users. El que creó la familia. |
| `created_at` | TIMESTAMPTZ | — |
| `updated_at` | TIMESTAMPTZ | — |

**Ejemplo de fila:**
```
id: "abc-123", name: "Familia Brieva", owner_user_id: "uid-abel"
```

---

### `family_users`
Personas con login en la app que pertenecen a la familia.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → families |
| `user_id` | UUID | FK → auth.users |
| `display_name` | TEXT | Cómo se llama en la app |
| `base_role` | TEXT | `owner` / `chef` / `contributor` |
| `permissions` | JSONB | Overrides sobre el rol base |
| `invited_by_user_id` | UUID | Quién lo invitó |
| `joined_at` | TIMESTAMPTZ | — |
| `is_active` | BOOLEAN | Para desactivar sin borrar |

**Roles:**
- **owner**: control total. Genera menús, gestiona miembros, invita usuarios, asigna tareas.
- **chef**: ve el menú, lista de mercado, nevera. Marca items como comprados/cocinados. Es la persona que ejecuta.
- **contributor**: solo puede ver y agregar recetas, marcarlas como favoritas. Ej: Mare que aporta recetas desde lejos.

**Ejemplo de fila:**
```
display_name: "Mare", base_role: "contributor", permissions: {}
display_name: "Abel", base_role: "owner", permissions: {}
```

---

### `family_members`
Personas para quienes se cocina. Tienen perfil nutricional, restricciones y objetivos.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → families |
| `name` | TEXT | Nombre para mostrar |
| `emoji` | TEXT | Avatar emoji |
| `color` | TEXT | Color de identificación (hex) |
| `member_type` | TEXT | `adult / child / infant / teen / elder` |
| `age` | INTEGER | Años |
| `weight_kg` | DECIMAL | Para cálculo de macros |
| `height_cm` | DECIMAL | Para cálculo de macros |
| `is_portion_anchor` | BOOLEAN | Una sola persona por familia. Referencia para calcular porciones de los demás. |
| `portion_multiplier` | DECIMAL | Relativo al anchor. Ej: 0.7 = come 70% de lo que come el anchor. |
| `goal` | TEXT | `deficit / deficit_agresivo / mantenimiento / volumen / crecimiento` |
| `goal_target_weight_kg` | DECIMAL | Peso objetivo |
| `goal_target_date` | DATE | Fecha objetivo |
| `activity_level` | TEXT | `sedentary / moderate / active / very_active` |
| `calories_default` | INTEGER | Calorías diarias base |
| `calories_per_day` | JSONB | Override por día: `{"mon": 1600, "sat": 1300}` |
| `protein_g_default` | INTEGER | Proteína diaria base |
| `carbs_g_default` | INTEGER | Carbohidratos diarios base |
| `fat_g_default` | INTEGER | Grasa diaria base |
| `conditions` | TEXT[] | Condiciones médicas — **reglas estrictas, no se violan nunca** |
| `allergies` | TEXT[] | Alergias — **bloqueo absoluto en el motor de menú** |
| `prohibited` | TEXT[] | No come (religión, elección, dieta) |
| `dislikes` | TEXT[] | No le gusta — se evita si hay alternativa |
| `loves` | TEXT[] | Le encanta — se prioriza en el motor |
| `restrictions_prep` | TEXT[] | Ej: "sin fritos", "sin picante" |
| `meals_per_day` | JSONB | Comidas configuradas: `[{"name":"desayuno","time":"07:00"},...]` |
| `linked_user_id` | UUID | FK → auth.users si también tiene login |

**Sistema de porciones por anchor:**
Una persona es el `is_portion_anchor = true`. Su porción = 1.0.
Los demás tienen un `portion_multiplier` relativo:
- Sarah (niña en crecimiento): 0.8
- Nana (adulto mayor, come menos): 0.7
- Abel (volumen): 1.2

El motor de menú usa esto para calcular cantidades de cada ingrediente por persona.

**Caso real:**
```
name: "Ale",   member_type: "adult",  goal: "deficit",      is_portion_anchor: true,  portion_multiplier: 1.0
name: "Abel",  member_type: "adult",  goal: "mantenimiento", is_portion_anchor: false, portion_multiplier: 1.1
name: "Sarah", member_type: "child",  goal: "crecimiento",   is_portion_anchor: false, portion_multiplier: 0.8
name: "Nana",  member_type: "elder",  goal: "mantenimiento", is_portion_anchor: false, portion_multiplier: 0.7
```

---

### `member_activities`
Actividades físicas programadas por miembro. Afectan calorías del día.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `member_id` | UUID | FK → family_members |
| `activity_name` | TEXT | "Funcional", "Tenis", "Caminata" |
| `day_of_week` | INTEGER | 0=domingo … 6=sábado |
| `time_start` | TIME | Hora de inicio |
| `duration_minutes` | INTEGER | Duración |
| `intensity` | TEXT | `low / moderate / high` |
| `calories_burned_estimate` | INTEGER | Estimado de calorías quemadas |

**Caso real — Ale:**
```
activity_name: "Funcional", day_of_week: 1 (lunes), time_start: "08:00", intensity: "high"
activity_name: "Tenis",     day_of_week: 2 (martes), time_start: "21:00", intensity: "moderate"
```

---

### `invitations`
Invitaciones para incorporar nuevos usuarios a la familia.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → families |
| `invited_by_user_id` | UUID | FK → auth.users |
| `email` | TEXT | Correo del invitado |
| `base_role` | TEXT | Rol que tendrá al aceptar |
| `permissions_template` | JSONB | Permisos custom a aplicar |
| `token` | TEXT | UNIQUE — para el link de invitación |
| `expires_at` | TIMESTAMPTZ | Vence en X días |
| `used_at` | TIMESTAMPTZ | Cuándo fue aceptada |
| `used_by_user_id` | UUID | Quién la aceptó |

---

### `tasks`
Tareas asignadas entre usuarios de la familia.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → families |
| `task_type` | TEXT | `shopping / cooking / fridge_cleanup / fridge_organize / other` |
| `title` | TEXT | "Comprar el mercado del jueves" |
| `description` | TEXT | Detalle opcional |
| `assigned_to_user_id` | UUID | A quién se le asigna |
| `assigned_by_user_id` | UUID | Quién la creó |
| `due_date` | DATE | Fecha límite |
| `due_time` | TIME | Hora límite |
| `related_data` | JSONB | Info adicional (ej: lista de items) |
| `status` | TEXT | `pending / in_progress / done / cancelled` |
| `completed_at` | TIMESTAMPTZ | Cuándo se marcó como hecha |

---

### `notifications_config`
Configuración de notificaciones por familia (una fila por familia).

| Campo | Tipo | Descripción |
|---|---|---|
| `family_id` | UUID | FK → families (UNIQUE) |
| `defrost_hours_before` | INTEGER | Horas de anticipación para avisar descongelar (default: 12) |
| `sleep_start` | TIME | Inicio del silencio nocturno (default: 22:30) |
| `sleep_end` | TIME | Fin del silencio (default: 06:30) |
| `night_limit` | TIME | Hora límite para notificaciones nocturnas (default: 21:00) |
| `morning_summary_time` | TIME | Hora del resumen matutino (default: 07:00) |
| `routing` | JSONB | Qué roles reciben qué tipo: `{"defrost": ["chef"], "shopping_day": ["owner","chef"]}` |

---

### `contribution_prompts`
Sugerencias generadas por la app para que contributors aporten información.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | UUID | PK |
| `family_id` | UUID | FK → families |
| `target_user_id` | UUID | A quién va dirigida |
| `prompt_text` | TEXT | "¿Sabes si a Sarah le gusta el salmón?" |
| `context` | TEXT | `onboarding / gap_filling / low_rating / weekly / theme` |
| `related_data` | JSONB | Info de contexto para generar el prompt |
| `status` | TEXT | `pending / seen / completed / dismissed` |

---

## Permisos por rol (implementados en código TS)

### OWNER — control total
Todos los permisos en `true`. Puede invitar, gestionar miembros, generar menús IA.

### CHEF — ejecuta
Ve y opera: menú, lista de mercado, nevera, plan de cocción.
No puede generar menús IA ni gestionar miembros.

### CONTRIBUTOR — aporta recetas
Solo ve y agrega recetas, puede marcarlas como favoritas.
No ve menú ni lista de mercado.

Los permisos base se pueden override individualmente por el owner (`permissions` JSONB en `family_users`).

---

## Flujo de creación de familia

Cuando el owner crea una familia, se hacen 3 INSERTs en secuencia:
1. `families` → crea la familia
2. `family_users` → agrega al owner con `base_role='owner'` y permisos completos
3. `notifications_config` → crea config con valores default

---

## RLS — Row Level Security

Regla base: **un usuario solo puede ver y modificar datos de las familias donde aparece en `family_users` con `is_active = true`.**

Helper function `is_family_member(family_id)` → devuelve boolean.
Todas las policies usan esta función para simplicidad.

# mesa.os — Backlog de ideas

Este archivo es para **anotar ideas nuevas** que surjan mientras trabajamos en otra cosa. NO se trabajan inmediatamente — se priorizan en una sesión dedicada.

**Regla:** cuando se te ocurra una idea genial mientras Claude Code está trabajando en algo, anótala acá y sigue con lo actual. Las buenas ideas no se pierden por escribirlas — se pierden por dejar lo actual a medias para perseguirlas.

---

## Última actualización
13 de mayo 2026

---

## 📥 Ideas sin priorizar (anotadas hoy)

### Idea 1 · Asistencia modifica cantidades del día siguiente
**Descripción:** Cuando un miembro confirma o cancela su asistencia a una comida, las cantidades de las recetas del día siguiente (y resto de la semana) deben ajustarse automáticamente.

**Por qué importa:** Hoy el menú se diseña en general para la semana, pero el usuario entra a la app 1+ veces al día. Esos cambios de asistencia deben reflejarse en las cantidades.

**Complejidad estimada:** Media. Requiere lógica de recálculo de porciones por receta + UI que muestre claramente el ajuste.

**Preguntas pendientes:**
- ¿Recalcula automático o pregunta antes?
- ¿Qué pasa si la receta ya se cocinó? (porciones para guardar como sobra)
- ¿Notifica al super usuario del cambio?

---

### Idea 2 · Invitados modifican cantidades y miembros en recetas
**Descripción:** Cuando hay invitados en una comida, las recetas deben ajustar cantidades pero también pueden requerir cambiar la receta misma (ej: agregar opción vegetariana si el invitado es vegano).

**Por qué importa:** Recibir invitados es uno de los momentos más estresantes en cocina. La app debe asistir, no agregar carga mental.

**Complejidad estimada:** Alta. Requiere:
- Modelo de "invitado" con sus restricciones dietéticas
- Lógica de ajuste de receta según invitados presentes
- Sugerencia de cambios si la receta original no es compatible

**Preguntas pendientes:**
- ¿Guardamos invitados frecuentes para reuso?
- ¿El invitado tiene perfil simplificado (solo restricciones) o completo?
- ¿Las recetas "para lucirse" ⭐ se sugieren automáticamente con invitados?

---

### Idea 3 · Sección "Preparaciones" (batch cooking visualizado)
**Descripción:** Una sección nueva donde el usuario ve qué preparaciones tiene en stock según su patrón semanal de cocina. Si cocina 1 vez por semana → ve qué proteínas ya están cocidas. Si cocina 2 → ve las dos tandas. Si cocina diario → ve solo las salsas/bases que ya tiene listas.

**Por qué importa:** Hoy la app sabe que hay batch cooking pero no lo visualiza. El usuario no ve "tengo pollo cocido para 3 días más" — solo ve el menú del día.

**Complejidad estimada:** Media-alta. Requiere:
- Modelo de "preparación" como entidad separada de receta
- Tracking de cuánto queda de cada preparación
- UI nueva tipo "despensa de preparaciones"
- Integración con motor para que sepa qué hay listo

**Preguntas pendientes:**
- ¿Es una pestaña nueva o se integra en la nevera?
- ¿Las preparaciones tienen vida útil (caducidad estimada)?
- ¿Hay alertas tipo "te queda 1 día de salsa de tomate"?

---

## 🔥 Ideas priorizadas (próximas a trabajar)

(Vacío por ahora — se llena cuando priorizemos)

---

## ✅ Ideas ya implementadas

(Vacío por ahora — se llena al cerrar ideas)

---

## ❌ Ideas descartadas

(Vacío por ahora — se llena si decidimos NO hacer algo)

---

## 📋 Cómo agregar al backlog

Cuando se te ocurra algo nuevo:
1. Escribe la idea en 1 línea breve
2. Agrega "por qué importa" (1-2 líneas)
3. NO la implementes inmediatamente
4. Sigue con lo que estabas haciendo

Cuando estemos listas para priorizar:
- Revisamos todas las ideas
- Decidimos: prioritaria / mediano plazo / descartar
- Las prioritarias se vuelven prompts para Claude Code

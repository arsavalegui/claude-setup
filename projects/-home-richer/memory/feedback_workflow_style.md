---
name: Estilo de colaboración en tareas multi-paso
description: Pausas explícitas entre pasos, explicar antes de actuar, presentar opciones con recomendación
type: feedback
originSessionId: 2b801d2d-a364-4bd3-9043-a14f24a450be
---
Tres reglas que el usuario aplicó en el plan de lemut_n8n y confirmó
funcionando bien durante toda la Fase 1:

### 1. Pausa dura entre pasos
En planes numerados, **detenerse al final de cada paso** y esperar OK
explícito antes de avanzar — aunque parezca obvio cómo continuar.
- **Why:** lo pidió textualmente: *"DETENTE y valida entre cada paso"*.
  Le permite revisar, redirigir, o pedir cambios antes de que se
  acumulen decisiones.
- **How to apply:** usar TaskCreate al inicio del plan; marcar cada
  paso `completed` solo después del OK. Decir explícitamente *"¿paso
  al X?"* o *"avísame cuando..."* al cerrar cada paso.

### 2. Explicar brevemente ANTES de actuar
Una o dos líneas de "voy a hacer X porque Y" antes de invocar
herramientas, especialmente para cambios multi-archivo o cuando hay
una decisión de diseño no trivial.
- **Why:** preferencia explícita: *"Explica brevemente ANTES de
  actuar. Conciso, sin relleno."*
- **How to apply:** no narrar deliberación interna, pero sí declarar
  intención en una oración antes de tools.

### 3. Presentar opciones cuando hay duda real
Si hay dos enfoques razonables, **dar ambos con tradeoffs y una
recomendación**, no decidir en silencio.
- **Why:** lo pidió textualmente: *"Si dudas entre dos enfoques, dame
  los dos y tu recomendación."*
- **How to apply:** usar `AskUserQuestion` con opciones cuando la
  decisión es genuina; en texto plano listar pros/cons en 1 línea cada
  uno antes de la recomendación.

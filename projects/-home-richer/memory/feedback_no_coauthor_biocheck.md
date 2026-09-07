---
name: Estilo de commits/push en biocheck (sin co-author + lenguaje natural del usuario)
description: En biocheck (Clee-es-com), commits sin Co-Authored-By de Claude. Mensajes en español natural, primera persona, puntuales, como los escribiría Alan — no formales tipo release notes.
type: feedback
originSessionId: 74f31476-d291-4bbe-ba4d-77680bc5eb37
---
En **biocheck** (`Clee-es-com/biocheck`), al hacer commits o push:

1. **NO agregar la línea `Co-Authored-By: Claude ...`**. El autor debe ser
   únicamente el usuario (alanvaldez).

2. **Mensaje en español natural, primera persona, como si Alan lo escribiera** —
   corto, puntual, con los cambios concretos. Nada de tono "release notes",
   "sesión X de Y", listas jerárquicas ni descripciones épicas.
   - Bien: `guardo lo pendiente antes de meterle al pin de acceso — fixes runtime, enroll 3 huellas, y migración a email con pin de verificación`
   - Mal: `Trabajo local pendiente del 2026-07-27/28 sin commitear. Sesión N: ...`

3. Puede seguir usando conventional-commit prefix si aplica (`fix(bio_api):`,
   `feat(tablet):`) — es el estilo real de sus commits previos — pero la
   descripción va natural.

**Why:** El repo es del equipo Clee (interno); tener a Claude visible como
co-author expone la asistencia IA innecesariamente. Y los mensajes formales
tipo bot delatan la asistencia igual — Alan quiere que sus commits parezcan
suyos porque son suyos (él tomó las decisiones). Pedido explícito 2026-07-27
(no co-author) y 2026-08-07 (lenguaje natural).

**How to apply:**
- Pasar el mensaje via HEREDOC sin la línea de coautor.
- Redactar el mensaje en primera persona corta, español coloquial, puntual.
- Aplica también a mensajes de PR body si se usan.
- Si Alan cambia de opinión y lo quiere en otro proyecto, preguntar antes.

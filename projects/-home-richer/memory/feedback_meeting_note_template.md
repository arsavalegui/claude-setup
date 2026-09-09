---
name: feedback-meeting-note-template
description: Las notas automáticas de juntas deben seguir SIEMPRE la plantilla única de claude-setup (contexto, puntos discutidos, decisiones, action items con checkbox, notas relacionadas), no solo un resumen.
metadata:
  type: feedback
---

Alan revisó la nota del standup del 2026-09-08 y dijo que "no jaló algo del claude setup": la nota debe darle forma a la junta con los puntos importantes y puntos para trabajar, no solo traducir o resumir.

**Why:** Las notas de juntas se releen para actuar; sin action items con responsable y sin los puntos clave, no sirven. La plantilla estructurada existía solo dentro del recorder de Linux (`mic-meeting-recorder`, `CLAUDE_SYSTEM_PROMPT`); el `process.py` de la Mac traía otro prompt (Summary/Decisions/Mentioned, sin checkboxes ni wikilinks).

**How to apply:** La plantilla canónica vive en `~/.claude/bootstrap/tools/meeting-note-template.md` y el `process.py` de la Mac la carga en runtime. Secciones en este orden: Context, Points discussed, Decisions, Action items (`- [ ] Owner — what`, los de Alan primero), Open questions, Related notes (wikilinks solo a notas que existen en el vault). Frontmatter YAML como en Linux (tags, date, time, duration_min, source, transcript). Si cambia la estructura, cambiar también el prompt en español del recorder de Linux. Al escribir cualquier nota de junta a mano, usar esa misma plantilla. Ver [[reference-meeting-tools]].

---
name: Colaboradores por proyecto
description: Quién participa en qué proyecto — evita malatribuir juntas o pedidos al proyecto equivocado
type: project
originSessionId: aa895bce-fafd-44bb-b842-fd4b25242de8
modified: 2026-09-05T01:19:55.415Z
---
Mapeo de personas → proyectos donde participan. Útil para estructurar notas de junta (auto-transcript) y para inferir contexto cuando el usuario menciona un nombre sin decir el proyecto.

- **Noé** → [[huella_interop_poc]] (módulo identidad biométrica del Framework Bot); desde 2026-09-04 también participa en juntas de [[biocheck]] (usará los scores de matching del kiosko). **NO participa en lemut_n8n.** Junta recurrente: viernes.
- **Tristan** → contribuye en [[biocheck]] (equipo Clee).
- **Aaragon-clee-es** → contribuye en [[biocheck]] (equipo Clee).
- **Jesús ("Chucho")** → apareció en la junta de biocheck 2026-09-04; rol por confirmar.
- **Alan (el usuario)** → dueño de lemut_n8n y huella_interop_poc; contribuye en biocheck en su branch `alanvaldez070726`.

**Why:** al estructurar notas de junta con auto-transcript, Claude asoció por default a Noé con lemut_n8n cuando en realidad Noé solo participa en huella_interop_poc. Este mapeo evita ese error.

**How to apply:**
- Al estructurar notas de junta, usar este mapeo para decidir qué `[[wikilinks]]` de proyecto agregar en base a los participantes.
- Si el usuario dice "junta con Noé" sin más contexto, asumir que es de huella_interop_poc.
- Si aparece un colaborador nuevo, agregar aquí.

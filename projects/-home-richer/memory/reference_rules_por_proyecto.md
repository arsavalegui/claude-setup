---
name: reference_rules_por_proyecto
description: "Rule files en ~/.claude/rules/ con los gotchas por proyecto (n8n, fhir, huella, cimat, biocheck, agent-flow) y entrega.md global; los subagentes los heredan, mi memoria no"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0c5deaae-906a-4204-a4b2-d350d9f2f3f4
  modified: 2026-09-06T07:24:04.711Z
---

Creados 2026-09-06 a partir de mis notas de memoria, verificados contra cada repo por documentadores:

- `~/.claude/rules/entrega.md` (sin `paths:`, global): evidencia real antes de "ya quedó", revisor ≠ autor, sin commit/push sin pedirlo, confirmar destructivos, README/Obsidian al día, repos nuevos públicos sin secretos, español mexicano.
- `n8n.md` → `**/lemut_n8n/**`, `**/n8n-automatization/**` (up.sh, import_workflow.sh, router.json y el baile del webhook, motor_agenda.js + embed_motor.py, sim_telegram.py, reset de owner). Variable del túnel es `WEBHOOK_URL`.
- `fhir.md` → `**/fhir-agent-poc/**`; `huella.md` → `**/huella_interop_poc/**` (MATCH_THRESHOLD=10 hoy, no 40); `cimat.md` → `**/cimat-rest-mex/**`.
- `biocheck.md` → `**/biocheck/**`; `agent-flow.md` → `**/agent-flow-app/**`, `**/.claude/agent-flow/**`, `**/centro-mando/**`.

**Why:** los subagentes no heredan mi memoria; las rules sí se cargan cuando se toca un archivo que hace match. Plantilla en `~/.claude/rules/README.md`: frontmatter `paths:`, primera línea del cuerpo = a quién delegar (no hay skills por stack), máximo 7 puntos concretos.

**How to apply:** cuando aprenda un gotcha nuevo de un proyecto, además de la memoria, agregarlo (o reemplazar el menos útil) en su rule file. Al crear un proyecto nuevo, crear su rule. Ver [[project_centro_mando]], [[project_fhir_agent_poc]], [[project_lemut_n8n]].

---
name: reference-aura-subagents
description: "Subagentes propios para el trabajo de AURA (dónde viven y qué hace cada uno)."
metadata:
  type: reference
---

Alan pidió (2026-08-30) tener subagentes fijos para los procesos del proyecto, en vez de improvisar cada vez. Viven en `~/.claude/agents/` (nivel usuario, así aplican en `aura` y en `aura-iac`):

- **`aura-investigator`** — read-only, localiza código e infra, devuelve `file:line`. Sabe que hay que leer del remoto con `glab api .../repository/files/...` porque `git fetch` por HTTPS truena, y que un hallazgo en feature branch no es un hallazgo en `dev`/`main`.
- **`aura-developer`** — implementa en Python y Terraform. Regla clave: un cambio que cruza los dos repos (env var consumida en Python + inyectada en `container-app.tf` + declarada en `variables.tf` + passthrough por environment) tiene que ir en ambos lados o el feature queda inerte.
- **`aura-tester`** — pytest + **siempre** genera el xlsx plano en `~/Downloads` (ver [[feedback-test-inventory-excel]]).
- **`aura-pipeline`** — triage de GitLab con `glab`; compara el job fallido contra los últimos pipelines de la branch de integración para separar fallos preexistentes de los propios.
- **`aura-azure`** — verificación read-only con `az` + queries a App Insights / Log Analytics; trae escrito qué accesos hay y cuáles están denegados.

Contenido de los archivos en inglés, como pide [[feedback-test-inventory-excel]]. Relacionado: [[project-aura-7506-spike]] [[project-aura-ci-pipeline]] [[reference-local-tooling]]

**`aura-reviewer` (agregado 2026-08-30):** revisa código que escribió OTRO agente, nunca el suyo. Read-only (Read, Grep, Glob, Bash), modelo opus. Diffea contra `origin/dev` / `origin/main`, no contra la feature branch. Caza regresiones, errores de lógica, supuestos no escritos (sobre todo contratos entre repos), código reinventado que ya existe, drift de convenciones y TTLs faltantes en datos de permisos. Reporta con `file:line` + severidad + escenario de falla concreto; no arregla. Correrlo siempre antes de abrir o actualizar un MR. Ver [[feedback-agent-role-separation]].

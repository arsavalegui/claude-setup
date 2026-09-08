---
name: feedback-agent-role-separation
description: Quien escribe el código NUNCA lo revisa; separar roles entre agentes (developer / tester / reviewer) y qué debe cazar el revisor.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9c8838d4-9d92-4297-ae67-f1f0ba3f1160
  modified: 2026-08-30T10:20:08.454Z
---

**El agente que escribe el código nunca es el que lo revisa.** Alan lo pidió explícito (2026-08-30): para eso existen varios agentes. `aura-developer` implementa, `aura-tester` prueba, `aura-reviewer` revisa. Nunca pedirle al developer que valide su propio trabajo.

**Why:** el autor de un cambio revisa el código que *quiso* escribir, no el que escribió. Los supuestos que se le pasaron por alto al implementar se le vuelven a pasar al revisar, porque son los mismos supuestos. La separación es lo único que los saca a la luz. Ya pasó en AURA: el guard `AURA_ENV=scr` en el backend y el Terraform que setea las env vars viven en repos distintos, se mergearon los dos MRs sin cruzar ese detalle, y la feature quedó desplegada e inerte.

**How to apply:** después de que `aura-developer` o `aura-tester` toquen algo, y siempre antes de abrir o actualizar un MR, correr `aura-reviewer` (creado 2026-08-30 en `~/.claude/agents/aura-reviewer.md`, read-only: reporta, no arregla). Lo que Alan quiere que cace, en orden:
- **Regresiones** — rastrear los call sites de toda función cuya firma, retorno, excepciones o timing cambiaron; grep de callers, no asumir que no hay.
- **Errores de lógica** — condiciones invertidas, off-by-one, defaults malos cuando falta o no parsea una env var, returns tempranos que se saltan cleanup.
- **Supuestos que el que desarrolló se saltó u olvidó** — lo que tiene que ser cierto en otro lado para que esto funcione, y si algo lo garantiza. **Los contratos entre repos (`aura` <-> `aura-iac`) son el riesgo más alto de este proyecto**, revisarlos siempre.
- **Código reinventado** — si ya existe una función que hace algo, se usa esa, no se crea otra. Citar la existente con `file:line` en el hallazgo. La consistencia pesa más que la elegancia local.
- **Estándar y convenciones** del código de alrededor, y si los tests de verdad ejercitan las ramas nuevas o solo el happy path.

Los hallazgos van uno por línea con `file:line`, severidad, y **un escenario de falla concreto**: sin escenario es sospecha, no hallazgo. Siempre cerrar diciendo qué no se pudo verificar.

Relacionado: [[reference-aura-subagents]] [[project-aura-7506-spike]] [[feedback-test-inventory-excel]]

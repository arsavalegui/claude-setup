---
name: project-claude-setup-mac
description: "Desde 2026-09-08 ~/.claude de esta Mac es clon del repo privado github.com/arsavalegui/claude-setup (rama master); bootstrap ya corrido completo, servicios agent-flow/centro-mando vivos, y cómo sincronizar."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e94c95c-1cbb-49b2-8444-39f41b603e38
  modified: 2026-09-08T09:10:36.919Z
---

`~/.claude` en esta Mac (D99MFVLWP6) trackea `https://github.com/arsavalegui/claude-setup` desde 2026-09-08 (`gh` logueado como `arsavalegui`). La máquina canónica del repo es la Linux `richer`; su memoria vive en `projects/-home-richer/memory/` y la de esta Mac en `projects/-Users-alan-valdezsavalegui/memory/` (ignorada por git a propósito).

**Estado al 2026-09-08 (noche):**
- `bootstrap/bootstrap.sh --skip-browsers` corrió completo y dos veces (idempotente) en esta Mac. agent-flow-app 0.9.1 con patch, plugins, MCPs, codebase-memory-mcp 0.10.8, rtk, 49 memorias copiadas e índice MEMORY.md mergeado (48 entradas).
- Servicios launchd vivos: `com.alan.agent-flow` en http://127.0.0.1:3001 y `com.alan.centro-mando` en http://127.0.0.1:3002. Logs en `~/Library/Logs/<servicio>.log`. Se cayeron la primera vez por el PATH mínimo de launchd; arreglado con `__PATH__` en los plists. Además agent-flow no veía ninguna sesión porque launchd lo arrancaba con cwd `/` y hook.js filtra por workspace; arreglado con `WorkingDirectory=$HOME`. Y `launchctl bootout` es asíncrono: el bootstrap ahora espera antes de recargar.
- Permisos: `defaultMode: bypassPermissions`, sin lista `ask` ni `deny`. Alan pidió explícitamente cero prompts de permisos en esta Mac; la decisión anterior "sin bypass en laptop del trabajo" quedó revocada. Sigo confirmando solo destructivos reales (regla entrega.md #4).
- Aviso inofensivo que persiste: `codebase-memory-mcp install` marca error en `hooks/cbm-code-discovery-gate` y `hooks/cbm-session-reminder` porque viajan en el repo como archivos normales; el MCP queda conectado igual.
- `~/Notes/` NO existe en esta Mac (el vault de Obsidian vive en `richer`); la nota `~/Notes/Projects/` del claude-setup se actualiza desde allá.

**Why:** Alan quiere la misma config en las dos máquinas y que los cambios viajen sin que él tenga que intervenir; por eso pidió bypass total aquí.

**How to apply:**
- Si cambia una memoria de esta Mac, copiarla a `projects/-home-richer/memory/` (con `cp`, no `cp -n`, para actualizar) y mergear MEMORY.md a mano. Revisar antes que no vaya PII ni secretos.
- Cambios de config aquí: `cd ~/.claude && git add -A && git commit && git push` (mensaje en español, sin co-author), como dice [[project_claude_setup_repo]].
- Traer cambios de la otra máquina: `git pull` y luego `bootstrap/bootstrap.sh --skip-browsers` (idempotente).
- Si un servicio launchd muere: `tail ~/Library/Logs/<servicio>.log`; recargar con `launchctl bootout gui/$(id -u)/com.alan.<s>` y `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.alan.<s>.plist`.
- El grabador lee `MIC_SOURCE` de `bootstrap/machines/D99MFVLWP6.env`; ver [[reference-live-audio-capture]].

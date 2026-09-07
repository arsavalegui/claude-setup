---
name: project_centro_mando
description: "Centro de Mando (puerto 3002) — vista del roster de agentes siempre visible, complemento de agent-flow (3001); cómo recibe hooks y gotchas"
metadata: 
  node_type: memory
  type: project
  originSessionId: a95022d4-d9de-411a-85c6-73663435eff8
  modified: 2026-09-07T10:09:14.202Z
---

Centro de Mando: dashboard local del equipo de agentes, construido 2026-09-04. Código en `~/.local/share/centro-mando/` (server.py stdlib + index.html), servicio `centro-mando.service` (systemd --user, enabled, Linger=yes). URL http://127.0.0.1:3002. agent-flow (open source, patoles) corre en 3001 como `agent-flow.service`.

**Why:** El usuario quiere ver SIEMPRE a sus 7 agentes (`~/.claude/agents/*.md`) aunque estén en standby; agent-flow solo muestra actividad viva y no expone el tipo de subagente.

**How to apply:**
- Eventos llegan por el reenviador `~/.claude/agent-flow/hook.js`: reenvía a todo `~/.claude/agent-flow/*.json` con mismo `workspace` (/home/richer). Registrarse ahí, no tocar settings.json.
- hook.js manda body chunked (sin Content-Length).
- `agent_type` en hooks = `name` del Agent tool si se le puso nombre; el tipo real sale de `PreToolUse` tool `Agent` → `tool_input.subagent_type`.
- Verificar con `curl 127.0.0.1:3002/state` y `/raw`; autoprueba `python3 test_server.py`.
- Nunca abrir el navegador del usuario; solo dar la URL. Ver [[feedback_abrir_apps_escritorio]] y [[reference_claude_tooling]].

- 2026-09-05: hook.js ahora enriquece `agent_type` solo para agent-flow: guarda name→subagent_type en `~/.claude/agent-flow/pending-types.json` (PreToolUse Agent) y reescribe a `"<tipo> · <name>"` en la copia que va al proceso agent-flow (detectado por /proc cmdline). Centro de Mando recibe payload crudo. Poner `name` al spawnear para que salga el tipo real.

- 2026-09-05 parche a agent-flow vendorizado (`~/.local/share/mise/installs/node/*/lib/node_modules/agent-flow-app/dist/app.js`), diff en `~/.claude/agent-flow/agent-flow.patch` (3 hunks): excluir dirs "claude-mem" en scanForActiveSessions; etiqueta `<tipo> · <name>` en resolveSubagentChildName; reintento en resolveNameFromMeta (carrera .jsonl/.meta.json daba "subagent-N"). Reaplicar tras update: `patch -p1 < ~/.claude/agent-flow/agent-flow.patch` en ese dir + `systemctl --user restart agent-flow`. Sin resolver: auto-follow a sesión top-level nueva (sin toggle en el cliente).

- 2026-09-05 (tarde): agent-flow.patch ahora 4 hunks: + heartbeat `:ping` cada 15 s en handleSSE (sin él, el navegador perdía el stream en silencio y había que recargar) y resolveNameFromMeta con setTimeout (antes Atomics.wait bloqueaba el event loop).

- 2026-09-07: watchdog de conexión. La ventana del usuario dejaba de recibir eventos en silencio (EventSource no dispara onerror; el `:ping` es comentario invisible a JS). Ahora el heartbeat manda también `{"type":"ping"}` real cada 15 s (via `sendSSE`), el webview filtra ese tipo, guarda `window.__afLast`, y un `setInterval` recarga la página si pasan 45 s sin mensajes. Tras aplicarlo, una ventana ya muerta necesita UN F5 manual; después se cura sola. Patch sigue en 13 hunks (12 app.js + 1 webview, el hunk del webview absorbe los 3 cambios).

- 2026-09-06 (3): patch 12 hunks app.js + 1 webview (13 total). Congelamiento del visor tras reiniciar: `prescanExistingContent` marcaba en `spawnedSubagents` todo Agent del historial sin emitir evento, y el hijo anidado apuntaba a un padre nunca dibujado → d3 `node not found` en cada frame → canvas congelado (lo vi con Playwright leyendo la consola). Fix: `session.emittedSpawns` (poblado solo en `emitSubagentSpawn`) es la única señal de "ya dibujado"; webview `Kt` solo crea edge si el padre existe. Y `SUBAGENT_STALE_MS=2 min`: al reiniciar, archivos de subagente sin escrituras recientes quedan `silenciado` (no se dibujan, no hay fantasmas); si escriben de nuevo, se pintan. Verificado: "2 agents", consola limpia. Regla: cualquier cambio en agent-flow se verifica con `pw-shot http://127.0.0.1:3001 out.png --wait 5000 --text 200` (consola + conteo), no con curl.

- 2026-09-06 (2): patch 10 hunks app.js + 1 webview. Subagente anidado (lanzado por otro subagente, `.meta.json` con `parentAgentId` + `toolUseId`, sin `name`): `resolveNestedSubagent` busca el `tool_use` en el jsonl del padre y cuelga el nodo del padre con el mismo nombre que emite el parser; probado en vivo: un solo nodo `Explore · Hijo anidado prueba` bajo `general-purpose · anidado-padr`, cerrado con su `agent_complete`. Ruido inofensivo que queda: canal hooks emite `Explore-<hash>` para anidados sin name (la UI lo tira). Tras reiniciar agent-flow, los teammates ya vivos cierran como `subagent` (agentNames se pierde).

- 2026-09-06: patch ahora cubre 2 archivos: 9 hunks en `dist/app.js` + 1 hunk en `dist/webview/index.js` (minificado, hunk enorme; pristine en `~/.claude/agent-flow/webview-index.js.pristine`). El webview usa `EventSource` y tras un reinicio del servidor reconectaba con estado viejo (nada en tiempo real hasta F5). Fix: `window.__afCaido` en onerror y `location.reload()` en el siguiente onopen. Reaplicar tras update: `patch -p1` desde la raíz del paquete cubre ambos.

- 2026-09-05 (noche, 2): patch 9 hunks. Crash `Buffer.alloc(NaN)` en `readSubagentNewLines` (4 veces en 3 días, systemd reiniciaba): el marcador `{ pendingMeta: true }` de nuestro retry de .meta.json no tiene `fileSize` y el poll de 3 s lo leía. Guard `if (state.pendingMeta) return;`. Si vuelve `ERR_OUT_OF_RANGE` en `journalctl --user -u agent-flow`, revisar ahí.

- 2026-09-05 (noche): patch 8 hunks, pristine guardado en `~/.claude/agent-flow/app.js.pristine` (regenerar: `diff -u app.js.pristine app.js`). Fix para agentes con `name` (teammates, corren en background): (1) `handleToolResult` ya no cierra el nodo cuando Agent devuelve "Spawned successfully"; (2) `handleStop` no completa al orquestador si la sesión tiene `activeSubagents` (antes cada fin de turno mío completaba en cascada y podaba a todos los hijos vivos); (3) canal hooks usa la misma etiqueta `<tipo> · <name>` (antes `-hash6`, sus eventos y su SubagentStop no pegaban al nodo). Verificado con captura SSE: nodos viven hasta su SubagentStop real. Límite: tras reiniciar agent-flow, los teammates ya vivos no están en `activeSubagents` hasta que se lanzan nuevos. Claude Code: "Teammates cannot spawn other teammates" (un agente con name no puede lanzar otro con name). Prueba grande 18 agentes: `CHILD_NAME_MAX=30` corta etiquetas largas (`caveman:cavecrew-investigator `), cosmético.

- 2026-09-05 (madrugada): patch 5 hunks. Nuevos: tipo desde pending-types.json para agentes built-in (general-purpose/Explore no traen customAgentType en .meta.json); rediscovery de subagentes vivos tras reinicio (antes solo emitía spawn si había tool_use pendiente en ese instante → invisibles). Chromium throttlea pestañas en background: abrir agent-flow con `chromium --user-data-dir=~/.config/chromium-agentflow --app=http://127.0.0.1:3001 --disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows` (perfil aparte; con Chromium ya abierto las flags se ignoran).

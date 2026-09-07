---
name: tooling-de-claude-code-instalado-2026-08-27
description: "claude-mem, headroom (barra), task-observer, OmniRoute y stack claude-code-tips; ajustes que hice para que no se rompieran entre sí"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9c1d9717-cde0-4b97-870c-5cc0d95ee83f
  modified: 2026-09-07T10:08:49.337Z
---

Instalado a petición del usuario el 2026-08-27:

- **claude-mem** (plugin `claude-mem@thedotmack`): memoria automática por hooks. Convive con mi memoria de archivos — la mía sigue siendo la fuente curada.
- **headroom (barra de contexto)** — henchmarketing-rgb: `~/.claude/statusline.sh` + hook `context-counter.py`. Corregí la clave a `statusLine` (el instalador escribía `statusline` y Claude Code la ignora).
- **task-observer** skill en `~/.claude/skills/task-observer/`.
- **OmniRoute** (npm global, v3.8.49): gateway a modelos gratis. El server NO arranca solo: `omniroute serve` (puerto 20128). Uso puntual: `omniroute run claude`. El usuario lo quiso para cuando se acabe el límite de Claude.
- **Stack claude-code-tips** (sgaabdu4): RTK, codebase-memory-mcp, plugins context-mode y caveman, hooks de enforcement, slash commands (/e2e, /ship, /unleash), env de optimización.
- **agent-flow** (2026-09-04, npm agent-flow-app, patoles): grafo EN VIVO de sesiones/subagentes en http://127.0.0.1:3001. Servicio systemd --user `agent-flow.service` (AGENT_FLOW_TELEMETRY=false — telemetría desactivada; ojo: correrlo a mano desde terminal la reactiva salvo exportar esa var). Hooks agregados a settings.json (Pre/PostToolUse, SubagentStart/Stop, Session*, etc. → ~/.claude/agent-flow/hook.js); backup pre-cambio: settings.json.bak-agentflow. Auditado: sin fuga de transcripts, todo local. Dashboard sin auth (solo localhost).

**Ajustes que hice (no revertir sin razón):**
- Comenté el wrapper `claude() { headroom wrap ... }` en `~/.bashrc` — el binario `headroom` (compresor headroom-ai) NO está instalado y rompía el comando `claude`. Reactivar solo si se instala `pipx install 'headroom-ai[all]'`.
- Quité `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` del env (usamos background tasks y monitores).
- El stack dejó `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50`, modelos default opus-5[1m]/sonnet-5 para subagentes, y `effortLevel: xhigh`. Modelo del usuario (fable-5[1m]), bypassPermissions y statusLine de headroom quedaron intactos.
- Backup de settings pre-instalación: `~/.claude/settings.json.bak.*`.

Ojo: "OmniRogue" (omnirogue.com, $14.99/mes) es un copycat de paga de OmniRoute — el usuario casi lo pide por ese nombre; le recomendé el OSS.

- **Playwright MCP global** (2026-09-06): `claude mcp add --scope user playwright -- npx -y @playwright/mcp@0.0.80 --headless --isolated` (en `~/.claude.json` → `mcpServers`, ya no por proyecto; quité el local de tiktok-edits). Chromium propio en `~/.cache/ms-playwright/` (headless shell 153). 24 tools `mcp__playwright__browser_*` (navigate, snapshot, take_screenshot, click, type, fill_form, evaluate, console_messages...). Es un navegador invisible aparte: NO toca el Chromium del usuario. GOTCHA: las tools MCP diferidas NO llegan a subagentes (ToolSearch deshabilitado ahí, y listarlas en `tools:` del agente tampoco las carga). Solo yo las uso; `take_screenshot` exige ruta bajo `/home/richer` (p. ej. `~/.playwright-mcp/`). Para subagentes: CLI `~/.local/bin/pw-shot <url> <out.png> [--wait ms] [--fill css=txt] [--click css] [--wait-text t] [--text N]` (playwright@1.63.0 global por npm; `require` necesita `module.paths.push(npm root -g)`); imprime título, errores de consola y texto visible. Ya documentado en tester/investigador/operador.md.

- **Plugins instalados 2026-09-07 (scope user)**: `i-have-adhd@i-have-adhd` (ayghri, MIT; solo formatea respuestas: acción primero, pasos numerados, cierre con una tarea; el usuario tiene TDAH, respetar ese formato) y `n8n-mcp-skills@n8n-mcp-skills` (czlonkowski, 14 skills de n8n + router + hooks). MCP `n8n-mcp` global (`claude mcp add-json`, env `MCP_MODE=stdio LOG_LEVEL=error DISABLE_CONSOLE_OUTPUT=true`): en modo docs trae 7 tools (`search_nodes`, `get_node`, `validate_node`, `validate_workflow`, `get_template`...); las de gestión de workflows aparecen al agregar `N8N_API_URL` + `N8N_API_KEY` (key se crea en la UI de n8n: Settings → n8n API; lemut estaba apagado ese día). Primer arranque de `npx n8n-mcp` tarda >30 s (descarga): si "connection timed out", pre-calentar con `npx -y n8n-mcp` a mano.

## claude-mem worker en loop (2026-09-04)
Síntoma: hook `UserPromptSubmit` bloquea prompts con "claude-mem worker unreachable for 3 consecutive hooks"; log `~/.claude-mem/logs/` repite "Worker version mismatch — killing stale worker {pluginVersion=13.24.0, workerVersion=13.23.1}". Causa: cache `~/.claude/plugins/cache/thedotmack/claude-mem/13.24.0/` traía `scripts/*.cjs` y `sqlite/SessionStore.js` del build viejo; la copia buena vive en `~/.claude/plugins/marketplaces/thedotmack/plugin/`. Fix: `diff -rq` marketplace vs cache, copiar los archivos que difieren, matar worker con `pkill -f "^/home/richer/.bun/bin/bun .*worker-service"` (sin anclar, pkill mata al propio bash), `rm ~/.claude-mem/worker.pid`, arrancar `bun .../worker-service.cjs --daemon`. Salud: `GET 127.0.0.1:37700/api/health` (curl bloqueado por hook context-mode; usar ctx_execute con fetch).

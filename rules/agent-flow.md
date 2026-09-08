---
paths:
  - "**/agent-flow-app/**"
  - "**/.claude/agent-flow/**"
  - "**/centro-mando/**"
---
Delegar a operador.

Self-check antes de responder:
1. `dist/app.js` y `dist/webview/index.js` del paquete `agent-flow-app` (0.9.1) están vendorizados con parches; los pristines viven en `~/.claude/agent-flow/app.js.pristine` y `webview-index.js.pristine`. Toda edición se regenera con `diff -u` (etiquetas `a/dist/...` `b/dist/...`) contra `~/.claude/agent-flow/agent-flow.patch` (23 hunks), se reaplica con `patch -p1` desde la raíz del paquete, y se reinicia con `systemctl --user restart agent-flow`.
2. `hook.js` reenvía cada evento a todo `*.json` en esa misma carpeta con el mismo workspace, reescribe `agent_type` a `"<tipo> · <name>"` solo en la copia que va al proceso agent-flow, y deja bitácora en `~/.claude/agent-flow/hooks.log` (una línea JSON por hook, sin contenido): úsala como evidencia de qué hooks llegaron y cuándo.
3. Un agente lanzado con `name` es un teammate en background: "Spawned successfully" no significa que terminó; su fin real es `SubagentStop` o su último assistant con bloque `text` sin `tool_use` pendiente. Un teammate no puede lanzar otro teammate.
4. Verificar SIEMPRE con el rig antes de dar por bueno un cambio: `node ~/.claude/agent-flow/rig/run.js --dist-md5 <md5 de dist/app.js>` (470 casos, instancias aisladas con HOME temporal); para un vistazo rápido, Playwright headless leyendo `window.__afAgents()` y `window.__afSession()` (sondas expuestas por el patch) o `~/.local/bin/pw-shot http://127.0.0.1:3001 out.png --wait 8000 --text 200`. Nunca escribir archivos sintéticos en `~/.claude/projects/` reales.
5. Los nodos terminados se desvanecen a propósito (poda upstream): "terminó y ya no está" es correcto; falla solo si aparece vivo tras terminar o si desaparece sin terminar. Límite conocido: un agente muerto a media tool (sin `SubagentStop` ni `SessionEnd`) se muestra vivo hasta 30 min.
6. Nunca abrir el navegador del usuario; dar la URL (127.0.0.1:3001 agent-flow, 127.0.0.1:3002 Centro de Mando). Excepción ya autorizada: el perfil aparte `chromium-agentflow` (`--app=http://127.0.0.1:3001` con flags anti-throttling).
7. Cada cambio en `agent-flow/` (patch, hook.js, rig) se commitea y pushea en el repo `~/.claude` (claude-setup) para que llegue a las demás máquinas.

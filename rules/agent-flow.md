---
paths:
  - "**/agent-flow-app/**"
  - "**/.claude/agent-flow/**"
  - "**/centro-mando/**"
---
Delegar a operador.

Self-check antes de responder:
1. `dist/app.js` y `dist/webview/index.js` del paquete `agent-flow-app` están vendorizados con parches; los pristines viven en `~/.claude/agent-flow/app.js.pristine` y `webview-index.js.pristine`. Toda edición se regenera con `diff -u` (etiquetas `a/dist/...` `b/dist/...`) contra `~/.claude/agent-flow/agent-flow.patch`, se reaplica con `patch -p1` desde la raíz del paquete, y se reinicia con `systemctl --user restart agent-flow`.
2. `hook.js` reenvía cada evento a todo `*.json` en esa misma carpeta con el mismo workspace, y reescribe `agent_type` a `"<tipo> · <name>"` solo en la copia que va al proceso agent-flow (detectado por /proc cmdline); Centro de Mando recibe el payload crudo.
3. Un agente lanzado con `name` es un teammate en background: "Spawned successfully" no significa que terminó. Un teammate no puede lanzar otro teammate.
4. No dar una edición del patch por buena solo porque el servicio reinició sin error: verificar con una captura SSE real (`curl -N localhost:3001/events`).
5. Nunca abrir el navegador del usuario; dar la URL (127.0.0.1:3001 agent-flow, 127.0.0.1:3002 Centro de Mando) y dejar que él la abra.

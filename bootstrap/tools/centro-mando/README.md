# Centro de Mando

Vista del equipo de agentes de Claude Code, siempre visible: los 7 agentes de
`~/.claude/agents/*.md` más Claude al centro. En gris "en standby" cuando no
hacen nada; se encienden con el paso que van haciendo cuando trabajan.

- URL: http://127.0.0.1:3002 (agent-flow vive en el 3001)
- Servicio: `systemctl --user status centro-mando` (enabled, Linger activo)
- Código: `server.py` (Python 3 stdlib) + `index.html` (vanilla JS + SVG, sin CDNs)
- Autoprueba: `python3 test_server.py`

## Cómo llegan los eventos

Claude Code dispara hooks (SubagentStart/Stop, Pre/PostToolUse, Stop, Session*)
que `~/.claude/agent-flow/hook.js` reenvía por HTTP POST a todo servidor
registrado en `~/.claude/agent-flow/*.json` con el mismo `workspace`. El
servidor escribe su propio archivo de registro al arrancar y lo borra al parar.
No se tocó `~/.claude/settings.json`.

## Gotchas

- `hook.js` manda el cuerpo con `Transfer-Encoding: chunked`; sin leer chunks el JSON llega vacío.
- Si el orquestador le pone `name` al subagente, `agent_type` trae ese nombre y no el tipo;
  el tipo real se toma del `PreToolUse` del tool `Agent` (`tool_input.subagent_type`).
- Tipos fuera del roster (Explore, Plan, general-purpose...) salen como nodo temporal punteado.
- Terminal cerrada sin SubagentStop: el agente se apaga solo tras `CENTRO_MANDO_IDLE` segundos (600).

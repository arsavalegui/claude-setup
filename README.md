# claude-setup

Mi configuración de [Claude Code](https://claude.com/claude-code), versionada y
portable entre Linux y macOS. Un `git clone` más un script y la máquina nueva
queda igual que la vieja.

```bash
git clone https://github.com/arsavalegui/claude-setup.git ~/.claude
~/.claude/bootstrap/bootstrap.sh --dry-run   # enseña qué haría
~/.claude/bootstrap/bootstrap.sh             # lo hace
```

Corre `--dry-run` primero. El script es idempotente: correrlo dos veces no rompe
nada, solo reporta lo que ya estaba. Detalle completo de flags y de qué instala
fuera de `~/.claude` en [`bootstrap/README.md`](bootstrap/README.md).

## Qué incluye

| Ruta | Qué es |
|---|---|
| `CLAUDE.md` | Instrucciones globales: principios, flujo de implementación obligatorio, cuándo delegar |
| `rules/` | Gates por stack. Si tocas un archivo que hace match con `paths:`, la regla se carga sola |
| `agents/` | Subagentes con rol propio: desarrollador, revisor, tester, operador, investigador, documentador |
| `commands/` | Slash commands (`/e2e`, `/ship`, `/unleash`) |
| `hooks/` | Hooks de sesión y de PreToolUse: gate de descubrimiento de código, contador de contexto, sincronización de herramientas |
| `skills/` | Skills instaladas (ver [`NOTICE.md`](NOTICE.md) para las de terceros) |
| `settings.json` | Permisos, MCPs, statusline, hooks |
| `bin/` | Utilidades de mantenimiento |
| `bootstrap/` | El instalador, los perfiles por máquina, los servicios systemd/launchd y las herramientas |
| `agent-flow/` | Parche sobre `agent-flow-app` 0.9.1 más el rig de pruebas que lo valida |

## Herramientas en `bootstrap/tools/`

- **`pw-shot`** — capturas con Chromium headless propio, para que un subagente
  verifique una página sin abrir el navegador del usuario.
- **`centro-mando`** — tablero web del estado de los servicios locales.
- **`mic-meeting-recorder`** — graba micrófono y sistema, transcribe con
  faster-whisper y escribe una nota estructurada en Obsidian. El contexto
  personal (proyectos, colaboradores) se lee de
  `~/.config/mic-meeting-recorder/contexto.md`, que no viaja en el repo.

## Perfiles por máquina

`bootstrap/machines/` guarda un `.env` por equipo con lo que cambia entre uno y
otro: rutas, dispositivo de micrófono, qué servicios levantar. Aquí solo va
[`ejemplo-mac.env`](bootstrap/machines/ejemplo-mac.env) como plantilla. Copia
ese archivo con el hostname de tu máquina y ajusta los valores.

## Qué no está aquí

Este export es la configuración, no mi memoria ni mi trabajo.

- **Memoria persistente, transcripts, sesiones y credenciales** viven en un repo
  privado aparte, `claude-setup-privado`, que es la fuente de verdad.
- **Todo lo del empleador** (agentes, reglas y notas de trabajo) vive en otro
  repo privado, `claude-setup-trabajo`, y nunca toca este.

Por eso el historial de este repo es un solo commit: es un export curado, no el
espejo del repo privado.

## Licencia

MIT, ver [`LICENSE`](LICENSE). Las skills y los archivos de agent-flow que vienen
de terceros conservan la suya, listadas en [`NOTICE.md`](NOTICE.md).

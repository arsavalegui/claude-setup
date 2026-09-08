# Bootstrap de `~/.claude`

Este repo es la configuración de Claude Code de Alan, empaquetada para reproducirse
en otra máquina. Viaja la **configuración**; no viajan los secretos, los transcripts
ni los caches.

## Máquina nueva, un solo comando

```bash
git clone <url-del-repo> ~/.claude && ~/.claude/bootstrap/bootstrap.sh
```

Si `~/.claude` ya existe con cosas dentro, clona aparte y mueve el `.git`:

```bash
git clone <url-del-repo> /tmp/claude-cfg
mv /tmp/claude-cfg/.git ~/.claude/.git
cd ~/.claude && git checkout -- .
~/.claude/bootstrap/bootstrap.sh
```

### Flags

| Flag | Para qué |
|---|---|
| `--dry-run` | Enseña todo lo que haría sin escribir nada. Úsalo primero. |
| `--skip-browsers` | No baja Chromium de Playwright (~150 MB). |
| `--skip-cbm` | No baja `codebase-memory-mcp` (~280 MB). |
| `--skip-services` | No instala ni arranca systemd/launchd. |

El script es idempotente: correrlo dos veces no rompe nada, solo reporta lo que ya
estaba.

## Qué instala

**Dentro de `~/.claude`** (ya viene en el clone): `CLAUDE.md`, `settings.json`,
`rules/` (7 gates por stack), `agents/` (10 subagentes), `commands/`, `hooks/`
(11 scripts), `bin/`, `skills/`, `statusline*.sh`, las banderas de modo
(`.i-have-adhd-always`, `.caveman-active`, `.ponytail-active`), el patch de
agent-flow con sus copias `.pristine`, y la memoria persistente.

> En el **export público** (`arsavalegui/claude-setup`) la memoria no viaja:
> vive solo en el repo privado. El paso 8 del bootstrap avisa que no la
> encuentra y sigue; todo lo demás se instala igual.

**Fuera de `~/.claude`** (lo copia el bootstrap):

| Qué | A dónde |
|---|---|
| `pw-shot` | `~/.local/bin/pw-shot` |
| `centro-mando/` | `~/.local/share/centro-mando/` |
| `mic-meeting-recorder` | `~/.local/bin/` (solo Linux) |
| units systemd / plists launchd | `~/.config/systemd/user/` o `~/Library/LaunchAgents/` |

**Paquetes npm globales**: `@anthropic-ai/claude-code`, `agent-flow-app@0.9.1`,
`context-mode`, `omniroute`, `playwright@1.63.0`, `tavily-cli`.

**Binarios de release**: `codebase-memory-mcp` y `rtk`. `rtk` es el proxy que el
hook de PreToolUse usa para ahorrar tokens; se baja de
[rtk-ai/rtk](https://github.com/rtk-ai/rtk). Es opcional: si falta, el hook falla
suave y solo pierdes el ahorro.

Las dos versiones fijas no son capricho. El patch de 13 hunks de agent-flow solo
aplica sobre el `dist/` de 0.9.1, y los navegadores que baja `playwright install`
tienen que casar con la librería 1.63.0. El bootstrap compara el sha256 de lo
instalado contra las copias `.pristine` antes de aplicar el patch: si no coinciden,
avisa y **no** fuerza nada.

**Plugins y MCP**: los marketplaces y los plugins salen de `enabledPlugins` y
`extraKnownMarketplaces` de `settings.json`, así que la lista es una sola fuente de
verdad. Los MCP `memory`, `playwright` y `n8n-mcp` se registran con
`claude mcp add-json --scope user`.

`codebase-memory-mcp` es la excepción: no se registra con `add-json`. El binario se
auto-registra en sus 43 superficies de cliente con su propio subcomando
`install -y`. El bootstrap baja el release `v0.10.8` de
[DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp),
lo instala en `~/.local/bin/` y prende `auto_index`. Los 281 MB del binario **no**
están en el repo.

## Claves personales de `settings.json`

Estas viajan en el repo y valen la pena revisarlas antes de usar el config en una
máquina compartida:

| Clave | Valor actual | Por qué importa |
|---|---|---|
| `model` | `fable[1m]` | Modelo por defecto. Cámbialo si no tienes acceso. |
| `effortLevel` | `xhigh` | Sube el costo por turno. |
| `advisorModel` | `opus` | Modelo del advisor. |
| `permissions.defaultMode` | `bypassPermissions` | **La máquina nueva arranca sin pedir permisos.** Si no es tu laptop personal, cámbialo a `default` antes de trabajar. |
| `skipDangerousModePermissionPrompt` | `true` | Quita el aviso del modo peligroso. Va de la mano con lo anterior. |
| `env.CLAUDE_CODE_SUBAGENT_MODEL` | `claude-sonnet-5` | Modelo de los subagentes. |
| `env.CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | `50` | Compacta al 50% del contexto. |
| `theme`, `agentPushNotifEnabled` | | Gusto personal, sin consecuencias. |

Las rutas de los hooks usan `$HOME` y `~` en vez de `/home/richer`. Ojo con el
detalle: `~` **no** se expande dentro de comillas dobles, por eso los hooks
entrecomillados usan `$HOME`, que sí expande. Si agregas un hook nuevo, sigue la
misma regla.

## Pasos manuales, después del bootstrap

1. **Login de Claude Code**: corre `claude` y entra con la cuenta. La sesión vive en
   `.credentials.json`, que está en el `.gitignore` y no viaja.
2. **Llaves de API**: cada proyecto trae su propio `.env`. Ninguna llave está aquí.
   El grabador de juntas lee `DISCORD_WEBHOOK_URL` del entorno, no del código.
3. **Ollama**: en Linux se instala en `~/.local/ollama`; en macOS, `brew install
   ollama && brew services start ollama`. Después, `ollama pull` de los modelos que
   ocupes.
4. **Docker**: solo si el proyecto lo pide. No lo instala el bootstrap.
5. **Obsidian**: el vault vive en `~/Notes` y se sincroniza aparte.
6. **mise**: si `node` no está, instálalo con `curl https://mise.run | sh` y
   `mise use -g node@26`. Los npm globals caen en el prefix de mise, y las units de
   systemd apuntan a los shims de mise.

## Qué NO viaja

- `.credentials.json` — la sesión de Claude Code.
- `settings.local.json` — 80 reglas de `permissions.allow` que se fueron acumulando
  al ir dando permisos en esta laptop. Puros patrones de comandos, sin secretos ni
  rutas privadas. No viaja porque son decisiones de esta máquina; la nueva se
  vuelve a llenar sola conforme trabajas.
- `projects/**` menos `projects/-home-richer/memory/**` — los transcripts de todas
  las sesiones (104 MB). Solo viaja la memoria persistente en markdown.
- `plugins/` (1 GB), `context-mode/`, `cache/`, `file-history/`, `mcp-memory/`,
  `history.jsonl`, `sessions/`, `tasks/`, `teams/`, `todos/`, `plans/`, `debug/`,
  `statsig/` — todo estado regenerable.
- El binario de `codebase-memory-mcp` (281 MB), el de `rtk`, el venv de
  faster-whisper y sus modelos (~1.5 GB). Se bajan solos.

## Notas por sistema

**Linux**: `skills/omarchy` es un symlink a `~/.local/share/omarchy`. El symlink
viaja en el repo; si Omarchy no está instalado, queda colgado y Claude Code
simplemente lo ignora. El bootstrap lo reporta.

**macOS**: launchd no tiene `Restart=on-failure`; los plists usan `KeepAlive` con
`SuccessfulExit=false`. Tampoco pueden asumir los shims de mise: los plists traen
`__BIN_DIR__` y el bootstrap lo resuelve con `command -v`, así que funciona igual
con node de Homebrew. Si el binario no está en el PATH, avisa y no instala ese
plist. Además launchd arranca con un PATH mínimo (`/usr/bin:/bin`), con el que
`env node` no existe y `env python3` es el 3.9 de Apple (centro-mando necesita
3.10+ por `str | None`); por eso los plists traen `__PATH__` y el bootstrap lo
llena con el directorio real de `node` y `python3` más `~/.local/bin`,
`/opt/homebrew/bin` y `/usr/local/bin`. También fijan `WorkingDirectory=$HOME`
porque agent-flow usa su cwd como `workspace` y con el `/` de launchd no le llegaba
ninguna sesión. Y como `launchctl bootout` es asíncrono, el bootstrap espera a que
el servicio desaparezca antes de volver a cargarlo. Dos servicios no cruzan: `ollama` se maneja con
`brew services`, y `mic-meeting-recorder` depende de `pactl` de PipeWire y del
`.monitor` de un sink de PulseAudio, cosas que macOS no tiene. Para grabar el audio
del sistema en Mac hace falta un loopback tipo BlackHole y cambiar la detección a
CoreAudio. Ver `services/launchd/README.md`.

## La memoria y el hook `memory-repo-symlink`

La memoria persistente vive en `projects/-home-richer/memory/` y es lo único de
`projects/` que se versiona. En una máquina con otro `$HOME`, Claude Code busca la
memoria en `projects/<$HOME con las / como ->/memory`, así que el bootstrap la copia
ahí. Esa copia queda **ignorada** por git a propósito: una sola fuente de verdad, sin
duplicados apareciendo en `git status`.

Ojo con un efecto secundario de que `~/.claude` ahora sea un repo: el hook de
SessionStart `hooks/memory-repo-symlink` apunta la memoria al repo del proyecto en
el que estés trabajando. Trae un caso especial para `~/.claude`, así que si abres una
sesión con el cwd dentro de `~/.claude`, va a crear un directorio `memory/` en la
raíz del repo y a enlazarlo desde `projects/-home-richer--claude/memory`. Es un slug
distinto del canónico, no toca la memoria de `-home-richer` y el directorio nace
vacío. Si te estorba, bórralo; se vuelve a crear solo.

## Perfiles por máquina

`bootstrap/machines/<hostname>.env`, cargado automáticamente si el hostname coincide.
Ahí van el nombre de la fuente de audio del micrófono y la lista de servicios a
habilitar. Nunca secretos. Ver `machines/README.md`.

## Qué está probado y qué no

El script se corrió completo en la laptop donde ya estaba todo instalado, así que
lo verificado es la **idempotencia**: cada paso detecta lo que ya existe y no lo
rompe. Los 15 comandos de hook de `settings.json` se ejecutaron uno por uno tal
como los ve el shell, y los tres plists de launchd parsean con `plistlib`.

El 2026-09-08 se corrió completo en la Mac del trabajo (macOS arm64, node de
`/usr/local/bin`, python3 de Homebrew): npm globals desde cero, patch de agent-flow,
descarga de `codebase-memory-mcp`, copia de la memoria a `projects/-Users-alan…/` y
los dos plists de launchd. Tres cosas salieron de ahí y ya están corregidas:

- `npm i -g @anthropic-ai/claude-code` falla con `EEXIST` si `claude` viene del
  instalador nativo (`~/.local/bin/claude`). Ahora el paso 2 lo detecta y lo salta.
- Los servicios de launchd morían al arrancar (`env: node: No such file` y
  `TypeError ... 'type' and 'NoneType'` en centro-mando) por el PATH mínimo de
  launchd. Ver `__PATH__` en "Notas por sistema".
- `MEMORY.md` no se copiaba si ya existía en el destino, así que las memorias
  nuevas quedaban sin entrada en el índice. El paso 8 ahora agrega las líneas
  que faltan.

Aviso que sigue saliendo y es inofensivo: `codebase-memory-mcp install` reporta
`hook_script_install ... target: regular file` porque `hooks/cbm-code-discovery-gate`
y `hooks/cbm-session-reminder` viajan en el repo como archivos normales; el MCP
queda registrado y conectado de todos modos.

Lo que **no** está probado todavía: Linux desde cero con un `$HOME` que no sea
`/home/richer`, y `mise` como origen de node en macOS. Córrele `--dry-run` antes.

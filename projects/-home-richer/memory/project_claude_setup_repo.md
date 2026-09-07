---
name: project_claude_setup_repo
description: ~/.claude es un repo git privado (github.com/arsavalegui/claude-setup) con bootstrap para reproducir la config de Claude Code en la Mac del trabajo; cómo mantenerlo sincronizado
metadata: 
  node_type: memory
  type: project
  originSessionId: 0c5deaae-906a-4204-a4b2-d350d9f2f3f4
  modified: 2026-09-07T10:58:45.746Z
---

Desde 2026-09-07 `~/.claude` es un repo git con remoto `origin` = https://github.com/arsavalegui/claude-setup (PRIVADO, rama `master`). Viaja la configuración (CLAUDE.md, settings.json, rules/, agents/, commands/, hooks/, bin/, skills/, patch de agent-flow + pristines, memoria `projects/-home-richer/memory/*.md`); NO viajan secretos, transcripts, plugins/ ni caches (`.gitignore`). Bootstrap: `bootstrap/bootstrap.sh` (Linux/macOS, idempotente, flags `--dry-run --skip-browsers --skip-cbm --skip-services`), units systemd + plists launchd en `bootstrap/services/`, perfil por máquina en `bootstrap/machines/<hostname -s>.env` (MIC_SOURCE, SERVICES_ENABLE, OLLAMA_BIN), tools vendorizados en `bootstrap/tools/` (pw-shot, centro-mando, mic-meeting-recorder).

**Why:** el usuario quiere la misma configuración (skills, MCPs, rules, agentes) en su Mac del trabajo y que cualquier cambio se propague entre equipos.

**How to apply:**
- Cada vez que agregue/cambie una skill, MCP global, rule, agente, hook o el patch de agent-flow: `cd ~/.claude && git add -A && git commit && git push` (mensaje en español, sin co-author). Antes, revisar que no entre ningún secreto ni PII (CURP, celular).
- Máquina nueva: `git clone git@github.com:arsavalegui/claude-setup.git ~/.claude && ~/.claude/bootstrap/bootstrap.sh` (correr primero con `--dry-run`). En la Mac, después de `claude` login, copiar `bootstrap/machines/ejemplo-mac.env` a `<hostname>.env`.
- La memoria se copia al slug del `$HOME` (`sed 's|[/.]|-|g'`), p. ej. `projects/-Users-alan/memory/`; el canónico trackeado sigue siendo `projects/-home-richer/memory/`. Memoria editada en otra máquina hay que copiarla de vuelta al canónico antes de commitear.
- Límites conocidos: mic-meeting-recorder es solo Linux (PipeWire); en Mac hace falta BlackHole + mezclar dos entradas avfoundation, no implementado. `rtk` se baja de rtk-ai/rtk (opcional). Con Node de NodeSource `npm i -g` da EACCES: usar mise (el README lo dice).
- Verificado 2026-09-07 por tester en Ubuntu 24.04 limpio con `$HOME=/home/alan`: settings sin rutas fijas, 36 memorias copiadas, patch de agent-flow aplica limpio, MCPs registrados, segunda corrida idempotente. Ver [[reference_claude_tooling]], [[project_centro_mando]], [[reference_rules_por_proyecto]].

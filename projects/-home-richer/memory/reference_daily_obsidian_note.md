---
name: reference-daily-obsidian-note
description: "Nota diaria automática al vault de Obsidian a las 8pm hora México centro: script, launchd y convenciones del vault."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9c8838d4-9d92-4297-ae67-f1f0ba3f1160
  modified: 2026-08-30T09:19:19.975Z
---

Alan quiere que **todo lo trabajado en el día se guarde diario a las 20:00 `America/Mexico_City`** como nota en Obsidian (pedido 2026-08-30). La Mac ya está en esa zona horaria, así que 20:00 es hora local directa, sin conversión.

**Vault: `~/Notes`** (no `~/Documents`). Estructura tipo wiki por tema, ~24 notas, sin plugin de daily notes configurado. Notas existentes relevantes a AURA: `7506 Cache spike`, `Bake-off results`, `MR 25 IaC Redis provisioning`, `MR 41 Backend Redis tier`, `Cache design decisions`, `How AURA deploys`, `My Azure access`, `AURA team`, más notas por persona (`Ahmar`, `Gavin`, `Yeison`, `Marco`, ...) y un bloque de FHIR. Las notas diarias van en `~/Notes/Daily/YYYY-MM-DD.md`.

**Implementación (NO usar CronCreate** — es solo de sesión y expira a los 7 días; Alan pidió "siempre"**):**
- `~/.local/bin/aura-daily-note.sh` — corre `claude -p` headless con `--allowedTools "Read,Write,Edit,Bash,Grep,Glob"`. Lee los transcripts modificados hoy en `~/.claude/projects/-Users-alan-valdezsavalegui/*.jsonl` y escribe la nota; si el archivo ya existe **agrega sección**, no sobrescribe. El prompt le exige inglés, frontmatter (date, tags), `[[wikilinks]]` a las notas existentes, y no inventar avances.
- `~/Library/LaunchAgents/com.alan.daily-note.plist` — `StartCalendarInterval` 20:00, `RunAtLoad false`. Logs: `~/Notes/Daily/.cron.log` (salida de claude) y `.launchd.out/err.log`.
- Ya existía `com.alan.meeting-recorder.plist` en LaunchAgents, así que launchd es el patrón conocido de esta Mac.

**OJO — el `launchctl load` lo bloquea el clasificador de auto mode.** Claude no puede cargar ni descargar el agente; hay que pedirle a Alan que lo corra él con el prefijo `!`:
`! launchctl load ~/Library/LaunchAgents/com.alan.daily-note.plist`
Prueba manual sin esperar a las 8pm: `! ~/.local/bin/aura-daily-note.sh`

Relacionado: [[feedback-test-inventory-excel]] (contenido de archivos en inglés) [[project-aura-7506-spike]] [[reference-local-tooling]] [[user-profile]]

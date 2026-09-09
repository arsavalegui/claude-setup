---
name: Herramientas de voz y grabación de juntas
description: Voxtype (SUPER+H dictado) y mic-meeting-recorder (auto-graba juntas + transcribe + nota en Obsidian)
type: reference
originSessionId: aa895bce-fafd-44bb-b842-fd4b25242de8
---
Dos herramientas custom que corren como user services de systemd.

## 1. Voxtype (dictado voz→texto)

- Paquete: `voxtype-bin` del repo `omarchy` (v0.7.5).
- Systemd unit: `voxtype.service` (user).
- Config: `~/.config/voxtype/config.toml`.
- Modelo: whisper.cpp `small` multilingüe en `~/.local/share/voxtype/models/ggml-small.bin` (~466 MB).
- Lenguaje configurado: `["es", "en"]`.
- Duración max por dictado: 180s.
- **Atajo:** `SUPER + H` (toggle). Presionas → hablas → presionas → texto se escribe en la ventana activa vía `wtype`.
- Otros atajos que trae por default: `F9` (push-to-talk), `SUPER + SHIFT + X` (toggle).

## 2. mic-meeting-recorder (auto-graba juntas)

Daemon Python que detecta cuando cualquier app abre el mic integrado, graba mic + audio del sistema, transcribe con Whisper local, y escribe una nota estructurada en Obsidian.

- **Script:** `~/.local/bin/mic-meeting-recorder`
- **Systemd unit:** `mic-meeting-recorder.service` (user, enabled)
- **Whisper venv:** `~/.local/share/mic-meeting-recorder/venv/` (faster-whisper 1.2.1)
- **Modelo:** faster-whisper `medium` int8 CPU (~1.5 GB cache en `~/.cache/huggingface/`)
- **Config hardcoded en el script:**
  - MIC_SOURCE = `alsa_input.pci-0000_03_00.6.HiFi__Mic1__source` (mic integrado del laptop)
  - Trigger: mic activo >3s
  - Grabación mínima: 60s (menos se tira)
  - Cooldown entre grabaciones: 30s
  - Formato: Opus mono 16kHz (mic + monitor del sink mezclados)

## Pipeline del recorder

1. Detecta mic active → arranca ffmpeg
2. Mic se libera → para ffmpeg
3. Si duración >60s → Whisper transcribe (~0.35× tiempo real en Ryzen 5 5600H)
4. Llama `claude -p --exclude-dynamic-system-prompt-sections` con el transcript y un system prompt de estructuración (sin emojis, con las reglas de participantes/proyectos)
5. Escribe nota en `~/Notes/Meetings/YYYY-MM-DD - Título.md` con frontmatter, contexto, puntos, decisiones, action items, wikilinks a proyectos
6. Escribe `.transcript.txt` en `~/Videos/meetings/`
7. Borra el `.opus` (según DELETE_AUDIO_AFTER_NOTE=True)

## Detalles no obvios que rompieron durante la construcción

- **Marcar el propio ffmpeg con `-name mic-meeting-recorder`** (opción del demuxer pulse) para que `count_mic_consumers` filtre self-refs vía `application.name`. Sin esto el daemon nunca ve `n=0` y graba hasta que muere.
- **NO usar `--bare` con `claude -p`** — `--bare` requiere `ANTHROPIC_API_KEY`, no lee OAuth de Max. Sin `--bare` sí usa la suscripción Max sin costo API extra.
- **Voxtype coexiste sin conflicto** — dictaciones cortas (<60s) que el daemon graba se descartan por el filtro de duración mínima.

## Cambiar comportamiento

Editar el bloque `# ---------- Config ----------` al inicio de `~/.local/bin/mic-meeting-recorder`, luego `systemctl --user restart mic-meeting-recorder`.

## Comandos útiles

```bash
systemctl --user status mic-meeting-recorder
systemctl --user status voxtype
journalctl --user -u mic-meeting-recorder -f
journalctl --user -u voxtype -f
```

## 3. Recorder de la Mac del trabajo (D99MFVLWP6)

- Vive en `~/.meeting-recorder/` (`watcher.py`, `detect.py`, `process.py`), lanzado como `~/Applications/MeetingRecorder.app` por el plist `com.alan.meeting-recorder.launcher`; copia de referencia en `~/.claude/bootstrap/tools/meeting-recorder-mac/` (debe quedar idéntica a la viva).
- Pipeline: detecta Teams/Zoom/Slack, graba wav (Aggregate Device BlackHole + mic Corsair), `whisper-cli` con `~/.whisper-models/ggml-small.bin`, `claude -p`, nota + transcript en `~/Notes/Meetings/` (`YYYY-MM-DD HH-MM Título.md` y `... (transcript).md`), borra el wav.
- Logs: `~/.meeting-recorder/logs/{watcher,process}.log`. Un standup de 31 min tarda ~5-10 min en transcribir.
- La estructura de la nota sale de `~/.claude/bootstrap/tools/meeting-note-template.md` (plantilla única, ver [[feedback-meeting-note-template]]); Linux lleva las mismas secciones en español dentro de `CLAUDE_SYSTEM_PROMPT`.

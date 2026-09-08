# meeting-recorder (macOS)

Copia de referencia del grabador de juntas que corre en la Mac del trabajo. La
copia viva está en `~/.meeting-recorder/` y NO la instala `bootstrap.sh`: macOS
ata el permiso de micrófono a un bundle, así que el watcher se lanza como
`~/Applications/MeetingRecorder.app` desde el plist de launchd que está aquí.

- `watcher.py` detecta Teams/Zoom/Slack en llamada, graba con ffmpeg y entrega
  el wav a `process.py` (whisper-cli + `claude -p` -> nota en `~/Notes/Meetings/`).
- Cómo captura lo decide `MIC_SOURCE` en `bootstrap/machines/<hostname>.env`:
  - `corsair`: Aggregate Device (BlackHole + mic del headset) y salida al
    Multi-Output Device durante la junta.
  - `mac`: solo el micrófono interno, sin tocar la salida. Con bocinas ese
    micrófono oye tu voz y la de los demás.
- Requiere: ffmpeg, whisper-cli con `~/.whisper-models/ggml-small.bin`; para
  `corsair` además BlackHole y los dispositivos Aggregate y Multi-Output.

Para instalar en otra Mac: copiar los tres `.py` a `~/.meeting-recorder/`, crear
el bundle (Automator o `osacompile`) que ejecute `watcher.py`, darle permiso de
micrófono, y cargar el plist con `launchctl bootstrap gui/$(id -u)`.

---
name: reference-live-audio-capture
description: "Cómo el meeting-recorder captura audio: UNA entrada (Aggregate Device) + dynaudnorm; el intento de dos entradas ffmpeg fallo en llamadas de Teams; permisos de micrófono por bundle; qué revisar cuando el transcript sale mal."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9c8838d4-9d92-4297-ae67-f1f0ba3f1160
  modified: 2026-09-02T15:47:22.144Z
---

**Grabador de juntas de Alan.** Vive en `~/.meeting-recorder/` (`watcher.py`, `detect.py`, `process.py`), lanzado por `~/Library/LaunchAgents/com.alan.meeting-recorder.plist`. Detecta Teams en llamada, graba, transcribe con whisper y escribe la nota en `~/Notes/Meetings/`. Borra el wav después de transcribir.

**El plist NO ejecuta el script directo:** hace `open -a ~/Applications/MeetingRecorder.app`. Es a propósito — **macOS ata el permiso de micrófono a la identidad de un bundle**, y un LaunchAgent pelado no tiene ninguna, así que corriendo el watcher directo salían grabaciones vacías sin importar los permisos otorgados. `StartInterval 300` es autocuración: `open` sobre una app ya corriendo no hace nada.

**Consecuencia para depurar:** desde una shell (o desde el Bash tool de Claude) **cualquier grabación de micrófono sale en -91 dB, silencio digital perfecto**, porque la shell no tiene el permiso. Eso NO significa que el micrófono esté mal. Solo la app puede probarlo. El permiso de micrófono en macOS es por app, no por dispositivo, así que cambiar de micrófono no requiere re-otorgarlo.

**Ruteo de audio (corregido 2026-09-02):**
- **La memoria vieja decía que el Multi-Output NO incluía BlackHole. Es FALSO hoy.** Verificado empíricamente: con salida en `Multi-Output Device`, grabar `BlackHole 2ch` mientras suena `afplay` da pico de -16.1 dB. BlackHole sí recibe el audio del sistema.
- Dispositivos presentes: input `CORSAIR HS70 Pro Wireless Gaming Headset`, `OBSBOT Meet SE Microphone`, `BlackHole 2ch`, `MacBook Pro Microphone`, `Aggregate Device`. Output `SV300QB`, `CORSAIR...`, `BlackHole 2ch`, `MacBook Pro Speakers`, `Aggregate Device`, `Multi-Output Device`.

**Cambio 2026-09-02 — dos entradas en vez del Aggregate Device.** Antes: `-f avfoundation -i ":<Aggregate>"` con `-ac 1`, o sea ffmpeg promediaba los 4 canales (0-1 BlackHole, 2-3 micrófono), dejando cada fuente a la mitad de volumen. Con el micrófono interno del MacBook, que ya capta bajo, el resultado era audio flojo: **35 minutos de junta daban 1,483 caracteres de transcript** y las cinco notas salían tituladas `Unclear - check transcript`.

Ahora graba dos entradas independientes y las mezcla:
```
FAR_SIDE_DEVICE = "BlackHole 2ch"
MIC_DEVICE = "CORSAIR HS70 Pro Wireless Gaming Headset"
-filter_complex "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0:dropout_transition=0[out]"
```
`normalize=0` es lo importante: el default de `amix` divide cada entrada entre el número de entradas, que es el mismo bug de volumen. `dropout_transition=0` evita que agache una entrada cuando la otra calla, que en una junta es casi todo el tiempo. Si el headset está apagado (es inalámbrico, desaparece de la lista) graba solo el lado remoto y avisa en el log; si falta BlackHole no graba, porque sin eso no hay junta que grabar.

Respaldo del original en `~/.meeting-recorder/watcher.py.bak-20260902`.

**PENDIENTE de verificar:** que `Multi-Output Device` incluya el **Corsair** además de BlackHole. No se puede leer su composición por CLI (`system_profiler` no lista subdispositivos); hay que abrir **Audio MIDI Setup**. Si el Multi-Output solo trae altavoces + BlackHole, con el headset puesto Alan no oye la junta.

**Cómo saber si quedó bien:** después de la siguiente junta, `~/.meeting-recorder/logs/process.log` debe reportar un transcript de decenas de miles de caracteres, no cientos, y la nota en `~/Notes/Meetings/` debe tener título real en vez de `Unclear - check transcript`.

Relacionado: [[reference-meeting-transcription]] [[reference-local-tooling]]


**REVERTIDO 2026-09-03 — el esquema de dos entradas FALLÓ en llamada real.** La junta de Teams del 2026-09-03 12:30 (64 min) salió como ruido a full-scale (pico 0 dB, RMS -14.8) y whisper la transcribió como 4448 caracteres de georgiano (`ლლლ`). Fuera de llamada el mismo comando funcionaba (test con `say` por BlackHole = transcripción perfecta), así que la falla aparece solo cuando Teams tiene el headset: hipótesis = el Corsair USB cambia de formato/sample rate al entrar en llamada y el segundo input avfoundation sigue decodificando con el formato viejo. No se confirmó al 100% (el wav ya estaba borrado), pero la evidencia contraria es sólida: las Screen Recordings manuales de Alan (que usan el Aggregate Device downmixeado a mono por macOS) sí salen intelligibles dentro de la misma clase de juntas.

**Estado actual (`watcher.py`, respaldo del intermedio en `watcher.py.bak-20260903`):** una sola entrada `Aggregate Device` (fallback `BlackHole 2ch` solo lado remoto), `-ac 1 -ar 16000`, y `-af dynaudnorm=f=500:g=31:p=0.9` para subir el nivel que el promedio de N canales dejaba en ~-30 dB. Verificado desde shell: `say` por BlackHole -> whisper perfecto. App relanzada 14:57. **Pendiente: validar dentro de una llamada de Teams** (Settings -> Devices -> Make a test call, >2 min). Si vuelve a salir basura, siguiente sospechoso es el propio Corsair dentro del Aggregate; probar quitándolo del Aggregate y usando el mic del MacBook.

**Fragilidad conocida del Aggregate:** el UID del Corsair incluye el puerto USB (`...:1130000:1,2`, `...:130000:1,2`, etc.). Si el dongle cambia de puerto, el Aggregate pierde el mic y hay que re-agregarlo en Audio MIDI Setup. Composición actual (leída de `/Library/Preferences/Audio/com.apple.audio.SystemSettings.plist`): BlackHole 2ch, MacBook Pro Microphone, Corsair (2 UIDs), OBSBOT. Multi-Output: BlackHole + Corsair. Ambas se pueden leer con `plutil -p` sobre ese plist, no hace falta abrir Audio MIDI Setup.

**Cómo diagnosticar sin esperar junta:** `touch ~/.meeting-recorder/FORCE_MEETING` fuerza grabación con la app (con permiso de mic real); copiar el wav de `recordings/` ANTES de `rm FORCE_MEETING`, porque `process.py` lo borra al terminar. OJO con `astats=reset=1:length=N`: imprime por frame, no por ventana de N segundos; para nivel global usar `astats=reset=0`. Whisper small alucina georgiano/singalés sobre ruido o silencio bajo, no solo sobre basura.

**MIC_SOURCE (2026-09-08):** `watcher.py` lee `MIC_SOURCE` de `~/.claude/bootstrap/machines/D99MFVLWP6.env`. `corsair` (actual) = Aggregate Device + Multi-Output durante la junta. `mac` = solo `MacBook Pro Microphone`, sin tocar la salida: con bocinas ese micrófono capta a todos. Cambiar el valor y relanzar la app (`pkill -f watcher.py; open -a ~/Applications/MeetingRecorder.app`); el log de arranque imprime `MIC_SOURCE=... -> <dispositivo>`. Copia de referencia del grabador en el repo: `bootstrap/tools/meeting-recorder-mac/`. Sigue pendiente validar `corsair` dentro de una llamada real de Teams.

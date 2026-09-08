---
name: reference-meeting-transcription
description: Workflow para transcribir grabaciones de meetings (.mov) en el Desktop con whisper.cpp
metadata: 
  node_type: memory
  type: reference
  originSessionId: a302d53c-3276-4da4-b76a-b86f12ef77d1
  modified: 2026-07-29T21:15:32.244Z
---

Alan guarda sus grabaciones de meetings en `~/Desktop/` como archivos `.mov`
(nombres tipo `varunmeeting.mov`, `logic.mov`, `Screen Recording YYYY-MM-DD...mov`).
Cada meeting suele venir acompañada de un `.txt` con la transcripción.

**Pipeline de transcripción ya instalado:**
- `ffmpeg` en `/opt/homebrew/bin/ffmpeg`
- `whisper-cli` (whisper.cpp) en `/opt/homebrew/bin/whisper-cli`
- Modelo en `~/.whisper-models/ggml-small.en.bin` (small English-only)
- Python whisper también disponible en `~/Library/Python/3.9/site-packages/`

**Comando estándar (en background — los .mov son largos):**
```
ffmpeg -y -i ~/Desktop/<file>.mov -ar 16000 -ac 1 -c:a pcm_s16le /tmp/<name>.wav
whisper-cli -m ~/.whisper-models/ggml-small.en.bin -f /tmp/<name>.wav \
  -otxt -of /tmp/<name>_transcript -t 8 -l en
```
70 min de audio → ~3-5 min de transcripción en Apple Silicon, ~36 KB de texto.

**OJO — meetings bilingües (parte inglés / parte español):**
El modelo `ggml-small.en.bin` es SOLO inglés y ALUCINA la parte en español (loops tipo
"We are going to show you..."). Para audio bilingüe usar el modelo MULTILINGÜE
`~/.whisper-models/ggml-small.bin` (bajado de huggingface ggerganov/whisper.cpp) y,
como whisper detecta un solo idioma por archivo, TROCEAR el wav y autodetectar por trozo:
```
ffmpeg -y -i /tmp/<name>.wav -f segment -segment_time 120 -c copy /tmp/chunks/chunk_%03d.wav
for c in /tmp/chunks/chunk_*.wav; do
  whisper-cli -m ~/.whisper-models/ggml-small.bin -f "$c" -otxt -of "${c%.wav}" -t 8 -l auto
done   # luego concatenar los .txt en orden
```

**Estructura del .txt final cuando le pide "texto + keypoints":**
1. Encabezado con título de meeting + fecha + duración
2. Key points (en español, agrupados por tema o participante)
3. Action items concretos para él
4. Transcripción cruda al final

**TCC / permisos macOS:**
- `find ~/Desktop` está bloqueado por TCC → usar shell glob + `stat` para filtrar.
- `ls ~/.Trash/` está bloqueado pero `mv` a `~/.Trash/` funciona sin prompt.

Relacionado: [[user-profile]]

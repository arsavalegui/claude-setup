---
name: Sesión biocheck 2026-07-27 — fixes en caliente + hallazgos matcher
description: Bugs resueltos en bio_api Python durante validación del lector U.are.U 4500. Estado del stack, thresholds probados, y trabajo pendiente.
type: project
originSessionId: 74f31476-d291-4bbe-ba4d-77680bc5eb37
---
Sesión larga con Alan validando el hardware del kiosk biocheck. Resultados:

## Fixes aplicados al bio_api Python (en working tree + docker cp)

Todos en `/home/richer/Projects/biocheck/bio_api/app/`. **NO commiteados**,
**NO en la imagen Docker** — viven solo en el container corriendo vía
`docker cp`. Si haces `docker compose down` + `up --build` se pierden.

1. **`main.py` — refactor de `create_user`**: capturar ANTES de insertar user.
   Antes: create_user → sensor.capture (si segfault → user huérfano).
   Ahora: curp_exists check → capture → validar quality → create + template.
   Justifica bug de "agrega usuario aunque no leyó dedo".

2. **`storage.py` — nuevo helper `curp_exists(curp) -> bool`**: SELECT sin
   INSERT para validar duplicado antes de pedir el dedo.

3. **`capture.py` — inline el FPrint.Context en `capture()`**: el bug
   fundamental por el que "el lector no leía". La factorización previa
   (`_open_device` retornaba solo `dev`) dejaba a `ctx` local salir de scope
   → Python GC lo liberaba → libfprint segfaulteaba en `capture_sync`.
   Fix: crear ctx inline y mantenerlo vivo hasta después de `close_sync()`.
   Detalle completo en `project_biocheck_libfprint_ctx.md`.

4. **`main.py` — overrides temporales**:
   - `NFIQ2_MIN_QUALITY = 0` (default 40) — porque `nfiq2` binary en la imagen
     está roto (falta `libdb_cxx-5.3.so`; la imagen se construyó con la URL
     404 del .deb viejo antes del fix de Tristan en main). Sin este override
     todo enroll da 422 (quality=0 < 40).
   - `MATCH_THRESHOLD = 30` (default 10) — porque threshold 10 era muy laxo,
     cualquier dedo pasaba. Con 30 y matcher endurecido, se equilibra.

5. **`matcher.py` — type check agregado**: `if pm.type != 0 and gm.type != 0
   and pm.type != gm.type: continue`. Filtra minucias del tipo equivocado
   (termination vs bifurcation). Distancia y ángulo quedaron en originales
   (20px / 15 de 255) tras probar valores más estrictos que causaban false
   negatives del propio dedo.

## Datos empíricos del matcher placeholder (Alan enrolado con índice izq)

Templates: 75 minucias (40 termination, 18 bifurcation, 17 unknown), quality=41.

| Dedo | Score (varias muestras) | Threshold=30 |
|---|---|---|
| Índice izquierdo (enrolado) | 34, 36, 38 | ✅ |
| Pulgar u otros | 5, 7, 14, 15, 16 | ❌ |
| Dedo medio | 38 (una vez) | ⚠️ false positive |
| Índice DERECHO (dedo similar en simetría) | falso positivo a veces | ⚠️ |

**Conclusión honesta:** el matcher placeholder NO puede separar dedos
simétricos o del mismo hand (índice izq vs índice der). Necesita bozorth3
o matcher comercial. Documentado ya como límite conocido en CLAUDE.md.

## Estado técnico del sensor U.are.U 4500

- USB VID:PID `05ba:000a`, driver libfprint `uru4000`, se re-enumera con
  cierta frecuencia (Bus 3 Device 5→6→7 durante la sesión).
- **Tiene protección térmica**: tras muchas capturas rápidas seguidas da
  `Device disabled to prevent overheating`. Dejar descansar ~1 min.
- `libfprint-tod: shared_drivers should be NULL` — error grave del driver
  que puede tumbar el worker; suele aparecer tras el overheat.
- Enum vía `FPrint.Context().get_devices()` funciona; solo aparece el
  U.are.U (el Goodix interno del laptop no lo agarra libfprint).
- Imagen capturada: 375×283 @ 500 DPI aprox; ~336-420 bytes de FMD.

## `nfiq2` binary en la imagen actual

Instalado por el Dockerfile pero **NO corre** — falta `libdb_cxx-5.3.so`
(Berkeley DB C++ 5.3, no está en Ubuntu 22.04). También le faltaría
`libwebp6`. Instalar deps es rabbit hole. La solución correcta es rebuild
con Dockerfile fixeado en working tree (que ya tiene URL correcta del .deb).

## Estado de git en `/home/richer/Projects/biocheck`

- Branch: `alanvaldez070726`, sincronizado con `origin/main` (Clee-es-com).
- Working tree modificado (no commiteado):
  - `bio_api/Dockerfile` — fixes NBIS/FingerJet de Alan (heredados 2026-07-17)
  - `bio_api/requirements.txt` — quita PyGObject
  - `bio_api/app/main.py` — fixes de sesión (create_user refactor + overrides)
  - `bio_api/app/storage.py` — curp_exists helper
  - `bio_api/app/capture.py` — inline ctx (fix segfault)
  - `bio_api/app/matcher.py` — type check + log.info scores
- Sin push. Los fixes de Alan del Dockerfile SIGUEN sin llegar al remoto.

## Pendientes al reanudar

1. **Bozorth3 real** — editar Dockerfile para `COPY bozorth3` de NBIS builder,
   rebuild, reemplazar matcher.py placeholder por shell a bozorth3.
2. **Rebuild imagen con Dockerfile fixeado** — pone nfiq2 con deps
   correctas, quita necesidad del override NFIQ2=0, y persiste los fixes.
3. **Considerar re-enrolamiento con múltiples capturas** — el template
   actual es de una sola captura. Sistemas reales piden 3-5 y hacen
   consenso, mejorando discriminación.
4. **El "modo kiosk normal" no funciona** (Alan reportó). Solo el LiveMode
   del AdminPanel jala. Revisar `tablet-app/src/App.jsx` y el layout normal.
5. **Push del branch** cuando Alan lo pida (feedback_no_push_sin_pedir).

## Reglas operativas aprendidas hoy

- `docker cp` a container corriendo persiste cross-`docker restart` pero
  NO cross-`docker compose down/up --build` (recrea container desde imagen).
- Container NO tiene `sqlite3` CLI ni `curl`; usar Python inline
  (`docker exec ... python3 -c ...`).
- Regla non-negotiable de CLAUDE.md: NO tocar `.env` (hook bloquea).
  Composición sqlite/env va inline en docker exec o al usuario.

**Why:** sesión intensiva de validación de hardware que descubrió bugs no
triviales (ctx-lifetime + orphan user + placeholder matcher inaceptable).

**How to apply:** al retomar biocheck, releer este archivo primero para
saber qué está deployado vía docker cp vs qué está en la imagen. Los fixes
son frágiles hasta rebuild.

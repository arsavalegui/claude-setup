---
name: Bug de ctx-lifetime en libfprint+PyGObject (biocheck)
description: FPrint.Context debe permanecer vivo durante toda la operación con un device, o el garbage collector de Python segfaultea el proceso. Aplica a bio_api Python y probablemente al TS sidecar.
type: project
originSessionId: 74f31476-d291-4bbe-ba4d-77680bc5eb37
modified: 2026-09-06T07:23:08.700Z
---
**Bug encontrado 2026-07-27 en `bio_api/app/capture.py`.**

> **Actualización 2026-09-06:** causa raíz real no es el GC sino el assert de `shared_drivers` de libfprint al crear un segundo `Context` en el mismo proceso. Fix vigente y mergeado (PR #38): singleton de `FPrint.Context` + lock en `capture.py`. Lo de abajo queda como historia; no reintroducir un Context por llamada.

Patrón que **crashea el worker uvicorn** al llamar `POST /admin/users` o
`POST /capture`:

```python
def _open_device(self):
    ctx = FPrint.Context()      # variable LOCAL
    devices = ctx.get_devices()
    dev = devices[0]
    dev.open_sync()
    return dev                  # ctx sale de scope y Python lo puede GCear

def capture(self):
    dev = self._open_device()   # ctx ya fue liberado por GC
    image = dev.capture_sync(True)  # ← SEGFAULT (device huérfano de ctx)
```

**Síntomas en logs:**
- `libusb: warning [libusb_exit] application left some devices open`
- Worker uvicorn reinicia por `restart: unless-stopped` a los ~3s del POST
- Ningún log de `POST /admin/users` (la línea de response nunca se escribe)
- Combinado con el bug de "create user antes de capturar" → user huérfano en BD

**Fix (aplicado en el working tree, NO en la imagen):**
Inline la creación del Context DENTRO de `capture()`, no en un helper que
retorna solo el device. Así ctx vive hasta después de `close_sync()`:

```python
def capture(self):
    import gi
    gi.require_version("FPrint", "2.0")
    from gi.repository import FPrint
    ctx = FPrint.Context()      # vive por toda la función
    dev = ctx.get_devices()[0]
    dev.open_sync()
    try:
        image = dev.capture_sync(True)
        ...
    finally:
        dev.close_sync()
```

**Cómo confirmarlo:** en un `python3 -c` dentro del container, replica el
patrón de helper + local var → crashea; inline → funciona.

**Why:** libfprint (via GObject) tiene referencias internas que asume el
Context vive tanto como sus devices. PyGObject no traduce esas referencias
al referencing de Python, así que el GC libera el Context y libfprint lo
sigue usando → segfault.

**How to apply:**
- Al tocar código que use libfprint desde Python (biocheck bio_api Python,
  posiblemente el `apps/bio-api/sidecar/capture_agent.py` TS-driven), asegura
  que `FPrint.Context` esté vivo durante toda la operación del device.
- Este bug puede haber estado enmascarado por que "el lector no jala" y no
  como crash — buscar `libusb: application left some devices open` en logs.
- Al hacer capture_agent.py del stack TS, revisar que no repita el mismo patrón.

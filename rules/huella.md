---
paths:
  - "**/huella_interop_poc/**"
---
Delega a `desarrollador` PRIMERO. No hay skill instalada para este stack.

Self-check antes de entregar:
1. `UareU4500.capture()` debe abrir, capturar y cerrar el dispositivo dentro del MISMO thread del request (FastAPI threadpool). Nunca mantener el objeto libfprint vivo entre threads: GLib es thread-bound y revienta sin traceback.
2. Cualquier endpoint que toque el sensor va como `def`, no `async def`, para correr en el threadpool y no en el loop de asyncio.
3. FingerJet produce Compact Card (header de 24 bytes), no General Record (28 bytes); el parser en `bio_api/app/matcher.py` y `tools/capture_debug.py` usa offsets de Compact Card verificados con hexdump, no los de la ISO estándar.
4. El matcher (`matcher.py`) es un placeholder de alineación por traslación, NO es MINEX-compliant; `MATCH_THRESHOLD=10` en `.env.example`.
5. Levantar con `./scripts/up.sh` (valida `.env`, el lector USB, build si hace falta, espera healthcheck); apagar con `./scripts/down.sh`, `--purge` borra datos y hay que preguntar antes de usarlo.
6. Versiones fijas siempre en `requirements.txt`/`package.json`, nada de `:latest` ni `^`; `.env` trae secretos reales, no tocarlo sin que el usuario lo pida, y si agregas variable nueva actualiza `.env.example`.
7. Si el contenedor no detecta el lector, revisa primero `lsusb | grep 05ba` en el host y la regla udev `/etc/udev/rules.d/60-uareu.rules` (`TAG+="uaccess"`) antes de tocar el código.

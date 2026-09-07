---
name: Proyecto huella_interop_poc (Framework Bot — módulo identidad)
description: PoC de control de asistencia biométrico con UI admin, plantillas ISO 19794-2, ubicación, stack y decisiones clave
type: project
originSessionId: a7395675-6219-4b86-bdec-40b24c28caa7
modified: 2026-09-06T07:24:14.836Z
---
**huella_interop_poc** es el módulo de identidad biométrica del Framework Bot.
Hermano de `lemut_n8n` (chat). Control de asistencia con huella + geolocalización.

- **Path local:** `/home/richer/Projects/huella_interop_poc`
- **Repo:** `arsavalegui/huella_interop_poc` (PÚBLICO en GitHub desde 2026-06-29)
- **CLAUDE.md del proyecto:** muy completo, leerlo SIEMPRE al empezar.
- **2026-09-06:** `MATCH_THRESHOLD` en código es 10 (no 40 como decía esta nota). Rule file con los gotchas verificados: `~/.claude/rules/huella.md`.
- **Docs generadas:** `docs/RESUMEN.md`, `docs/ARQUITECTURA.mmd`,
  `docs/FLUJO_CLOCK.mmd`, `docs/MODELO_DATOS.mmd` (mermaid — un diagrama
  por archivo, mermaid no acepta múltiples en el mismo `.mmd`).

### Estado al cierre de sesión 2026-05-31

Versión `0.2.1`. Funcional end-to-end:
- 1 usuario enrolado (Alan Valdez Savalegui, CURP VASA020925HQRLVLA1)
- 2 asistencias registradas (entrada+salida con geo Zapopan)
- Modo checador, agregar usuario, registros recientes — todos funcionando

### Hardware

- Lector activo: **HID U.are.U 4500** (USB `05ba:000a`), driver libfprint `uru4000`
- Lector pendiente fase 2: **Suprema BioMini Slim 2** (SDK Xperix Linux, gratis con registro)

### Stack (TODO en Docker)

- `bio_api` (Ubuntu 22, Python 3.10): FastAPI + libfprint + nfiq2 (deb NIST) +
  FingerJet FX OSE (compilado from source) + wsq + OpenCV + SQLite + AES-GCM
- `bio_ui` (Node 20 alpine): React 18 + Vite 5 dev mode (no build prod en PoC)
- Levantar con `./scripts/up.sh`, apagar con `./scripts/down.sh`

### Decisiones técnicas no-obvias (importantes para futuras sesiones)

- **Threading + libfprint**: GLib objects son thread-bound. `UareU4500.capture()`
  abre/captura/cierra dentro del MISMO thread del request (FastAPI threadpool).
  NO mantener device abierto entre threads — segfault sin traceback.
- **FastAPI endpoints sensor-touching = `def`, no `async def`**: para que
  corran en threadpool, no en asyncio loop.
- **FingerJet produce Compact Card** (header 24 bytes), no General Record
  (28 bytes). Parser FMD en `matcher.py` y `tools/capture_debug.py` usa offsets
  Compact Card verificados empíricamente.
- **Matcher Python placeholder con alineación por translación**: score típico
  mismo dedo 15-30. Threshold default 10. NO es MINEX-compliant.
- **MATCH_THRESHOLD=10** (no 40 como decía .env.example viejo).
- **Schema sin migrations**: drop+recreate. Tablas: users(name+curp UNIQUE),
  templates(AES-GCM cifradas), attendance(in/out + ts + lat/lon + score).

### Pendientes mencionados

- **IMMU**: usuario quiere migrar `users` (y posiblemente `attendance`) a
  almacenamiento inmutable (immudb o append-only con hash chain) para cumplir
  requisito de no-modificabilidad. NO está implementado todavía.
- Fase 2: BioMini Slim 2 + SDK Xperix
- Fase 3: cross-vendor matching (interoperabilidad real)
- Matcher MINEX comercial (Neurotechnology / Innovatrics)
- Cumplimiento LFPDPPP: aviso de privacidad + consentimiento

### Doc del asesor

`docs/arquitectura_original.pdf` define la arquitectura objetivo:
multi-hardware, ISO 19794-2:2011 (nosotros producimos 2005, verificar con
autor si es requisito duro), WSQ, matcher MINEX-compliant en cloud.

**Why:** este proyecto es la implementación del PoC del Framework Bot fase
identidad. Funcional al cierre, pendiente IMMU y hardware secundario.

**How to apply:** cuando el usuario mencione huella, biometría, control
de asistencia, Framework Bot identidad, U.are.U, BioMini, ISO 19794-2,
asume este contexto. SIEMPRE leer el `CLAUDE.md` del proyecto antes de
hacer cambios técnicos grandes — tiene las decisiones detalladas.

### Estado al cierre 2026-07-17

Los contenedores están **detenidos** (`docker compose stop`) para no chocar
puertos 8000/5173 con el proyecto hermano `biocheck`. Preservan volúmenes;
para revivir: `cd ~/Projects/huella_interop_poc && docker compose start`.

Este PoC es **la referencia funcional** cuando `biocheck` (el spin-off del
equipo TG-VA) falla — su `bio_api` reutilizó código pero introdujo bugs.
Diferencias clave que aquí SÍ funcionan y allá NO:
- `UareU4500.info()` lee `get_driver()` **sin abrir el device** (allá abren y
  libusb queda con referencia colgada → segfault de worker uvicorn).
- WSQ vía `import wsq` (plugin Pillow, pip) — allá intentaron `cwsq` de NBIS
  y toda la cadena de compilación NBIS es un dolor.
- FingerJet: binario está en `dist/FingerJetFXOSE/build/fjfxSample` (no en
  `build/bin/`) y requiere copiar libs `libFJFX.so`, `libFRFXLL.so` con
  `LD_LIBRARY_PATH`.

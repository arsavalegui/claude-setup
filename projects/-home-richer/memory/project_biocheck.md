---
name: Proyecto biocheck (Clee — spin-off de huella_interop_poc)
description: Sistema de asistencia biométrico. Repo movido a Clee-es-com/biocheck; monorepo con apps/bio-api (TypeScript nuevo) + tablet-app. bio_api/ Python legacy sigue existiendo.
type: project
originSessionId: c45ce674-4883-4f42-8d74-348f29b7bcbc
modified: 2026-09-06T07:23:05.828Z
---
**biocheck** es el spin-off del equipo Clee de `huella_interop_poc`.

> **Corrección 2026-09-06 (verificada por documentador contra el CLAUDE.md del repo):** `bio_api/` (Python) SIGUE siendo el backend real en producción; `apps/bio-api/` (TS) aún no está validado con hardware. Lo de "el API vivo es TS" abajo está obsoleto. El fix de `FPrint.Context` ya está mergeado (PR #38) como singleton + lock en `capture.py`; ya no hay fixes vivos solo vía `docker cp`. Rule file: `~/.claude/rules/biocheck.md`.

- **Path local:** `/home/richer/Projects/biocheck`
- **Repo actual:** `Clee-es-com/biocheck` (PRIVADO). **OJO:** antes era
  `TG-VA/biocheck`, se movió/renombró alrededor del 2026-07-22. Si el remote
  local todavía apunta a TG-VA, actualízalo:
  `git remote set-url origin https://github.com/Clee-es-com/biocheck.git`
- Tristan y Aaragon-clee-es contribuyen; existen branches `tristan-react`,
  `jm/refactor`, `aaragon-clee-es/creating_backend_solution`.

### Estructura actual (post refactor a TS del 2026-07-23)

Monorepo:
- `apps/bio-api/` — **API en TypeScript** (nueva). Node, kysely, arquitectura
  hexagonal (domain/application/infrastructure), tests con vitest, contract
  tests, sidecar `capture_agent.py`, Dockerfile propio. **Este es el API vivo.**
- `apps/bio-api/sidecar/capture_agent.py` — el "fingerprint agent" que antes
  no existía ya está aquí.
- `tablet-app/` — React+Vite, corre nativo `npm run dev` en :5173 (sin Docker).
- `bio_api/` — **legacy Python/FastAPI** (aún en repo, Dockerfile con fix
  NFIQ2 URL en main). NO editar salvo pedido explícito; su reemplazo es
  `apps/bio-api/`.
- `db/` — Postgres con migraciones (`20260715...`, `20260717...`), scripts
  backup/restore/purge, probes SQL.
- `docs/` — runbooks (backup-restore, cutover), services docs, interfaces.
- `tools/biometric-binaries/Dockerfile` — imagen builder para NBIS/FingerJet.
- `docker-compose.yml` a nivel raíz (nuevo).
- `scripts/up.sh`, `scripts/down.sh`, `scripts/ci.sh` a nivel raíz.
- `.claude/` con agents (pr-review-backend, coordinator, frontend, reporter)
  y hooks (block-sensitive-access.sh) — cuidado con los hooks.

### Branch `alanvaldez070726` (del usuario)

Al 2026-07-27, sincronizado con `origin/main` (`d08eba5`), con estos archivos
modificados en working tree sin commitear (heredados desde 2026-07-17):
- `bio_api/Dockerfile` (23+/21- líneas) — fixes NBIS/FingerJet/PyGObject
- `bio_api/requirements.txt` (2+/1-)

**Relevancia dudosa:** Como `bio_api/` es legacy y el API vivo migró a
`apps/bio-api/` (TS), estos fixes al Dockerfile Python podrían ya no
importar. Preguntar antes de commitearlos o descartarlos.

**El branch NUNCA se pusheó al remoto** hasta el 2026-07-27.

### Bugs históricos

- **`bio_api/app/capture.py:79-91` `info()`** crasheaba el worker uvicorn
  al llamar `/device/status`. Verificar si sigue vivo o si el refactor a TS
  lo dejó fuera. En el API TS revisar `apps/bio-api/src/modules/biometrics/`.

### `.env` local (no en git)

`openssl rand -hex 32` para `API_KEY` y `ENCRYPTION_KEY`. En `tablet-app/.env`
también `VITE_API_URL` y `VITE_API_KEY`. Con el nuevo `docker-compose.yml`
raíz puede haber nuevo `.env` a nivel top-level también (verificar).

**Why:** repo compartido del equipo Clee; Alan contribuye en su branch.
El equipo hizo un refactor mayor a TypeScript (PR #23 `jm/refactor`
mergeado 2026-07-23) que cambia radicalmente el stack backend.

**How to apply:**
- Cuando el usuario mencione biocheck, Clee, tablet-app, capture agent,
  bluetui, WebSocket 8765, tap-tap logo, asume este contexto.
- **NO ofrecer push/commit sin pedido explícito** (feedback ya guardado).
- **Sin co-author en commits de biocheck** (feedback_no_coauthor_biocheck).
- **NO tocar `apps/bio-api/` ni `bio_api/`** salvo pedido explícito.
- Para levantar biocheck hay que apagar huella_interop_poc primero (puertos
  8000/5173 compartidos).
- Ahora hay `docker-compose.yml` raíz — puede que `scripts/up.sh` lo use.

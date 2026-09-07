---
paths:
  - "**/biocheck/**"
---
Delegar a desarrollador; revisor independiente antes de entregar.

Self-check antes de responder:
1. `FPrint.Context` es un singleton a nivel de módulo en `bio_api/app/capture.py` (`_get_context()` + `_ctx_lock`). Nunca crear un `Context` nuevo por request o en un helper aislado: libfprint solo tolera un registro de drivers TOD por proceso y crashea con `shared_drivers should be NULL`.
2. `bio_api/` (Python) sigue siendo el backend que usa el `tablet-app` en producción. `apps/bio-api/` (TypeScript) es un port en progreso, todavía sin validar contra el lector físico — no asumir que ya reemplazó al Python.
3. `matcher.py` es un placeholder de minucias, no MINEX-compliant. No tratar un score alto como prueba de identidad sin considerar que puede fallar entre dedos simétricos (bozorth3 o un matcher comercial sigue pendiente).
4. Commits sin `Co-Authored-By: Claude`; mensaje en español natural, primera persona, corto, como lo escribiría Alan — nunca tono de release notes.
5. No hacer push ni commit sin que Alan lo pida explícitamente, y no cambiar arquitectura sin confirmar: el repo es de Clee-es-com, compartido con Tristan y Aaragon-clee-es.
6. `PUBLIC_BASE_URL` (leída en `main.py`, default `http://localhost:8000`) debe exportarse antes de `docker compose up` cuando hay un tunnel activo; sin ella, los links de firma DVI/DAD en los correos salen apuntando a localhost.

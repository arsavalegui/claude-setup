---
name: sesi-n-biocheck-2026-08-28-rebase-firma-electr-nica-dvi-dad
description: Rama rebaseada sobre main; flujo completo de documentos por correo con firma electrónica y PIN; registro con CURP; huérfanos del WIP viejo borrados por orden de Alan (diseño de Tristan manda).
metadata: 
  node_type: memory
  type: project
  originSessionId: 53ddf134-39d3-4000-8a0d-b3c0c4325da9
  modified: 2026-09-03T01:54:41.365Z
---

Estado al cierre de la sesión (supersede lo operativo de
[[Sesión biocheck 2026-07-27 — fixes en caliente + hallazgos matcher]] y
[[Sesión biocheck 2026-07-28 — enroll multi-captura + estabilidad matcher]] —
aquellos fixes YA están commiteados y horneados en la imagen).

## Git — RESUELTO 2026-09-02
- **PR #38 MERGEADO a main (f9a860f)**: todo el paquete (CURP + 3 lecturas +
  firma DVI/DAD + checador PIN dos fases + puerto de correo + fixes del
  review de arquitectura + fix NBIS/FingerJet en CI).
- PR #36 de Tristan (NIP admin) se mergeó antes (self-merge); el conflicto
  con constants.js y el rename api.js→kioskApi.js se resolvió en el merge.
- Review de arquitectura de @bug-clee-es en PR #38: decisión A1 asentada =
  (a) merge como base funcional + regla (c) lo nuevo aterriza en apps/bio-api
  TS. Seguimiento aceptado: ApiClients por módulo y borrar fachada kioskApi,
  colapsar modules/attendance, migración dbmate de doc_signatures con
  expires_at, tests multi-captura+rollback, css PinEntryScreen, persistir
  bloqueo kiosko, capa services en Python o port TS.

## Decisión de Alan (2026-08-28)
El diseño de Tristan manda: borré los huérfanos del WIP viejo
(PinPromptScreen.jsx, AddUser.jsx multi-captura, VerifyUserModal.jsx y sus
constantes). Recuperables del historial git. Los endpoints backend quedan.

## Flujo de firma electrónica DVI/DAD (nuevo, funcionando E2E)
- `bio_api/app/documents.py`: DVI + DAD en PDF (fpdf2, texto latin-1, plantilla
  general de los mockups en ~/Downloads/DVI.pdf y DAD.pdf). La huella va como
  template_id + SHA-256 del ciphertext, NUNCA imagen ni plantilla.
- Tabla `doc_signatures`: token-capability 256 bits, PENDIENTE→FIRMADO, log_id,
  sello UTC, IP, SHA-256 de cada PDF firmado.
- `POST /admin/users/{id}/send_documents`: regenera access_pin + manda correo
  (HTML con botón). Página pública `/docs/firma/{token}` sin API key.
- Al enrolar (`POST /admin/users`) el correo sale AUTOMÁTICO (PIN + firma).
- Al firmar: copias firmadas por correo + user pasa a VERIFICADO solo
  (la posesión del token de correo prueba el email; el verification_pin de
  6 dígitos quedó vestigial).
- Registro ahora pide CURP (opcional en API para no romper clientes; el form
  del tablet la manda obligatoria, regex oficial 18 chars).

## Correo (Resend)
- RESEND_API_KEY en `.env` raíz (Alan la puso). Cuenta registrada con
  alansavalegui@clee-es.com → en modo prueba SOLO entrega a ese correo.
- Gotchas: Cloudflare delante de api.resend.com rechaza el UA default de
  urllib con 403 "error code: 1010" → email_sender manda User-Agent propio.
- Cae en spam: remitente onboarding@resend.dev + link trycloudflare. Fix
  pendiente: verificar clee-es.com en Resend. Dominio YA creado en Resend
  (id de38a014-f449-4e89-a744-9e5f719e8251) esperando 3 registros DNS
  (guardados en scratchpad y en el chat). El DNS de clee-es.com está en la
  cuenta Cloudflare de OTRA persona (Alan no sabe quién es el admin; su
  cuenta CF está vacía) — pendiente identificar admin.

## Infra
- Links públicos vía quick tunnel (container `biocheck-tunnel`, docker run
  --network host cloudflared). URL efímera; el container bio_api corre con
  PUBLIC_BASE_URL seteada por shell al hacer `docker compose up -d`
  (`PUBLIC_BASE_URL=<tunnel> docker compose up -d bio_api`) — un recreate sin
  esa var regresa a localhost y los correos salen con link muerto.
- Imagen `biocheck/bio_api:0.2.0` rebuildeada: fixes julio + fpdf2 + flujo
  documentos horneados. `nfiq2` SIGUE faltando en la imagen (cwsq y fjfx sí
  están) → override NFIQ2_MIN_QUALITY=0 en main.py sigue siendo necesario.
- User demo "alan" (737f0692) apunta a alansavalegui@clee-es.com y ya firmó
  (log BIOCHECK-DC58B80A-11364).

## Pendientes
1. Prueba con dedo: enrolar user nuevo desde el tablet (nombre+CURP+correo)
   y validar cadena completa. El correo debe ser el de clee-es.com hasta
   verificar dominio.
2. DNS Resend (3 registros en Cloudflare del admin desconocido) + EMAIL_FROM
   a biocheck@clee-es.com + DMARC.
3. Tunnel fijo con dominio propio en vez de trycloudflare.
4. Commit del working tree cuando Alan lo pida.
5. Re-portar multi-captura al UserEnrollment de Tristan (backend listo).
6. nfiq2 en imagen + quitar overrides; bozorth3 sigue pendiente.

**Why:** sesión larga con demo funcionando; mucho estado vive en env vars de
shell y containers que un restart mal hecho rompe.

**How to apply:** al retomar, leer este archivo antes de recrear containers
(PUBLIC_BASE_URL) y antes de tocar el flujo de correo (gotchas Resend).

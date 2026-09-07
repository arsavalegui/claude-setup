---
name: repos-p-blicos-por-defecto
description: Todos los repos que creemos deben ser públicos; verificar antes que no haya secretos commiteados
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9c1d9717-cde0-4b97-870c-5cc0d95ee83f
  modified: 2026-08-30T03:05:14.519Z
---

El usuario quiere que **todos los repos que creemos sean públicos** — no hay problema con eso. Dicho el 2026-08-29.

**How to apply:**
- Al crear un repo nuevo con `gh repo create`, usar `--public` (no `--private`).
- Repos personales del usuario (`arsavalegui/*`): públicos. Ya se hicieron públicos `lemut_n8n` y `fhir-agent-poc` el 2026-08-29.
- **SIEMPRE antes de hacer público**: verificar que no haya secretos rastreados ni en el historial: `git ls-files | grep -iE '\.env$|secret|\.key$|tunnel'` y `git log --all --name-only | grep ...`. El `.env` va en `.gitignore` siempre.

**Excepción:** repos de organización/compartidos con terceros (ej. `Clee-es-com/biocheck`, con Tristan/otros) NO tocar su visibilidad sin confirmar — no son solo del usuario.

**CUIDADO Slalom (empleador):** el usuario tiene su correo de Slalom vinculado a su cuenta de GitHub y en el perfil aparece Slalom como empresa. Solo hacer públicos repos **personales** (`arsavalegui/*`) — NUNCA nada relacionado a Slalom ni a su trabajo. Verificar siempre que (1) el repo sea de la cuenta personal, no de una org de Slalom, y (2) los commits estén firmados con Gmail personal (`ar.savalegui@gmail.com`), no con el correo de Slalom. Confirmado 2026-08-29: lemut_n8n y fhir-agent-poc son personales, commits con Gmail personal, cero huella de Slalom.

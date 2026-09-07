---
name: mantener-readmes-y-docs-actualizados
description: Cada cambio importante de arquitectura debe reflejarse en el README del repo (y notas de Obsidian) en el mismo momento
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9c1d9717-cde0-4b97-870c-5cc0d95ee83f
  modified: 2026-08-30T01:18:27.410Z
---

El usuario quiere que los **READMEs y toda la documentación se mantengan siempre al día**: cada vez que hagamos un cambio importante de arquitectura o feature, actualizar el README del repo en ese mismo momento, sin que lo pida. Dicho el 2026-08-29.

**How to apply:**
- Al terminar un cambio de arquitectura/feature relevante (nuevo servicio, nuevo flujo, cambio de stack, nueva capa), actualizar el `README.md` del repo como parte del mismo trabajo (diagrama, secciones, estructura del repo, cómo correr).
- Incluir también las notas de Obsidian del proyecto (`~/Notes/Projects/`) cuando aplique — ver [[Vault de Obsidian]].
- Commitear la actualización del README junto o justo después del cambio.
- No dejar el README describiendo una versión vieja del sistema.

**Ejemplo (2026-08-29):** el README de fhir-agent-poc no mencionaba el buzón de auto-ingesta ni el selector de acceso a tablas (se agregaron después); se actualizó diagrama + secciones + estructura y se pusheó.

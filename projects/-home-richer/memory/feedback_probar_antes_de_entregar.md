---
name: probar-de-verdad-antes-de-decir-ya-qued
description: "El usuario exige tests reales E2E con evidencia (respuestas/outputs reales), no solo \"ya está arreglado\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9c1d9717-cde0-4b97-870c-5cc0d95ee83f
  modified: 2026-08-27T23:54:05.682Z
---

Cuando arregle o construya algo, NO reportar "ya quedó" sin haberlo
ejercitado de verdad. El usuario quiere ver evidencia: las respuestas
reales del sistema, no mi afirmación de que debería funcionar.

**Why:** El 2026-08-27 en `lemut_n8n` entregué dos veces con "ya quedó,
pruébalo" y el usuario encontró bugs al primer mensaje ambas veces
(params vacíos de Postgres, parse_mode de Telegram). Me dijo: "necesito
que le hagas tests y que compruebes... asi necesito que me hagas tests
robustos no solo que me digas q esta ok". Construí un simulador E2E
(inyectar updates reales al webhook + leer respuestas de execution_data)
y con eso salieron más bugs que los unit tests no veían.

**How to apply:**
- Antes de entregar: buscar la forma de ejercitar el camino completo
  (simular la entrada real del sistema, no solo unit tests de la lógica).
- Reportar con outputs/respuestas reales citadas, no con "debería funcionar".
- Los unit tests de lógica pura no bastan cuando hay capas de integración
  (n8n, Telegram, BD): cada capa nueva tuvo su propio bug.
- En lemut_n8n ya existe la infraestructura: [[Framework Bot Fase agenda (lemut_n8n) — plan y decisiones]],
  `scripts/sim_telegram.py` y `scripts/test_e2e.py`.

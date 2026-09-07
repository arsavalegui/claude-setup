---
name: revision-cruzada-agentes
description: Quien escribe código NUNCA lo revisa; siempre otro agente (revisor/tester) verifica antes de entregar
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b2d7b7e1-ee81-4804-9c16-0299910fa3f1
  modified: 2026-08-30T10:17:41.072Z
---

Regla del usuario (2026-08-30): el agente que implementa código (ej. `desarrollador`, `n8n-especialista`, `agente-datos`) NUNCA debe ser el mismo que lo revisa. Siempre pasar el trabajo por un segundo agente independiente (`revisor` para código, `tester` para verificación funcional) antes de dar algo por entregado.

Qué debe buscar la revisión:
- Regresiones y problemas de lógica.
- Supuestos que el implementador pasó por alto u olvidó.
- Reuso: si ya existe una función que hace algo, usarla, no crear otra (DRY).
- Mejores prácticas y consistencia con el código existente.

**Why:** para eso tiene varios agentes — separación de roles garantiza calidad; el que escribió el código está ciego a sus propios supuestos.

**How to apply:** en todo flujo con implementación delegada, encadenar SIEMPRE implementador → `revisor` (y/o `tester` con evidencia real, ver [[probar-antes-de-entregar]]). Si yo (orquestador) implemento inline, igual mandar el diff a `revisor` antes de reportar terminado.

---
name: feedback-test-inventory-excel
description: "Entregables (Excel de tests, docs, comentarios) SIEMPRE en inglés; además, cada vez que se escriban tests generar un xlsx plano en ~/Downloads"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f1670d69-ad9d-480a-8895-41c9ed31f25e
  modified: 2026-08-06T17:31:04.991Z
---

Dos reglas que Alan pidió explícitamente como recurrentes:

**1. Todo el contenido de los entregables va en INGLÉS**, no en español. Aplica al
Excel, documentos, comentarios de código, descripciones de MR — cualquier
artefacto que se genere. La conversación con él sigue en español; lo que cambia es
el contenido de los archivos. (Corrigió un Excel que se generó en español y pidió
"siempre pon todo el contenido en inglés".)

**2. Cada vez que se escriban tests, generar además un Excel plano** (`.xlsx`, una
hoja, encabezados en negritas, sin formato elaborado) con el inventario, guardado
en `~/Downloads/` con nombre del proyecto/story (ej. `aura_7506_tests.xlsx`).

Columnas que funcionaron: File | Test | Type | What it verifies | Result.
Tipos usados: Behavior, Regression (guard), Concurrency, Integration (module).

**Why:** Alan comparte estos inventarios en juntas y MRs con gente que no lee
código y que trabaja en inglés (el equipo de Stryker: Ahmar, Gavin, Jeiner). El
Excel es el formato que ya usan para reportar.

**How to apply:** después de correr los tests y confirmar que pasan, generar el
xlsx con openpyxl (instalarlo en un venv del scratchpad, no en el repo). Poner el
resultado real de la corrida, no un "PASS" asumido.

Relacionado: [[project-aura-7506-spike]] [[user-profile]]

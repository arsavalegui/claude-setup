---
name: No proponer push ni commits sin pedirlo
description: El usuario no quiere que ofrezca push/commit a git ni hacer cambios al proyecto cuando solo pidió levantar o inspeccionar
type: feedback
originSessionId: c45ce674-4883-4f42-8d74-348f29b7bcbc
modified: 2026-08-27T22:51:16.546Z
---
Cuando el usuario pide "levanta", "prueba", "analiza", "corre X" etc., NO
proponer commits, push a remoto, ni cambios de código como parte de la
respuesta, aunque el proyecto tenga bugs que descubras al intentarlo.

**Why:** El 2026-07-07 me pidió levantar `biocheck` para ver si reconocía el
lector. El build falló por un bug del Dockerfile y yo le propuse arreglar
código + preguntarle si commitear a `main` o a un branch. Él respondió
"pq push?? solo queria que levantaras el proyecto ... no hay que hacer
cambios ni nada aun". El push no era parte del pedido.

**How to apply:** Distinguir "levantar/probar/analizar" (read-only y run-only)
de "arreglar/cambiar" (write). Si encuentro un bloqueador al intentar
levantar, reportarlo, proponer el cambio *mínimo* con OK explícito, y NO
mezclar el tema de git/remoto en la propuesta a menos que el usuario lo
pida. Push, commit y branch strategy solo se ofrecen cuando el usuario los
solicita.

**Excepción (2026-08-27):** en `lemut_n8n` el usuario pidió lo contrario:
"hay que ir guardando las cosas que hacemos, darles push y todo". En ese
repo, commitear y pushear sobre la marcha al completar cada pieza de
trabajo, sin preguntar. Mensajes en español natural, sin co-author de
Claude (mismo estilo que biocheck).

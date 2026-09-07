---
name: delegar-siempre
description: "Regla permanente (2026-09-04) — toda tarea va a subagentes; el hilo principal solo coordina, investiga cosas chicas y responde preguntas"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fb462068-6f7a-4dea-986a-db962fc635de
  modified: 2026-09-05T05:18:19.749Z
---

Toda instrucción del usuario que implique trabajo (código, tests, n8n, biocheck, huella, lemut, investigación grande, docs) se delega a subagentes desde el primer momento. El hilo principal (yo) nunca debe quedar ocupado al 100 %: solo coordino, hago investigaciones chiquitas y contesto preguntas rápidas. Los subagentes pueden a su vez crear mini-agentes para paralelizar más trabajo.

**Why:** El usuario quiere que siempre haya al menos un agente (yo) libre para una pregunta o algo pequeño, y ver a los demás trabajar en paralelo en tiempo real desde agent-flow / Centro de Mando (ver [[project_centro_mando]]).

**How to apply:**
- Al recibir tarea: spawn subagente(s) de inmediato (`desarrollador`, `tester`, `revisor`, `n8n-especialista`, `investigador`, etc., ver [[reference_subagentes]]); prompt autocontenido, reporte <200 palabras.
- Trabajo independiente → varios agentes en paralelo en un solo mensaje (cap 3 concurrentes).
- Yo solo hago inline: lectura de 1 archivo, 1 grep, una pregunta, un status check corto.
- Sigue aplicando [[feedback_revision_cruzada]] (quien escribe no revisa) y [[feedback_probar_antes_de_entregar]].
- Si escasea cuota, los subagentes van en Sonnet/Haiku ([[feedback_token_economy]]).

---
paths:
  - "**/fhir-agent-poc/**"
---
Delega a `agente-datos` PRIMERO. No hay skill instalada para este stack.

Self-check antes de entregar:
1. El POST del agente usa el campo `"texto"` (`api/main.py:38`), no `"pregunta"` ni `"query"`.
2. Suite de pruebas: `docker compose exec api python3 test_agente.py` — corre por `__main__`, sin pytest.
3. El código de `api/` va horneado en la imagen, no montado: tras editar `api/*.py` corre `docker compose up -d --build api`. Solo `config/` y `datos_fhir/` entran por volumen `:ro`.
4. Evaluador contra el golden set (`api/evals/golden.json`): `docker compose exec api python evaluar.py` (flags `--modelo`, `--solo`, `--json`, `--autocheck`).
5. Nunca apuntes `LLM_URL` o `LLM_URL_RESPALDO` a algo fuera de la máquina sin `PERMITIR_LLM_EXTERNO=1` en `.env`, y solo con datos sintéticos (`verificar_llm_externo()` en `agente.py`).
6. Doble barrera de solo-lectura, no relajar ninguna: `validar()` en `agente.py:420` bloquea todo lo que no sea SELECT, y el rol Postgres `fhir_lector` (`sql/roles.sql`) es la segunda barrera en la base. Tampoco borres filas a mano sin respaldo: ya pasó un DELETE masivo accidental, recuperable solo porque `ingesta.py` es idempotente vía `ON CONFLICT`.
7. El modelo local (`qwen2.5-coder-fhir:3b` vía Ollama) solo imita los few-shots de `config/fuentes/fhir/reglas.md`, no razona reglas en prosa; cada patrón de consulta nuevo (joins, subconsultas, etc.) necesita su propio ejemplo ahí.

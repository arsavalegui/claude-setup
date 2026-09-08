---
name: project-aura-ci-pipeline
description: "Jobs del pipeline de aura (backend), cuáles fallos son preexistentes y cuáles propios."
metadata: 
  node_type: memory
  type: project
  originSessionId: 4b2d8674-c559-4a43-9e6d-b4ae1dc73dfa
  modified: 2026-08-27T22:15:44.202Z
---

Pipeline del repo `aura` (backend). Corre sobre `refs/merge-requests/<id>/head`,
no sobre tu último push — si alguien aplica una *suggestion* desde la UI de
GitLab, el pipeline evalúa **ese** commit, no el tuyo. Pasó en el MR !41: dos
commits "Apply 1 suggestion(s) to 1 file(s)" metieron una llamada a
`_parse_int_env` sin la función, y el F821 se veía como si fuera mío.

**Jobs y qué revisan:**
- **pre-commit** — kacl/changelog, trailing whitespace, yaml, json5, gitleaks,
  **ruff** (lint + format). Trae autofix en MRs. Es el que truena con errores de
  lint reales.
- **bandit (SAST)** — corre dos veces: `--exit-zero` para el log y otra para el
  reporte, que sí falla. Un hallazgo **High** tumba el job.
- **hadolint** — lintea el `Dockerfile`.
- **Orca SCA** — CVEs de `requirements.txt` y `uv.lock` contra política.

**Fallos PREEXISTENTES en `dev`, no los causa tu MR** (verificado 2026-08-27):
- hadolint `DL3008`: `apt-get install` sin versiones pinneadas, `Dockerfile:10`.
- Orca: 15 CVEs (cryptography, python-multipart, starlette, urllib3, aiohttp) en
  `uv.lock`/`requirements.txt`. HIGH varios.
- bandit low-severity en `voice_conversation.py`, `arize_utils.py`,
  `azure_services.py`, `azure_foundry_client.py` (try/except/pass, subprocess,
  scope de token que parece password).

Si el pipeline sale rojo por esos, **no es tu cambio** — pero el MR igual se ve
rojo, así que conviene decirlo en el MR para que un revisor no te lo achaque.

**Fallos que sí fueron míos y cómo se arreglaron:**
- `hashlib.sha1` → `sha256` (bandit B324 High). Solo acorta llaves de caché, pero
  un hash roto es pregunta recurrente en cada escaneo.
- `random.Random(SEED)` en el benchmark → `# nosec B311`; la semilla fija es el
  punto, los números tienen que reproducirse.
- El `_parse_int_env` faltante de la suggestion.

**Ojo con las suggestions de GitLab:** aplican el cambio pero no traen lo que el
cambio necesita. Después de aceptar una, hacer `git fetch` + correr tests local
antes de asumir que el MR sigue verde.

Relacionado: [[project-aura-7506-spike]] [[feedback-test-inventory-excel]]

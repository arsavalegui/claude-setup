---
name: reference-local-tooling
description: "Herramientas CLI instaladas en la Mac de Alan y su estado (az, terraform, audio)."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9e31707f-d450-49bb-8159-b31020d47f24
  modified: 2026-08-07T15:38:49.050Z
---

Instalado en la Mac de Alan (Apple Silicon, Homebrew en `/opt/homebrew/bin`):
- **azure-cli** `az` 2.88.0 — NO da logs de pipelines de GitLab. **Estado del acceso (verificado 2026-08-07):** Alan se loguea con `alan.valdez@stryker.com` (ojo: su correo git de Stryker, distinto al de Slalom). Tiene **una sola subscription: `Stryker-AIOffice-Scratch`** (`7da262bc-09c3-4804-8c58-9d3ba3edbe22`, tenant Stryker) = ambiente **SCR**. Su RBAC está **scoped a 3 resource groups de la plataforma común**: `rsg-aio-ai-platform-scr`, `aio-app-platform-scr`, `aio-fde-scr`. **NO tiene acceso al RG de AURA (`aio-aura-scr`)** → `az resource list` y `az redis show` ahí devuelven `AuthorizationFailed`, que Azure regresa ANTES de checar existencia, así que NO sirve para confirmar si un recurso existe. Para verificar infra de AURA necesita rol Reader sobre `aio-aura-scr` (pedírselo a Gavin). No tiene DEV ni QA.
- **terraform** 1.15.8 — vía `hashicorp/tap/terraform` (el core de Homebrew ya no lo trae por licencia BSL). Para validar sin tocar nube: `terraform init -backend=false` + `terraform validate`. Correr en COPIA (scratchpad) para no modificar `.terraform.lock.hcl` versionado (el análisis es read-only).
- **whisper-cli** + modelos `ggml-small.en.bin` (solo inglés) y `ggml-small.bin` (multilingüe) en `~/.whisper-models/`. Ver [[reference-meeting-transcription]].
- **SwitchAudioSource** (switchaudio-osx) — cambiar dispositivo de salida por CLI: `SwitchAudioSource -c -t output` (actual), `-s "<device>" -t output` (cambiar).

**`glab` 1.115.0 — YA INSTALADO** (verificado 2026-08-30), logueado en gitlab.com como `alan.valdez` (token en keyring). Sirve para `glab mr list/view`, `glab ci list/get -p <id>`, `glab ci trace <job> -p <id>` y `glab api <path>`. OJO: `git fetch` por HTTPS en esos repos falla (`could not read Username`) — usar `glab api .../repository/files/<path urlencoded>/raw?ref=main` para leer archivos del remoto.

NO instalados: `gh`, `code` en PATH (VS Code está en `~/Downloads/Visual Studio Code.app`, abrir con su binario `.../Contents/Resources/app/bin/code -n <dir>`).

Relacionado: [[project-aura-7506-spike]] [[reference-live-audio-capture]]

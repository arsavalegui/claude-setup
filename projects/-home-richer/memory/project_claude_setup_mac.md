---
name: project-claude-setup-mac
description: "Desde 2026-09-08 ~/.claude de esta Mac es clon del repo privado github.com/arsavalegui/claude-setup (rama master); qué se ajustó aquí, qué NO se ha commiteado y cómo sincronizar."
metadata:
  type: project
---

`~/.claude` en esta Mac (D99MFVLWP6) trackea `https://github.com/arsavalegui/claude-setup` desde 2026-09-08 (`gh` logueado como `arsavalegui`). La máquina canónica del repo es la Linux `richer`; su memoria vive en `projects/-home-richer/memory/` y la de esta Mac en `projects/-Users-alan-valdezsavalegui/memory/` (ignorada por git a propósito).

**Ajustes locales ya commiteados (a32b8c0, sin push):** `bootstrap/machines/D99MFVLWP6.env` (MIC_SOURCE=corsair, SERVICES_ENABLE="agent-flow centro-mando"), `settings.json` mergeado (allow-list de esta Mac + `defaultMode: default`, sin bypass porque es laptop del trabajo), `bootstrap/tools/meeting-recorder-mac/` (copia del grabador de `~/.meeting-recorder`).

**Why:** Alan quiere la misma config en las dos máquinas y que los cambios viajen. El clasificador de permisos bloquea a Claude para copiar memorias al directorio canónico y para correr `bootstrap.sh` completo (npm -g, binarios, launchd), así que esas dos cosas las corre Alan.

**How to apply:**
- Sin trackear todavía: `agents/aura-*.md` (6 agentes de Stryker) y las memorias de esta Mac. Para que viajen: `cp -n projects/-Users-alan-valdezsavalegui/memory/*.md projects/-home-richer/memory/` (y mergear MEMORY.md a mano), `git add agents/aura-*.md`, commit, push. Revisar antes que no vaya PII ni secretos.
- Cambios de config aquí: `cd ~/.claude && git add -A && git commit` (mensaje en español, sin co-author) y `git push` solo si Alan lo pide ([[feedback_no_push_sin_pedir]] del repo).
- Traer cambios de la otra máquina: `git pull` y luego `bootstrap/bootstrap.sh` (idempotente; copia la memoria canónica al slug de esta Mac sin sobreescribir).
- El grabador lee `MIC_SOURCE` de ese perfil; ver [[reference-live-audio-capture]].

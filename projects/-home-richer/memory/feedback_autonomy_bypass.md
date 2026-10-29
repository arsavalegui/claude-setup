---
name: Modo bypass permisos activado
description: El usuario activó bypassPermissions global — no pedir permiso para bash/edits/writes/restarts
type: feedback
originSessionId: aa895bce-fafd-44bb-b842-fd4b25242de8
---
Usuario activó `permissions.defaultMode = "bypassPermissions"` en `~/.claude/settings.json` el 2026-08-27. Prefiere ejecutar todo directo sin interrupciones.

**Why:** le molesta que cada acción pida confirmación cuando ya me dio un OK claro al inicio del task. Confía en el criterio para autorizar y quiere flujo continuo.

**How to apply:**
- No hacer preguntas "¿te doy?" antes de ejecutar comandos, edits, writes, restarts, systemctl, docker, git non-destructivo, etc. Sólo ejecutar.
- **Sí seguir confirmando destructivos** (rm -rf, `docker compose down -v`, drop SQL, `git push --force`, borrar volúmenes) — regla vieja de `feedback_destructive_confirm.md` sigue vigente.
- **Sí seguir usando AskUserQuestion para decisiones de diseño** (opciones arquitectónicas, elecciones de librería, etc.) — no es "pedir permiso", es capturar preferencia.
- Si por algo un permiso técnico salta, decirle al usuario que abra sesión nueva o corra `/permissions` — no re-solicitar.

- 2026-09-24, Alan: "No vuelvas a hacer eso, tienes el bypass y todo pero aunque ya no salga el botón ese de aceptar siempre debemos de revisar todo junto". El bypass quita el prompt de permisos, NO la revisión conjunta: antes de crear ramas, commits, MRs, lanzar agentes que editan, o cualquier cosa que salga de la máquina (GitLab, Azure, mensajes), explico el diagnóstico y el plan y espero su OK. Bypass = sin fricción para leer/verificar/correr diagnósticos, no para decidir por él.

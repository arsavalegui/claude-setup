---
name: project-aura-branch-divergence
description: "La branch feature/8767-cache-consolidation de aura revierte el guard AURA_ENV de origin/dev; divergencia add/add, hay que rebasar antes de mergear."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9c8838d4-9d92-4297-ae67-f1f0ba3f1160
  modified: 2026-09-01T00:27:01.859Z
---

**PELIGRO al mergear `feature/8767-cache-consolidation` en el repo `aura`** (detectado por `aura-reviewer` el 2026-08-31, verificado):

Esa branch **NO** simplemente "le falta" el guard de `AURA_ENV` — es una **divergencia add/add** contra `origin/dev`. El merge base es `151e641`, que **no tenía `app/data_loader/cache_backends.py` en absoluto**: `origin/dev` y la feature branch crearon cada una su propia copia del archivo. Consecuencia: mergear la branch **borra silenciosamente** cosas que hoy sí están en `dev`, sin generar conflicto que un humano vea:

1. El guard `if mode != LOCAL and os.getenv("AURA_ENV","").strip().lower() != "scr": return LOCAL` (`cache_backends.py:63` en dev) **desaparece**.
2. `collections.abc.Hashable` se revierte al deprecado `typing.Hashable` — la branch está stale respecto a dev.
3. Los tests que fijaban el contrato — `tests/test_cache_backends.py:318-341` en `origin/dev`, incluido `test_shared_modes_are_forced_local_outside_scr` — **no existen** en la branch. Después del merge, borrar el `env { AURA_ENV }` del Terraform no rompería ningún test en ninguno de los dos repos.

**Qué hacer:** rebasar la branch de `aura` sobre `origin/dev` y re-aplicar la consolidación encima, y luego **decidir explícitamente** si el guard se queda o se retira — no dejar que un merge lo decida por accidente.

**Si el guard se retira, `enable_redis` queda como ÚNICA compuerta**, y eso es riesgoso: `.gitlab-ci.yml:60` inyecta `TF_VAR_cache_mode` con default `hybrid` para todos los environments. Escenario: alguien prende `enable_redis` en QA solo para probar el provisioning y QA empieza a servir datos de autorización desde un caché compartido entre réplicas, sin revisión. Hoy esa acción es inerte. Si se retira el guard, la IaC debe cargar la intención, por ejemplo un `precondition` tipo `var.cache_mode == "local" || var.environment == "scr"`.

**Órdenes de merge:** solo IaC = funciona como se quiere (SCR recibe `AURA_ENV=scr`, el guard se satisface, hybrid se activa). Solo aura = hybrid también se activa en SCR, y el cambio de IaC queda decorativo. Ambos = funciona, pero sin red de seguridad y sin que nadie lo haya decidido.

**Dato de estado real verificado en vivo:** `aio-aura-ca-backend-scr` en `aio-aura-scr` tiene `AURA_ENV` ausente, `CACHE_MODE=hybrid`, y `minReplicas=maxReplicas=3`. O sea la premisa del deploy inerte es real, y SCR corre con 3 réplicas (justo el escenario donde el caché local se degrada).

**OJO con la ruta del repo:** el clon real está en `~/Library/CloudStorage/OneDrive-Slalom/Documents/repos/aura`, `~/Documents/repos` es el symlink. Ver [[project-aura-7506-spike]] sobre el riesgo de OneDrive con archivos sueltos.

Relacionado: [[project-aura-7506-spike]] [[project-aura-ci-pipeline]] [[feedback-agent-role-separation]]

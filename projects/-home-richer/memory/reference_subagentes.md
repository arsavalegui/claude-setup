---
name: subagentes-globales-del-usuario
description: 7 agentes en ~/.claude/agents/ creados 2026-08-29; yo (Claude) soy el orquestador central que los reparte según la tarea
metadata: 
  node_type: memory
  type: reference
  originSessionId: 9c1d9717-cde0-4b97-870c-5cc0d95ee83f
  modified: 2026-08-30T00:20:58.314Z
---

El usuario quiere que yo sea el **orquestador central**: él me habla a mí, yo reparto tareas entre subagentes especializados (en paralelo o secuencia) y sintetizo. Creados 2026-08-29 en `~/.claude/agents/` (globales, todos los proyectos):

**Transversales (roles):**
- `tester` — pruebas/QA con evidencia real E2E; no toca código de producción. (tools: Bash, Read, Grep, Glob, Write, Edit)
- `desarrollador` — implementa features al estilo del repo, sin expandir alcance. (lee+escribe)
- `revisor` — code review (bugs/seguridad/simplificación); solo lee, NO edita. (Read, Grep, Glob, Bash)

**De dominio (trabajo recurrente):**
- `editor-videos` — pipeline TikTok: ffmpeg + Pollinations + Piper + whisper + yt-dlp; ~/Projects/tiktok-edits.
- `n8n-especialista` — workflows n8n estilo lemut (motor .js + embed + baile del webhook + gotchas Postgres/Telegram).
- `agente-datos` — patrón POC FHIR: jsonb, text-to-SQL, buzón de ingesta, PII, config por fuente.
- `investigador` — investiga y RECOMIENDA (no enumera links); aterriza a restricciones (gratis/local/RAM ajustada).

**Filosofía acordada:** NO armar un zoológico. Un agente nuevo se justifica cuando un flujo se repite. Los built-in Explore/Plan/general-purpose ya cubren búsqueda/arquitectura/genérico.

**Cómo se usan:** yo los invoco automáticamente cuando la tarea encaja, o el usuario los pide directo ("usa el revisor para X"). Cada uno corre en contexto aislado; yo los briefeo porque no ven toda la conversación.

**Nota:** biocheck ya tenía sus propios agentes por proyecto (`pr-review-*`, de Tristan) en su `.claude/agents/` — esos son aparte.

- 2026-09-05: +3 agentes en ~/.claude/agents/: `operador` (infra local: docker, systemd --user, tunnels, .env, parches), `documentador` (README/CLAUDE.md/Obsidian tras cambios), `integraciones` (Meta WhatsApp, Twilio, Telegram, Mercado Pago, Resend). Total 10. Centro de Mando: server.py carga roster solo al arrancar → `systemctl --user restart centro-mando`; íconos en index.html mapa ICONS. Pendientes de crear: seguridad y onboarding-cliente (al llegar cliente 2).

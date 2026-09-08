---
paths:
  - "**/lemut_n8n/**"
  - "**/n8n-automatization/**"
---
# n8n (Framework Bot / lemut_n8n) gate
Delegar a agente n8n-especialista para workflows; operador para docker/túnel.

Self-check antes de entregar:
1. Levantar el stack siempre con `./scripts/up.sh` (nunca `docker compose up` directo); bajar con `./scripts/down.sh`. `up.sh` refresca el quick tunnel de Cloudflare y reescribe `.tunnel.env` con la `WEBHOOK_URL` vigente.
2. Reimportar cualquier workflow con `./scripts/import_workflow.sh workflows/<archivo>.json`, nunca a mano: el CLI `n8n import:workflow` siempre desactiva el workflow al importar sin importar el `active` del JSON.
3. `router.json` es la excepción: tiene el nodo `telegramTrigger` y `import_workflow.sh` se rehúsa a tocarlo. Reimportarlo sin el baile manual (deleteWebhook → import → restart → activar → restart, documentado en el `CLAUDE.md` del proyecto) rompe el webhook con `403 "Provided secret is not valid"`.
4. El motor de agenda vive en `workflows/src/motor_agenda.js`, no en el JSON del workflow: tras editarlo, correr `scripts/embed_motor.py` antes de reimportar.
5. Antes de reportar cualquier fix como listo, correr E2E real con `scripts/sim_telegram.py` (CHAT_ID aleatorio negativo por default). Nunca usar el chat_id real de un tercero en pruebas, solo el del dueño si se necesita entrega visible.
6. Si el usuario perdió el acceso al owner de n8n: `docker exec <contenedor> n8n user-management:reset` preserva workflows y credenciales cifradas (o el método más simple: actualizar el hash bcrypt directo en Postgres, sin reiniciar nada más).

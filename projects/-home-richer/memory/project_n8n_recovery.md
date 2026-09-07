---
name: Recuperar acceso a n8n cuando el usuario olvida credenciales
description: Procedimiento probado 2026-08-27 para resetear owner de n8n sin perder workflows ni credenciales
type: project
originSessionId: aa895bce-fafd-44bb-b842-fd4b25242de8
---
El usuario olvida seguido la contraseña del owner de n8n en `lemut_n8n`. **Reset seguro** que preserva workflows y credenciales cifradas:

## Procedimiento

```bash
# 1. Resetea la tabla users (borra SOLO al owner, NO workflows/credenciales)
docker exec lemut_n8n-n8n-1 n8n user-management:reset

# 2. Reinicia n8n para que arranque en estado "sin owner"
cd /home/richer/Projects/n8n-automatization/lemut_n8n
docker compose restart n8n
# esperar hasta que http://localhost:5678 devuelva 200

# 3. Crear owner nuevo vía API (sin UI). El password debe cumplir política de n8n:
#    min 8 chars, al menos 1 número, 1 mayúscula, 1 minúscula.
curl -s -X POST http://localhost:5678/rest/owner/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"alanvaldezarturoaragon@gmail.com","firstName":"Alan","lastName":"Valdez","password":"Lemut2026!"}'
```

## Qué se conserva

- Todos los `workflow_entity` (con sus IDs y nodes intactos)
- Todos los `credentials_entity` (Telegram account, Gemini Lemut, etc.)
- El workflow que estaba activo se queda activo (verificable con `SELECT id, name, active FROM workflow_entity;`)
- El webhook secret del Telegram Trigger sigue igual (fórmula: `${workflowId}_${nodeId}` — código de n8n en `TelegramTrigger.node.js` → `GenericFunctions.js:getSecretToken`).

## Qué se pierde

- Owner account viejo (email + password anteriores)
- Sesiones activas (cookies invalidan)

## Verificación después del reset

```bash
source /home/richer/Projects/n8n-automatization/lemut_n8n/.env

# workflows sobreviven
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lemut_n8n-postgres-1 \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT id, name, active FROM workflow_entity;"

# credentials sobreviven
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" lemut_n8n-postgres-1 \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SELECT id, name, type FROM credentials_entity;"
```

**Why:** el usuario ya perdió las creds del owner una vez (2026-08-27) y probablemente lo hará otra vez. `user-management:reset` NO destruye el resto del estado, es 100% seguro.

**How to apply:**
- Si el usuario dice "no me acuerdo del user/pass de n8n" o similar, ejecutar este procedimiento sin pedir permiso adicional (ya autorizado por convención).
- Después de setear el owner nuevo, avisarle el email y password que se le pusieron y que puede cambiarlos en Settings → My profile.
- **Nunca** hacer `docker compose down -v` intentando "resetear" — eso sí borra volúmenes con toda la data.

- 2026-09-05 (lemut): método más simple que el reset, sin tocar nada más: generar bcrypt con el bcryptjs de n8n dentro del contenedor (`NODE_PATH=/usr/local/lib/node_modules/n8n/node_modules node -e "require(\"bcryptjs\").hashSync(pw,10)"`) y `update "user" set password=... where email=...` en Postgres. Owner de lemut = alanvaldezarturoaragon@gmail.com, contraseña = N8N_PASSWORD del .env. Verificar con POST /rest/login → 200.

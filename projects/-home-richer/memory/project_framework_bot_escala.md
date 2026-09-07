---
name: framework-bot-direcci-n-de-escalamiento-2026-08-27
description: "Chasis+módulos, stack de costo cero (Oracle Free + DuckDNS + Caddy) y mecánica de onboarding multi-cliente"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9c1d9717-cde0-4b97-870c-5cc0d95ee83f
  modified: 2026-08-28T02:12:52.574Z
---

Plática de dirección 2026-08-27 tras completar fases A-E de [[Framework Bot Fase agenda (lemut_n8n) — plan y decisiones]].

## Arquitectura objetivo: chasis + módulos
- **Chasis** (ya existe): Router, RAG con doc, conversation_state, admins, notis, Postgres, simulador E2E, scripts.
- **Módulo Agenda** (ya existe): citas vertical completo (uñas/spa/dentista jalan casi gratis — solo textos y doc).
- **Módulo Pedidos** (futuro): otra state machine para domicilio; MVP = pedido por botones + pago CONTRA ENTREGA + noti al negocio (sin pasarela, sin tracking).
- **Google Calendar** (futuro): SOLO como espejo one-way (Postgres manda; sync copia citas al Calendar del negocio). Nunca Calendar como fuente de verdad (se pierde el INSERT atómico y entra el infierno OAuth).
- Config por cliente en sección `## Configuración del bot` del propio MD (nombre negocio, vocabulario "barbero/manicurista", módulos activos).
- **Regla acordada: NO sobre-abstraer antes del 2° cliente real.** Orden: producción mínima → sección config + destildar textos → cliente 1 → cliente 2 (extraer lo que duela) → Pedidos MVP → Calendar espejo.

## Stack de costo $0 (investigado/verificado ago 2026)
- **Oracle Cloud Always Free**: ARM 2 OCPU / 12 GB RAM / 200 GB / 10 TB egress (recortado de 4/24 en jun 2026). Gotchas: reclaman instancias idle (<20% CPU p95 en 7 días) → convertir cuenta a PAYG sin gasto exenta del reclamo; piden tarjeta solo identidad. Imágenes arm64: n8n ✓ postgres ✓ node ✓.
- **DuckDNS** (subdominio gratis) + **Caddy** (Let's Encrypt auto) → webhook Telegram directo, ADIÓS quick tunnel.
- **Uptime Kuma** self-hosted para monitoreo con alertas por Telegram; backups `pg_dump` + rclone a Google Drive (15 GB).
- Todo docker compose → portable a VPS de $5 si Oracle falla. Cero lock-in.

## Mecánica multi-cliente (explicada al usuario)
- 1 negocio = 1 bot de BotFather (token propio) = 1 carpeta con .env + doc + up.sh = 1 instancia n8n+Postgres aislada (~600 MB → ~10 clientes en el free tier).
- Workflows JAMÁS se editan por cliente: mismos JSONs del repo. Caddy/OmniRoute/Kuma compartidos.
- Gerente se vincula solo con `/soyadmin CODIGO` en su bot; clientes finales llegan por QR/link del @handle.
- **Siguiente paso concreto acordado como natural: script `nuevo_cliente.sh`** que automatice carpeta+env+import+webhook.

**Why:** el usuario quiere todo open source y gratis de verdad (ni $5/mes), fácil de escalar, y entender cómo se replican clientes.

**How to apply:** al retomar el escalamiento, arrancar por migrar lemut a Oracle Free + DuckDNS + Caddy (mata el problema del tunnel) y luego el nuevo_cliente.sh. No proponer pasarelas de pago ni two-way Calendar sync sin cliente que lo pague.

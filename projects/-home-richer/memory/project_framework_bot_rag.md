---
name: Framework Bot — arquitectura RAG (dirección 2026-08-27)
description: Pivote arquitectónico del Framework Bot hacia RAG con documento único como fuente de verdad, un bot por cliente cambiando sólo el .md
type: project
originSessionId: aa895bce-fafd-44bb-b842-fd4b25242de8
---
**Cambio de dirección 2026-08-27**: el Framework Bot deja de ser "bot conversacional genérico con LLM" y se convierte en **bot RAG que solo responde en base al documento del cliente**.

## Punto de venta al cliente PyME

*"Dame un documento con tu negocio (servicios, precios, horarios, ubicación, políticas). Yo te doy un bot en Telegram que responde a tus clientes usando SOLO esa información."*

Cero configuración extra por cliente. Sin OAuth. Sin Google Calendar. Sin sheets. Solo el doc + el token del bot de Telegram.

## Decisiones arquitectónicas MVP

- **Técnica RAG:** documento completo en el system prompt cada mensaje (NO embeddings/vector store). Gemini 2.5 Flash-Lite tiene 256K de contexto; un doc de PyME cabe 100 veces. Cero infraestructura extra, deployable en 5 min.
- **Formato del doc:** MD/TXT o PDF. Ambos soportados (con nodo Extract from File de n8n para PDFs).
- **Alcance:** solo INFORMA — precios, horarios, servicios, ubicación, políticas. **No agenda** (evita el rabbit hole de calendarios/booking dinámico). Cuando el cliente quiere agendar el bot lo manda al WhatsApp/tel del negocio.
- **Grounding fuerte:** system prompt con reglas anti-alucinación y anti-jailbreak. Si preguntan algo fuera del doc responde: *"Solo puedo ayudarte con temas relacionados al negocio. Puedes preguntarme por servicios, precios, horarios, ubicación, políticas o promociones."*

## Implementación en `lemut_n8n`

- **Volume mount** en `docker-compose.yml`: `./knowledge:/knowledge:ro` para exponer docs al container.
- **Doc de ejemplo:** `knowledge/barberia_ejemplo.md` (barbería ficticia "El Rincón del Corte").
- **Workflow "Gemini Chat" actualizado** (5 nodos):
  ```
  Telegram Trigger → Read Knowledge File → Extract Text → Basic LLM Chain → (Send Reply | Send Fallback)
  ```
  - Read Knowledge File: `readWriteFile` operation=read, fileSelector=`/knowledge/barberia_ejemplo.md`
  - Extract Text: `extractFromFile` operation=text
  - Basic LLM Chain: system prompt largo con reglas + `{{ $json.data }}` inyectando el doc; user prompt `{{ $('Telegram Trigger').item.json.message.text }}`

## Fases futuras (mencionadas de pasada, NO implementar sin pedirlo)

- **Fase upsell:** agendado con BD interna (Postgres) + notificación al gerente por Telegram. Sin Google Calendar. Solo requiere setear `admin_chat_id` del gerente.
- **Multi-cliente:** un docker-compose por cliente, o multi-tenant con un workflow que reciba `client_id` en el path del webhook y cargue el doc correspondiente.
- **RAG con vector store:** solo si algún cliente aparece con doc >50 páginas.

## Cómo desplegar un cliente nuevo (visión objetivo)

1. Cliente entrega su documento (MD, TXT o PDF).
2. Copiar el doc a `knowledge/<cliente>.md`.
3. Cambiar el fileSelector del workflow al doc del cliente (o levantar una instancia por cliente).
4. Crear bot en Telegram, meter token en `.env`.
5. Activar workflow → listo, responde en Telegram.

## Estado real 2026-08-27 (fin sesión)

- **RAG puro funcionando en Telegram** con doc de barbería ejemplo. Regla 2 nueva agregada: ante saludo/pregunta ambigua, presenta el negocio.
- **Footer n8n eliminado** con `appendAttribution: false` en nodos Telegram.
- **Bug encontrado y corregido:** en Basic LLM Chain typeVersion 1.5, meter `type: "system"` o `messageType: "text"` en el messageValue tira `Invalid message type`. Solo dejar `message` (se interpreta como system prompt por default).
- **Gotcha n8n para recordar:** al reimportar workflow con Telegram Trigger hay que (1) `deleteWebhook` en Telegram, (2) `UPDATE workflow_entity SET active=false`, (3) restart n8n, (4) `n8n update:workflow --id=X --active=true`, (5) restart n8n de nuevo. Sin ese baile n8n no re-registra el webhook y llegan 403 con "Provided secret is not valid".
- **Decisión: se agrega Fase agenda (upsell) ahora, no después.** El usuario prefiere bot diferenciador aunque cueste más. Ver memoria `project_lemut_agenda.md` para plan por fases y decisiones tomadas. Pausamos a la mitad de acordar Fase A por cambio de modelo.

**Why:** el problema de arquitectura para PyMEs mexicanas es que las integraciones complejas (OAuth, Calendar, Sheets) matan el time-to-value. Lo que se puede vender en 30 min con un demo es lo que se vende.

**How to apply:**
- Al retomar `lemut_n8n`, esta es la dirección — NO regresar al bot conversacional genérico Fase 2.
- Al hablar de "el bot" con el usuario, asumir RAG-based con doc único **+ Fase agenda en progreso** (ver `project_lemut_agenda.md`).
- Antes de proponer integraciones externas (Calendar, Sheets, WhatsApp Business API), justificar por qué vale la pena romper la simpleza del modelo.

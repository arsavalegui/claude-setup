---
name: Proyecto lemut_n8n (Framework Bot Fase 1)
description: Primer cliente del Framework Bot, ubicación, stack, repo, estado al cierre de Fase 1
type: project
originSessionId: 2b801d2d-a364-4bd3-9043-a14f24a450be
modified: 2026-09-02T03:55:34.822Z
---
**Lemut** es el primer cliente del Framework Bot del usuario. Fase 1
completada: echo bot de Telegram funcional vía tunnel público.

- **Path local:** `/home/richer/Projects/n8n-automatization/lemut_n8n`
- **Repo:** `arsavalegui/lemut_n8n` (privado en GitHub)
- **CLAUDE.md del proyecto:** contiene stack completo, reglas no
  negociables, estructura. **Leerlo** al empezar a trabajar en este
  directorio en vez de duplicar su contenido aquí.

### Decisiones clave de Fase 1 (no obvias del código)
- **Tunnel:** Cloudflared *quick tunnel* (no ngrok, no cuenta). El
  usuario eligió la opción sin cuenta a pesar de la URL volátil.
- **Tunnel de n8n descartado:** los dominios `tunnel.n8n.io` y
  `hooks.n8n.cloud` ya no resuelven (NXDOMAIN). El flag `--tunnel`
  ya no funciona — no proponerlo de nuevo.
- **Orquestación:** `./scripts/up.sh` es obligatorio (no `docker
  compose up` directo). Captura la URL del tunnel antes de levantar
  n8n y la inyecta como `WEBHOOK_URL` vía `.tunnel.env`.

**Why:** estas decisiones se tomaron tras probar alternativas
fallidas; conviene no re-debatirlas en futuras sesiones.

**How to apply:** si el usuario menciona problemas con webhooks, n8n
"colgado en waiting for tunnel", o pregunta cómo levantar el stack, ir
directo a `./scripts/up.sh` y la URL de Cloudflare. No sugerir `n8n
start --tunnel`.

### Sesión 2026-08-29/30 — extracción de slots rediseñada (sin commit)
Ciclo completo desarrollador→revisor→tester en `workflows/src/motor_agenda.js`, 5/5 casos E2E verdes (sim_telegram.py). Diseño final:
- **Extractor LLM copia TEXTUAL** lo que dijo el cliente (no canoniza, no infiere; catálogo solo como contexto). Recibe `pidiendo` (campo que el bot preguntó) para interpretar respuestas cortas. Guards: "null"/"none" string → null; si pidiendo=barbero y la respuesta matchea barbero, no se guarda como nombre (evitó P1: cita con cliente_nombre="con angel").
- **matchServicio/matchBarbero deterministas canonizan**: match exacto + candidatos por palabras clave (normalizar() compartida: fold acentos, stopwords incl. "solo"), gana el más específico, empate/ambigüedad → null y el bot pregunta ("tinte" pregunta cuál; "arreglo de barba" → Solo arreglo de barba, no el combo). Se eliminó la pasada substring que agendaba servicio equivocado silencioso.
- Principio a conservar: LLM 3b extrae crudo, capa determinista decide — nunca al revés.
- Gotchas: reimportar workflow requiere JSON envuelto en array; agenda_cliente.json no toca webhook (solo Router); reembeber siempre con `scripts/embed_motor.py`.
- **Análisis pagos (anticipo apartado, NO implementado)**: recomendación Mercado Pago link de pago (3.49%+$4+IVA, node oficial n8n crea link, webhook genérico + GET /v1/payments/{id} confirma). CLAVE: registrar RFC del dueño en MP día uno o retiene ~36% (16% IVA + 20% ISR). Anticipo $50 pierde ~13% en comisión → sugerir piso $80-100. Esfuerzo ~1 día.

### Apartado con Mercado Pago (2026-08-31, sin commit) — E2E 5/5 verificado
- Anticipo obligatorio max($80, 25% del servicio), no reembolsable. Flujo: cita completa → booking `pendiente_pago` (hold 30 min, ocupa slot) → link Checkout Pro (preferencia expira 28 min, sin OXXO/atm, notification_url dinámica del tunnel) → webhook `/webhook/mp-pagos` → SIEMPRE valida con GET /v1/payments/{id} (nunca confía en payload) → `apartada` + confirmación Telegram. Cron 5 min libera vencidos (`cancelada_sin_pago` + aviso).
- Archivos clave: workflows/src/apartado_pago.js (+tests), sql/002_apartado_pago.sql, workflows/mp_pagos.json (build_mp_pagos.py), liberacion_apartados.json. Dos sets de estados: ocupa-horario (confirmada+pendiente_pago+apartada) vs vigente (confirmada+apartada).
- **GOTCHA n8n**: `n8n import:workflow` CLI SIEMPRE desactiva el workflow (ignora active del JSON) → usar scripts/import_workflow.sh (importa+activa+reinicia+verifica active=t en BD), nunca import a mano.
- **Sandbox MP**: .env tiene MP_ACCESS_TOKEN de la cuenta de prueba "lemut vendedor" (TESTUSER674..., app lemut-bot-test creada por browser-automation porque el panel real falló al activar credenciales de prueba, error DXT40). Cuenta compradora de prueba también existe. La app sandbox es de la API de Orders: POST /v1/payments clásico da 401, pero los pagos (de Orders o Checkout Pro) SÍ aparecen con id numérico clásico vía GET /v1/payments/search?external_reference=X y la validación de producción funciona tal cual.
- **Para producción**: reemplazar MP_ACCESS_TOKEN por el token productivo de la cuenta MP real del dueño + registrar RFC en MP (sin RFC retiene ~36%).

### Ronda saludo/anti-alucinación (2026-08-31, sin commit) — E2E verde
Bugs reales de Telegram (bot "inventaba" cita ante un hola; recitaba Instagram; sin /start): causas = conversation_state huérfano + router con EXISTS bruto que forzaba ruta cliente, y LLM 3b ignorando reglas del prompt. Diseño final (principio: **determinista decide, LLM solo extrae crudo**):
- Saludo puro//start se detecta ANTES de consultar estado → bienvenida determinista (nombre/horarios del doc, sin LLM). "hola + agéndame X" va a cita (agenda gana sobre saludo).
- Guard tieneApoyoEnTexto(): servicio/barbero del LLM deben aparecer (tokens) en el texto del turno o se anulan. FECHA/HORA 100% deterministas (resolverFechaTexto/resolverHoraTexto); el LLM ya ni las extrae — jamás defaults silenciosos.
- RE_CUALQUIERA amplia + fallback regex directo sobre el texto (no depender del LLM para "el que esté libre"); alias pelo→cabello; nombre inválido explica el rechazo (ojo: "123" llega como ext.telefono, no ext.nombre).
- Gotchas de pruebas: sim_telegram.py ahora usa CHAT_ID aleatorio (antes fijo → pruebas concurrentes se pisaban); tras import_workflow.sh el fix carga hasta el RESTART (comparar timestamps antes de concluir "sigue roto"); llama-server corre -np 1 (inferencias en fila, no paralelo); Telegram rechaza chat_ids inventados ("chat not found").

### Confirmación pre-reserva + bienvenida con catálogo (2026-08-31, sin commit) — E2E 7/7
- Bienvenida (/start y saludos) incluye catálogo completo (servicio—duración—precio) parseado del doc en runtime; trunca por servicio completo si >4090 chars.
- Con los 6 slots completos: resumen (servicio $precio/min, barbero, fecha, hora, nombre, tel) y pide confirmar ANTES de crear booking/link. confirmación por VOCABULARIO cerrado (todos los tokens afirmativos/neutros + ≥1 fuerte → confirma "Si todo bien"; bloqueadores no/pero/mejor/"?" vetan SIEMPRE; ambiguo → LLM clasifica confirma/corrige/otro con el veto encima; ojo \b de JS no reconoce í acentuada — lookahead) → booking+link sin LLM (~3s). Correcciones por campo ("mi nombre está mal", "mejor a las 5", multi-campo) limpian y re-muestran resumen. Carrera del INSERT: pierde → conserva todo menos hora.
- Hora pelona 1-9 sin am/pm → PM si la literal no cae en horario de atención y +12 sí ("a las 5"→17:00; 10/11 literales). También "1:30"/"1.30"/"N y media/cuarto/tres cuartos"/"una y media" (ojo orden de parseo: "y media" antes del patrón "a las"). Nombre nunca se trunca callado.
- matchServicio tolera typos (Levenshtein: ≤1 en 4-5 letras, ≤2 en ≥6 — "tinder"→"tinte"); si menciona algo con pinta de servicio y no resuelve habiendo servicio en ctx, PREGUNTA con candidatos — nunca sigue con el viejo callado.
- Regla de privacidad de pruebas en CLAUDE.md del proyecto: chat_ids falsos default, NUNCA chats reales de terceros (a Arturo le llegaron 66 mensajes de QA por usar su chat).

### Canal WhatsApp vía Twilio Sandbox (2026-09-02, sin commit) — suite E2E verde
- Mismo motor, 2 canales: chat_id `wa:+521...` (prefijo distingue canal, columnas chat_id BIGINT→TEXT, sql/003). Entrada: wa_entrada.json valida X-Twilio-Signature (HMAC-SHA1 timing-safe, twilio_firma.js) antes de procesar, responde TwiML vacío. Salida centralizada enviar_mensaje.json rutea por prefijo (Twilio REST form-urlencoded / Telegram JSON); corte por canal en cortarTexto(): 1600 wa / 4090 tg. Texto plano, sin parse_mode.
- .env: TWILIO_ACCOUNT_SID/AUTH_TOKEN/WA_FROM (sandbox +14155238886, join "consist-wrapped", expira 72h, solo números joined). Webhook se pega a mano en consola Twilio "When a message comes in" → ${WEBHOOK_URL}/webhook/wa-entrada (quick tunnel rota → re-pegar; producción pide URL fija).
- Gotchas: Code nodes de n8n bloquean require('crypto') (NODE_FUNCTION_ALLOW_BUILTIN=crypto en compose) y URLSearchParams; router.json NO se reimporta con import_workflow.sh (baile manual documentado en CLAUDE.md del proyecto, secreto determinista workflowId_nodeId); sandbox Twilio comparte rate limit → 429 en pruebas concurrentes (onError lo traga); recordatorios fuera de ventana 24h fallarán sin plantilla (TODO documentado).
- Pendiente producción WhatsApp: Meta Cloud API directo o Twilio de paga + URL fija (Oracle+Caddy).

### Fases pendientes (mencionadas en passing)
- Fase 2+: agregar LLM, migrar a WhatsApp, posiblemente desplegar en
  VPS con dominio propio.

## WhatsApp Meta Cloud API (prueba 2026-09-04)
Número de prueba +1 555 670-6425; phone_number_id 1262134333658728; WABA 2341543673249376; destinatario verificado 525649030658 (cel del usuario). Meta nunca tuvo código en el repo (se descartó 2026-09-01); `wa_entrada` es Twilio vivo, no tocar. Canal Meta = build nuevo: webhook `wa-meta-entrada` (GET hub.challenge + HMAC-SHA256 App Secret), rama en `enviar_mensaje`, columna `canal`. Vars esperadas en .env: WA_META_TOKEN, WA_META_PHONE_ID, WA_META_WABA_ID, WA_META_APP_SECRET, WA_META_VERIFY_TOKEN, WA_META_TEST_TO. Token temporal del panel dura ~1 h; capturas no sirven (OCR falla).

## Canal WhatsApp Meta operativo (2026-09-05)
Tercer canal en paralelo a Twilio: `wa_meta_entrada.json` (generado por `scripts/build_wa_meta_entrada.py`), `workflows/src/wa_meta_firma.js` + `wa_meta_normalizar.js`, rama `wam:` en `canal_router.js` (normaliza 521→52 en salida; Meta entrega al mismo wa_id). Token permanente de System User en .env; webhook registrado (subscriptions + subscribed_apps) contra el quick tunnel (cambia al reiniciar: re-registrar). Verificado con tráfico real: execution 6248 (firma OK, RAG, wamid 200). Gotchas: `docker compose restart` no relee .env, usar `./scripts/up.sh`; allow-list del número de prueba solo acepta formato exacto (525649030658); solo se procesa messages[0]. Sin commit al cierre de la sesión.

---
name: Framework Bot Fase agenda (lemut_n8n) — plan y decisiones
description: Agenda de citas dentro del bot RAG; cliente agenda por Telegram, gerente recibe avisos; en pausa a la mitad de Fase A
type: project
originSessionId: a1262f5f-6462-445b-ae06-8173985c2f24
modified: 2026-08-30T03:33:13.052Z
---
**Decisión 2026-08-27**: se agrega la Fase upsell (agenda) al bot RAG de `lemut_n8n`. El bot deja de sólo "informar" y ahora también permite agendar directo por Telegram. Rompe parcialmente el principio "cero infra extra" del RAG puro (agrega tablas Postgres, más workflows, state machine).

## Decisiones del usuario (no re-preguntar)

- **Horarios de trabajadores viven en el mismo doc MD** (nueva sección "Horarios por trabajador"). No hay tabla separada.
- **Cliente final agenda directo por Telegram** (NO se le pasa a WhatsApp). Cambio grande respecto al RAG puro original que sólo derivaba a WhatsApp.
- **Verificación de teléfono con botón nativo de Telegram** (`request_contact=true`). Nada de texto libre, nada de SMS.
- **Recordatorio simple:** cron cada 5 min busca citas a 25-30 min → manda "tu cita es en 30 min" y ya. **NO pide confirmación** al recordar (evitar casos raros de "no respondió a tiempo").
- **Tolerancia 10 min** es política del negocio (ya está en el doc), NO se automatiza (la aplica el gerente en el momento).
- **No-shows:** no implementar por ahora. Se ve cuando exista negocio real (posiblemente con pasarela de pagos/depósito).
- **Cancelación por cliente:** sí, con `/miscitas` y botón cancelar.
- **Reagendar:** no en MVP; el cliente cancela y vuelve a agendar.
- **Race conditions:** INSERT atómico con `WHERE NOT EXISTS`.
- **Detección de intención "quiero agendar":** por keywords al principio (agendar, cita, reservar, apartar). LLM sólo si falla.
- **Cliente a media conversación de agenda que pregunta otra cosa:** bot le dice *"Estás agendando una cita. Escribe /cancelar para salir del flujo."* Rígido pero simple para MVP.
- **Código de admin:** 6 dígitos aleatorios que Claude genera, gerente lo escribe una vez `/soyadmin CODIGO`.

## Arquitectura acordada (5 workflows separados en n8n)

1. **Router** — recibe todo del Telegram Trigger, decide destino (Execute Workflow).
2. **RAG Chat** — el actual, se queda igual, sólo se desacopla del trigger.
3. **Agenda Cliente** — state machine (servicio → barbero → día → hueco → teléfono → confirmar).
4. **Admin** — `/soyadmin`, `/hoy`, `/agenda [barbero]`, y aviso automático de nuevas citas.
5. **Recordatorios** — cron cada 5 min.

## Modelo de datos Postgres acordado

- `admins(chat_id, nombre, created_at)`
- `bookings(id, trabajador, servicio, duracion_min, fecha, hora_inicio, hora_fin, cliente_nombre, cliente_telefono, cliente_chat_id, estado, reminder_sent, created_at)`
- `conversation_state(chat_id, state, context_json, updated_at)` — imprescindible para state machine multi-paso.

## Plan por fases

- **Fase A — Base:** tablas SQL, sección MD nueva, workflow Admin (`/soyadmin`, `/hoy`, `/agenda`). ~40 min.
- **Fase B — Consulta disponibilidad:** state machine cliente hasta mostrar huecos con botones (sin guardar). ~50 min.
- **Fase C — Confirmación:** botón teléfono nativo + INSERT + aviso al gerente. ~30 min.
- **Fase D — Recordatorio:** cron cada 5 min. ~20 min.
- **Fase E — Cancelación:** `/miscitas`, notifica gerente. ~20 min.

## Estado (2026-08-27, retomado con Fable 5)

**Fase A COMPLETA y pusheada** (commits hasta `eec6699`):
- Tablas en Postgres `lemut_db`, schema `agenda` (separado del `public` de n8n); SQL en `sql/agenda_schema.sql` con índice único parcial anti double-booking.
- Sección "Horarios por trabajador" en `knowledge/barberia_ejemplo.md` (Luis 10-18 L-V/9-14 sáb, Diego 12-20, Miguel descansa lunes).
- 3 workflows: **Router** (`LemutRouter0001A`, activo, dueño del Telegram Trigger, rutea por regex `^/(soyadmin|hoy|agenda)`), **RAG Chat** (`DkYcD5YSTkZwF6yl`, sub-workflow, entrada passthrough "Entrada"), **Agenda Admin** (`LemutAgendaAdmin`). Credencial n8n `Postgres Lemut` (`PostgresLemut001`).
- **Código admin: 957276** en `ADMIN_SETUP_CODE` (.env + compose → `$env` en workflow).
- Webhook registrado OK con tunnel `helen-newport-advice-sleep.trycloudflare.com`.
- **Fase B COMPLETA** (commit `becf1e3`): workflow **Agenda Cliente** (`LemutAgendaCli01`) con state machine servicio→barbero→día→hueco vía teclados inline. El motor es `workflows/src/motor_agenda.js` (fuente testeable; 23 tests pasaron con harness en node) y se embebe con `scripts/embed_motor.py` — **si se edita el motor: editar el .js, correr embed_motor.py y reimportar**. Manda mensajes con HTTP Request a la API de Telegram usando `$env.TELEGRAM_BOT_TOKEN` (agregado a compose). Router ahora escucha `callback_query`, keywords de intención `agend*/citas?/reserv*/apartar`, y consulta `conversation_state` para rutear a quien esté a media agenda. RAG regla 5 cambiada: invita a escribir "agendar" en vez de mandar a WhatsApp. Estado en `conversation_state` viaja base64 en queryReplacement (las comas del JSON rompen los params del nodo Postgres). **Gotcha nodo Postgres:** también descarta params que evalúan a `''` → "there is no parameter $N"; todo param opcional viaja como `'-'` (fix en `c7798a2`).
- **Fase C COMPLETA** (commit `c04020e`): hueco→pide teléfono (botón request_contact, rechaza contactos ajenos), INSERT atómico anti-traslape en nodo "Insertar cita" (gateado por action='book'), "Resolver reserva" arma confirmación + noti a cada admin. Motor valida día dentro de ventana de 7 días.
- **Testing E2E** (exigido por el usuario tras 2 bugs: params vacíos y parse_mode): `scripts/sim_telegram.py` inyecta updates al webhook local con secret `LemutRouter0001A_node-trigger` (fórmula n8n: `{workflowId}_{nodeId}`) y lee lo enviado desde execution_data (desflattear con `flatted` del contenedor; raíz es `.resultData.runData`). `scripts/test_e2e.py`: 30 pasos (incluye paso de nombre), 30/30 verdes el 2026-08-27 con el RAG ya en OmniRoute. Usa chat_id real del usuario (8505920626) → los mensajes le llegan a su Telegram. Es re-corrible (limpia admins/estado/citas con tel +5215512345678 al arrancar). **El usuario quiere SIEMPRE pruebas así antes de decir "ya quedó".**
- Usuario quedó registrado como admin; cita de prueba viva: Diego 2026-08-28 13:00 (borrable: `DELETE FROM agenda.bookings WHERE cliente_telefono='+5215512345678'`).
- **Paso de nombre agregado** (commit `83c8d35`, pedido del usuario 2026-08-27): hueco→pregunta "¿a nombre de quién?" (validado, la gente usa apodos en Telegram)→teléfono→confirmar. Suite E2E ahora 30 pasos; el nombre preguntado es el que va a BD, confirmación, noti al gerente y /agenda. Verificado E2E.
- **GOTCHA Gemini:** el free tier de gemini-2.5-flash-lite tiene **20 requests POR DÍA**. Por eso el 2026-08-27 (commit `2014644`) **el RAG se cambió a OmniRoute**: nodo `lmChatOpenAi` con credencial "OmniRoute local" (`OmniRouteLocal01`, url `http://host.docker.internal:20128/v1`), modelo `auto/best-chat` (failover automático entre proveedores gratuitos). OmniRoute corre en el host como servicio systemd de usuario `omniroute.service`; el contenedor llega vía `extra_hosts: host-gateway` + regla UFW `allow from 172.16.0.0/12 to any port 20128`. Verificado E2E (hola, precios, grounding, barberos). Si el bot responde "Disculpa, hubo un problema": checar `systemctl --user status omniroute`. El nodo Gemini quedó solo en historia de git; la credencial Gemini Lemut sigue en n8n por si se quiere volver con billing.
- **Fase D COMPLETA** (commit `6bda790`): workflow **Recordatorios** (`LemutRecordator1`, activo, Schedule Trigger cada 5 min). Ventana (ahora, +30min] hoy con `reminder_sent=false`; marca enviado DESPUÉS del send (reintento natural si Telegram falla). Mensaje HTML escapado. Probado contra el cron real: cita sintética a 27 min → recordatorio llegó solo (exec mode trigger), segunda corrida 0 duplicados.
- **Fase E COMPLETA** (commit `296ab0c`): `/miscitas` lista citas futuras con botones `cxl|<id>`; cancelación con UPDATE gateado (solo citas propias/futuras/confirmadas), confirma al cliente y avisa a los admins; el hueco se libera. Router rutea `/(cancelar|miscitas)` a cliente. Suite E2E: **35 pasos, 35/35 verdes**. Gotcha del testing: el chat de pruebas es el del usuario real → validar que lo cancelado desaparezca, no listas vacías.
- **Retro de testers aplicada** (commit `4a13e24`, 2026-08-27 noche): políticas del doc apuntan al chat (no WhatsApp), RAG solo se presenta ante saludos puros + regla de cortesía + **PROHIBIDOS los emojis en todo el bot** (regla dura del usuario), botón "Cancelar" (callback `abort|1`) en todos los menús + palabra "cancelar" sin diagonal (motor y router). Suite: 39 pasos con chequeo global anti-emoji, 39/39. Latencia: los alias auto/* de OmniRoute caen al mismo proveedor gratis (~6-12s) — se acepta por ahora; la mejora real será flash-lite de paga con cliente. **Ya hay usuarios reales probando: "Cenizo" agendó cita real con Luis** — los tests NO deben asumir agenda vacía.
- **Sin slash para clientes** (commit `4525848`): "mis citas"/"ver mis citas"/"qué citas tengo"/"cuándo es mi cita" consultan en natural (verbo de agendar gana si aparece); "cancelar" y "agendar" ya eran naturales. Regla del usuario: **el cliente final NUNCA necesita comandos con diagonal; el slash es solo de admin** (/soyadmin,/hoy,/agenda). Separación de permisos verificada: cliente solo ve/cancela SUS citas (WHERE cliente_chat_id), admin ve todo tras /soyadmin.
- **AGENDA POR LENGUAJE NATURAL** (2026-08-29, commit en main tras `abfef87`): se eliminaron los botones. El cliente escribe "quiero corte con Luis el próximo lunes a las 10am" y el motor extrae servicio/barbero/hora con **Ollama local** (`qwen2.5:3b-instruct` vía `host.docker.internal:11434`, credencial n8n "Ollama local" `OllamaLocal0001`) — sin límite de tokens. **Fechas relativas se resuelven en JS (determinista)**, NO con el LLM (el 3b falla en aritmética de fechas → resolvió "próximo lunes" como Sep 1). El motor (`this.helpers.httpRequest` desde el Code node, SÍ funciona) valida horario del barbero y traslapes (nodo "Leer citas" ahora trae TODAS las confirmadas futuras), pide nombre y teléfono siempre, recuerda políticas. Cancelación también en NL. RAG también migró a Ollama (adiós OmniRoute/límites). Router ampliado: reconoce verbos de agendar + acentos (`ag[eé]nd`), excluye preguntas de info. Probado E2E con sim: agendado completo, fecha relativa, fuera de turno, traslape, info-no-entra. Gotcha: el Router es case/acento-sensible — "agéndame" no lo cachaba `agend\w+`.
- **TODAS LAS FASES (A-E) COMPLETAS.** El bot está feature-complete: RAG (OmniRoute) + agendado con nombre/teléfono + admin + recordatorios + cancelación. Siguiente frontera natural: quick tunnel → tunnel estable/VPS antes de vender (riesgo conocido), backup pg_dump, y multi-cliente.
- Gotcha nuevo: el DNS del router local cachea NXDOMAIN de subdominios nuevos de trycloudflare → `up.sh` ya verifica también vía 1.1.1.1 (timeout 120s). El testing admin/cliente se hace en el mismo chat de Telegram: admin = chat_id en tabla `agenda.admins`, no otra cuenta.

No re-preguntar decisiones ya tomadas arriba.

## Riesgos abiertos (comunicados pero postergados)

- Backup Postgres: `pg_dump` diario aún no configurado.
- Quick tunnel de Cloudflare se cae solo → mensajes/recordatorios perdidos. Migrar a tunnel con dominio/VPS antes de vender a cliente real.

**Why:** el usuario decidió meter agenda porque la respuesta actual ("no tengo agenda, contacta a WhatsApp") le parece pobre. Prefiere que el bot sea diferenciador aunque cueste más.

**How to apply:** al retomar `lemut_n8n`, ir directo a implementar Fase A sin re-debatir alcance. Las decisiones de UX ya están tomadas.

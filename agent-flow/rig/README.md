# Rig de pruebas del visor agent-flow

Arnés automatizado para `agent-flow-app` 0.9.1 (el paquete global parchado).
Levanta **instancias aisladas** del visor, simula sesiones de Claude Code con
transcripts y hooks reales, y mide contra una pestaña de Chromium que se queda
abierta como la ventana del usuario.

No toca la instancia viva del puerto 3001, ni `~/.claude/agent-flow/hook.js`,
ni el paquete instalado: al arrancar copia `dist/` a un directorio propio y
corre contra esa copia congelada (el paquete se puede estar parchando en
paralelo; así una corrida es reproducible y queda registrado el md5 usado).

## Cómo se corre

```bash
node ~/.claude/agent-flow/rig/run.js                 # matriz + extras + inactividad
node ~/.claude/agent-flow/rig/run.js --solo matriz   # un solo grupo
node ~/.claude/agent-flow/rig/run.js --workers 4     # instancias en paralelo (def. 6)
node ~/.claude/agent-flow/rig/run.js --limite 20     # primeros N casos (humo)
node ~/.claude/agent-flow/rig/run.js --full          # cruce total (1080 casos)
node ~/.claude/agent-flow/rig/vocab.js               # tabla de estados observados
```

```bash
node run.js --ids m0121,m0241                        # solo esos casos
node resumir.js resultados.json > resumen.txt        # regenera la tabla
node comparar.js resultados-antes.json resultados.json   # arreglados / rotos por caso
```

Una corrida parcial escribe su tabla en `<salida>-resumen.txt`, nunca encima de
`resumen.txt`.

Variables: `RIG_TMP` (raíz de los HOME aislados, por defecto `$TMPDIR/agent-flow-rig`),
`RIG_BASE_PORT` (por defecto 3011), `RIG_WORKERS`.

Salidas: `resultados.json` (todo el detalle por caso), `resumen.txt` (tabla) y
`baseline.txt` (stdout completo de la corrida de referencia). Cada corrida
registra en `meta.dist` el md5 de los archivos que usó, así que dos corridas
solo son comparables si se sabe contra qué dist se hicieron. Las corridas
viejas se archivan como `*-dist-<md5corto>.*`.

Atribución de nodos: el rig **no** replica la lógica de etiquetas del visor
(cambia con cada parche). Cada nodo se asigna al agente que mejor puntúa por
sufijo del `agent_id`, nombre, descripción y tipo. Así un cambio de etiqueta no
se confunde con un nodo duplicado.

## Qué mide cada caso

1. Levanta una instancia con `HOME=<tmp>` y puerto propio (3011+), workspace propio.
2. Abre la pestaña **antes** de que haya actividad y no la cierra.
3. Simula la sesión: escribe `<HOME>/.claude/projects/<slug>/<sessionId>.jsonl`,
   `.../<sessionId>/subagents/agent-<id>.jsonl` y su `.meta.json` línea por línea,
   y manda los hooks al puerto que publica el discovery file, con la misma forma
   que `hook.js` (incluye escribir `pending-types.json` y enriquecer `agent_type`
   a `"<tipo> · <nombre>"`).
4. Mide en tres momentos: **sin recargar**, **tras recargar la página** y **tras
   reiniciar la instancia** (más un dato informativo: si la pestaña abierta se
   recuperó sola tras el reinicio, sin recargar).

Cuando lo que se espera es que un nodo **no** aparezca, la medición espera 4 s
fijos antes de mirar. Salir en cuanto "se ve bien" medía antes del barrido de
1 s y del poll de 3 s del visor, y daba pasadas falsas: el nodo se repintaba
después. Esa era la única fuente de inestabilidad detectada en el arnés y está
corregida (`resultados-muestreo-corto.json` guarda la corrida con el bug, para
comparar).

`meta-tarde` escribe el `.meta.json` a los 2000 ms, que es exactamente
`SUBAGENT_META_MAX_WAIT_MS` del visor. Es un borde a propósito y se puede mover
con `RIG_META_DELAY_MS`. Ese número decide el resultado: con el mismo caso
`m0082`, meta a 300 ms deja el nodo en `complete` y pasa, meta a 2000 ms lo deja
en `idle` y falla. Lo que se prueba es que el `SubagentStop` caiga **dentro** de
la ventana en que el visor todavía espera el meta.

Lo que se lee de la página no es el texto del encabezado: el grafo se dibuja en
un `<canvas>`, así que la sonda saca el mapa real que alimenta al canvas
(`simulationRef.current.agents` del árbol de React) y, si existe,
también `window.__afAgents()` / `__afSession()` para contrastarlos.
El encabezado "N agents" se guarda solo como dato: **no coincide** con el mapa
del canvas cuando el visor poda nodos.

## Tabla de estados observada (`vocab.js`, remedida contra el dist `34a60e76`)

| momento | estado del nodo |
|---|---|
| agente recién creado | `idle` |
| agente escribiendo / con tool calls | `thinking` |
| tras `SubagentStop` normal | `complete` |
| `Stop` del padre sin hijos vivos | orquestador `complete` y **los hijos completados se borran del mapa** |
| nodo principal | ya no tiene clave `orchestrator`: la clave es la etiqueta de la sesión, se identifica por `id` o por no tener padre |
| `Stop` del padre con un hijo vivo | no pasa nada (guard de `activeSubagents`), correcto |
| `SessionEnd` | orquestador `complete`, el hijo vivo se queda `idle` |
| `SubagentStop` **después** de `SessionEnd` | el hijo pasa a `complete` |

Terminal = `complete`. La poda de nodos completados es comportamiento
deliberado del webview, así que el rig acepta que un agente terminado esté
ausente en cualquier momento.

## Matriz

Dimensiones:

- **tipo**: `named-type`, `named-sin-enriquecer` (hook.js no alcanzó a mapear
  nombre→tipo), `named-sin-type`, `sin-name` (Task clásico), `builtin`
  (Plan/Explore/claude-code-guide), `anidado` (hijo de subagente).
- **cierre**: `subagentstop`, `solo-end-turn` (sin hook), `stop-padre-antes`,
  `muerto-a-media-tool` y `muerto-tras-entregar` (proceso muerto; el archivo se
  envejece 3 min con `utimes` para disparar el silenciado por mtime).
- **orden**: `archivo-primero`, `hook-primero`, `meta-tarde` (`.meta.json` 2 s después).
- **sesion**: `una`, `segunda-nueva`, `cwd-subdir` (cwd dentro del workspace),
  `resume` (SessionEnd + SessionStart), `pausa-reanuda`.
- **servidor**: `normal`, `reinicio-a-la-mitad`, `recarga-a-la-mitad`.

`tipo × cierre` se cruzan completos (24 combinaciones, ahí vive el bug) y cada
una se cruza con un arreglo de cobertura **por pares** de
`(orden, sesion, servidor)`: 15 filas cubren los 45 pares. Total **450 casos**
(30 combinaciones tipo x cierre). Con `--full` se corre el producto cartesiano
completo (1350).

Extras (16): 1/3/8/18 agentes en paralelo, dos agentes con el mismo `name` en
sesiones distintas, `SessionEnd` antes del `SubagentStop`, etiqueta
`tipo · nombre` de más de 30 caracteres, subagente viejo que revive, sesión con
mtime de 15 min al arrancar, y dos sesiones activas con recarga.

Inactividad (4): el timer de 5 min del visor es real y no se puede adelantar, así
que estos casos comparten una sola espera de ~6 min con sus instancias y
pestañas arriba.

## Qué se considera falla

- `nodo-duplicado`: un agente pintado como dos nodos (los canales de archivo y
  de hooks lo etiquetan distinto).
- `nodo-faltante` / `nodo-extra`: falta un agente vivo, o sobra un nodo que no
  corresponde a ningún agente.
- `fantasma-vivo`: un agente que ya terminó sigue apareciendo vivo. Un agente
  terminado que **no** aparece no es falla: el webview desvanece y poda el nodo
  completado a propósito.
- `terminado-de-mas`: un agente que sigue trabajando aparece `complete`.
- `cambio-de-sesion`: al recargar o reiniciar, el visor cambia solo la sesión
  que se estaba viendo.
- `sesion-faltante` / `sesion-equivocada` / `sesion-desconocida`.
- `auto-arista`: arista de un nodo a sí mismo.
- `pageerror`: excepción de JS o error de consola (se filtran los cortes de red
  que provoca el propio rig al reiniciar el servidor).
- `probe-fallo`, `infra-*`: fallas del arnés, se reportan aparte y **no** cuentan
  como fallas del producto.

Cada caso trae un `score` = cantidad de dimensiones fuera del valor por defecto,
así que el escenario mínimo que reproduce una causa es la fila de menor score.

## Límite conocido: agente muerto a media tool

Un subagente cuyo transcript termina con un `tool_use` sin `tool_result`, sin
`SubagentStop` y sin `SessionEnd`, es **indistinguible** de un agente vivo
esperando una tool larga. Ni el visor ni el rig pueden decidirlo con la
información que hay en disco, así que el cierre `muerto-a-media-tool` espera
que el nodo se vea **vivo** y nunca cuenta como falla. Detectarlo requeriría
una señal que hoy no existe, como un heartbeat del proceso.

`muerto-tras-entregar` sí es exigible: el transcript cierra con `end_turn`, así
que tras reiniciar el visor el nodo debe quedar silenciado o terminado.

## Limitaciones frente a Claude Code real

- El contenido de los transcripts es sintético con la forma real (líneas
  `user`/`assistant`/`tool_use`/`tool_result`, `.meta.json` copiado de sesiones
  reales, `"Spawned successfully..."` textual). No hay prompts ni respuestas de
  verdad, así que nada de lo que dependa del texto (etiquetas largas, tokens,
  costos) se ejercita a fondo.
- Los hooks los manda el rig directo al puerto; no corre `hook.js` como proceso.
  Se replican sus efectos observables (`pending-types.json`, enriquecimiento de
  `agent_type`, descarte de sesiones de claude-mem no aplica), pero no sus
  carreras reales entre procesos concurrentes ni su timeout de 1 s.
- No hay proceso `claude` de verdad: no se prueban permisos, `Notification`, ni
  el ritmo real de escritura (el rig escribe ráfagas de milisegundos).
- Los tiempos reales del visor que no se pueden adelantar (5 min de inactividad)
  se cubren con pocos casos; los que sí (`SUBAGENT_STALE_MS` 2 min y
  `ACTIVE_SESSION_AGE_S` 10 min) se fuerzan con `utimes`.
- Se prueba un solo workspace por instancia; no se cubre el caso de varias
  instancias del visor compitiendo por el mismo cwd.

## Corrida contra rondas 8 y 9 (dist `2775dd68`, webview `d892e50e`, 470 casos)

**470 pasados, 0 fallados.** Cero fallas del arnés. Fijada con `--dist-md5`, no
abortó. La pestaña se recuperó sola tras reiniciar en 465 de 465 casos.

Un verde total no sirve si el arnés está ciego, así que se valida contra el dist
sin parchar (`--app` apuntando a `app.js.pristine`): los 6 casos clave
(`m0001`, `m0016`, `m0023`, `m0046`, `m0082`, `m0241`) fallan ahí, con tres
causas distintas. El rig sigue viendo.

### Dos agujeros del arnés corregidos en esta ronda

1. **`settle` con salida temprana.** Salía en cuanto el conteo de nodos cuadraba,
   sin verificar el estado. Ahora el estado esperado se afirma con polling hasta
   agotar el tiempo (6 s, o `RIG_META_DELAY_MS + 3000` en `meta-tarde`) y solo
   falla si nunca llega. Esto era `m0082`: el cierre llega ~2049 ms después del
   `closeAgent`, justo tras aterrizar el meta, y el rig medía a 600 ms.
2. **Ausencia aceptada demasiado pronto.** Como un agente terminado puede estar
   podado, el polding salía en el primer sondeo, antes de que el visor pintara al
   subagente. Ahora un esperado ausente cuenta como poda válida solo si su nodo
   llegó a verse alguna vez. Esto eran las 12 fallas `cwd-subdir` + `meta-tarde`.

Corridas archivadas: `final-2775dd68-polling-corto.txt` (mismo dist, arnés con el
segundo agujero, 458 de 470), `final-92b4b498.txt` (422 de 470),
`final-34a60e76.txt` (315 de 470), `baseline-criterio2.txt` (164 de 380).


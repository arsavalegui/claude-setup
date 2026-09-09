// Generacion de la matriz de casos.
// tipo x cierre se cruzan completos (son las dimensiones donde vive el bug);
// (orden, sesion, servidor) se cubren con un arreglo de cobertura por pares,
// para no pagar 1080 corridas cuando 15 filas ya cubren todos los pares.
'use strict';

const TIPOS = [
  'named-type',            // teammate con name + subagent_type (hook enriquecido)
  'named-sin-enriquecer',  // igual pero hook.js no alcanzo a mapear name->tipo
  'named-sin-type',        // teammate con name y sin subagent_type
  'sin-name',              // Task clasico: subagent_type + description, sin name
  'builtin',               // Plan / Explore / claude-code-guide
  'anidado',               // hijo de un subagente
];
const CIERRES = ['subagentstop', 'solo-end-turn', 'stop-padre-antes', 'muerto-a-media-tool', 'muerto-tras-entregar'];
const ORDENES = ['archivo-primero', 'hook-primero', 'meta-tarde'];
const SESIONES = ['una', 'segunda-nueva', 'cwd-subdir', 'resume', 'pausa-reanuda'];
const SERVIDOR = ['normal', 'reinicio-a-la-mitad', 'recarga-a-la-mitad'];

const DEFAULTS = { tipo: 'named-type', cierre: 'subagentstop', orden: 'archivo-primero', sesion: 'una', servidor: 'normal' };

/** Arreglo de cobertura por pares, goloso y determinista. */
function coberturaPares(params) {
  const nombres = Object.keys(params);
  const todos = [];
  (function cross(i, acc) {
    if (i === nombres.length) { todos.push({ ...acc }); return; }
    for (const v of params[nombres[i]]) cross(i + 1, { ...acc, [nombres[i]]: v });
  })(0, {});

  const pares = new Set();
  for (let i = 0; i < nombres.length; i++)
    for (let j = i + 1; j < nombres.length; j++)
      for (const a of params[nombres[i]])
        for (const b of params[nombres[j]]) pares.add(`${nombres[i]}=${a}|${nombres[j]}=${b}`);

  const filas = [];
  const pendientes = new Set(pares);
  while (pendientes.size) {
    let mejor = null, mejorN = -1;
    for (const c of todos) {
      let n = 0;
      for (let i = 0; i < nombres.length; i++)
        for (let j = i + 1; j < nombres.length; j++)
          if (pendientes.has(`${nombres[i]}=${c[nombres[i]]}|${nombres[j]}=${c[nombres[j]]}`)) n++;
      if (n > mejorN) { mejorN = n; mejor = c; }
    }
    if (mejorN <= 0) break;
    filas.push(mejor);
    for (let i = 0; i < nombres.length; i++)
      for (let j = i + 1; j < nombres.length; j++)
        pendientes.delete(`${nombres[i]}=${mejor[nombres[i]]}|${nombres[j]}=${mejor[nombres[j]]}`);
  }
  return filas;
}

function score(dims) {
  return Object.keys(DEFAULTS).reduce((n, k) => n + (dims[k] === DEFAULTS[k] ? 0 : 1), 0);
}

/** @param {{full?:boolean}} opts */
function matriz(opts = {}) {
  const resto = opts.full
    ? coberturaTotal()
    : coberturaPares({ orden: ORDENES, sesion: SESIONES, servidor: SERVIDOR });
  const casos = [];
  for (const tipo of TIPOS)
    for (const cierre of CIERRES)
      for (const r of resto) {
        const dims = { tipo, cierre, ...r };
        casos.push({ id: `m${String(casos.length + 1).padStart(4, '0')}`, grupo: 'matriz', dims, score: score(dims) });
      }
  return casos;
}

function coberturaTotal() {
  const out = [];
  for (const orden of ORDENES) for (const sesion of SESIONES) for (const servidor of SERVIDOR) out.push({ orden, sesion, servidor });
  return out;
}

/** Escenarios extra pedidos aparte de la matriz. */
function extras() {
  const casos = [];
  const push = (nombre, dims, extra) => casos.push({
    id: `x${String(casos.length + 1).padStart(3, '0')}`, grupo: 'extra', nombre,
    dims: { ...DEFAULTS, ...dims }, extra, score: score({ ...DEFAULTS, ...dims }),
  });

  for (const n of [1, 3, 8, 18])
    for (const cierre of ['subagentstop', 'muerto-tras-entregar'])
      push(`${n} agentes en paralelo (${cierre})`, { cierre }, { paralelo: n });

  push('dos agentes con el mismo name en sesiones distintas', { sesion: 'segunda-nueva' }, { mismoNombre: true });
  push('SessionEnd y despues SubagentStop del hijo', {}, { sessionEndAntes: true });
  push('etiqueta tipo · nombre mas larga que 30 chars', {}, { nombreLargo: true });
  // revivir solo tiene sentido si el agente NO entrego el turno: quedo callado a media tool
  push('subagente viejo (mtime > 2 min) que vuelve a escribir', { cierre: 'muerto-a-media-tool' }, { revive: true });
  push('sesion vieja (mtime > 10 min) al arrancar el servidor', {}, { sesionVieja: true });
  for (const orden of ORDENES) push(`dos sesiones activas, batch de SSE tras recarga (${orden})`, { sesion: 'segunda-nueva', orden }, { dosSesiones: true });

  return casos;
}

/**
 * Casos de inactividad: el timer de 5 min del visor es real y no se puede
 * adelantar, asi que corren juntos con UNA sola espera de ~6 min. Se mantienen
 * pocos porque cada uno necesita su instancia y su pestana abiertas todo el rato.
 */
function inactividad() {
  const casos = [];
  const push = (nombre, dims, extra) => casos.push({
    id: `i${String(casos.length + 1).padStart(3, '0')}`, grupo: 'inactividad', nombre,
    dims: { ...DEFAULTS, ...dims }, extra: { inactivo: true, ...extra }, score: score({ ...DEFAULTS, ...dims }),
  });
  push('agente vivo y callado 6 min (teammate)', { tipo: 'named-type', cierre: 'muerto-a-media-tool' }, {});
  push('agente vivo y callado 6 min (builtin)', { tipo: 'builtin', cierre: 'muerto-a-media-tool' }, {});
  push('agente ya terminado y 6 min de silencio', { tipo: 'named-type', cierre: 'subagentstop' }, {});
  push('agente callado 6 min que vuelve a escribir', { tipo: 'named-type', cierre: 'muerto-a-media-tool' }, { revive: true });
  return casos;
}

/**
 * Casos de persistencia de la sesion principal ante inactividad: a diferencia
 * de inactividad() (staleness de subagentes, timer real de 30 min que no se
 * puede acortar), estos prueban resetInactivityTimer/claude_pid via la env
 * AGENT_FLOW_INACTIVITY_MS acortada — corren en segundos, no en minutos.
 * pidMode: 'vivo' (pid real, ej. el propio proceso del rig) | 'muerto' (pid de
 * un proceso ya salido) | 'sin-pid' (nunca se manda claude_pid, comportamiento
 * de antes).
 */
function inactividadSesion() {
  const casos = [];
  const dimsBase = { tipo: '-', cierre: '-', orden: '-', sesion: '-', servidor: '-' };
  const push = (nombre, pidMode, terminaEsperado) => casos.push({
    id: `is${String(casos.length + 1).padStart(3, '0')}`, grupo: 'inactividad', nombre,
    dims: { ...dimsBase, tipo: `sesion-${pidMode}` }, extra: { pidMode, terminaEsperado }, score: 1,
  });
  push('sesion inactiva con claude_pid vivo: no debe terminar', 'vivo', false);
  push('sesion inactiva con claude_pid muerto: debe terminar', 'muerto', true);
  push('sesion inactiva sin claude_pid: debe terminar (comportamiento previo)', 'sin-pid', true);
  return casos;
}

module.exports = { matriz, extras, inactividad, inactividadSesion, TIPOS, CIERRES, ORDENES, SESIONES, SERVIDOR, DEFAULTS, score };

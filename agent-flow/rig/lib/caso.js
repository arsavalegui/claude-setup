// Ejecucion y evaluacion de un caso: levanta instancia aislada, abre la pagina,
// simula la sesion y mide en tres momentos (vivo, tras recargar, tras reiniciar).
'use strict';
const fs = require('fs');
const path = require('path');
const { Instance, sleep } = require('./instance');
const { Sim } = require('./sim');
const { ProbePage } = require('./page');
const META_DELAY = Number(process.env.RIG_META_DELAY_MS || 2000);

const BUILTINS = ['Plan', 'Explore', 'claude-code-guide'];
const TERMINAL = new Set(['complete', 'completed', 'done']);

function specFor(tipo, n, extra = {}) {
  const suf = extra.nombreLargo ? 'con-un-nombre-larguisimo-de-verdad' : `${n}`;
  switch (tipo) {
    case 'named-type': return { kind: 'named-type', name: `ag${suf}`, subagentType: extra.nombreLargo ? 'investigador' : 'tester', description: `caso ${n} named+type` };
    case 'named-sin-enriquecer': return { kind: 'named-sin-enriquecer', name: `ag${suf}`, subagentType: 'tester', description: `caso ${n} sin enriquecer` };
    case 'named-sin-type': return { kind: 'named-sin-type', name: `ag${suf}`, subagentType: null, description: `caso ${n} name sin tipo` };
    case 'sin-name': return { kind: 'sin-name', subagentType: 'revisor', description: `caso ${n} task sin nombre` };
    case 'builtin': return { kind: 'builtin', subagentType: BUILTINS[n % BUILTINS.length], description: `caso ${n} builtin` };
    case 'anidado': return { kind: 'anidado', subagentType: 'Explore', description: `caso ${n} hijo anidado` };
    default: throw new Error(`tipo desconocido: ${tipo}`);
  }
}

const resumen = (p) => ({
  agentes: (p.agents || []).map((a) => `${a.key}=${a.state}`),
  apiAgentes: (p.apiAgents || []).map((a) => `${a.name}=${a.state}`),
  header: p.headerAgents, sesion: p.selected,
  sesiones: (p.sessions || []).map((s) => `${s.id}:${s.status}`),
  aristas: (p.edges || []).length, sse: p.sse, sseTipos: p.sseTypes, sseAgentes: p.sseAgentes,
  fuente: p.source, probeError: p.probeError,
});

/**
 * Atribuye cada nodo del grafo al agente que le corresponde SIN copiar la logica
 * de etiquetas del visor (que cambia con cada parche): puntua por sufijo del
 * agent_id, por nombre, por descripcion y por tipo, y se queda con el mejor.
 * @returns {Map<object, object>} nodo -> esperado
 */
function atribuir(agentes, esperados) {
  const asign = new Map();
  for (const nodo of agentes) {
    const k = String(nodo.key || nodo.name || '');
    let mejor = null, mejorP = 0;
    for (const e of esperados) {
      const h = e.h || {};
      const id6 = h.agentId ? h.agentId.slice(-6) : null;
      let p = 0;
      if (e.labels && e.labels.includes(k)) p = Math.max(p, 100);
      if (id6 && k.endsWith('-' + id6)) p = Math.max(p, 90);
      if (h.name) {
        if (k === h.name) p = Math.max(p, 70);
        if (k.startsWith(h.name + '-')) p = Math.max(p, 65);
        if (k.endsWith(' · ' + h.name)) p = Math.max(p, 60);
      }
      if (h.desc) {
        const d = h.desc.slice(0, 22);
        if (k === h.desc || k.includes(d) || h.desc.startsWith(k.replace(/^.* · /, ''))) p = Math.max(p, 50);
      }
      if (h.stype && k.startsWith(h.stype + ' · ')
          && esperados.filter((o) => (o.h || {}).stype === h.stype).length === 1) p = Math.max(p, 30);
      if (h.name && k.startsWith(h.name.slice(0, 12))
          && esperados.filter((o) => (o.h || {}).name && o.h.name.startsWith(h.name.slice(0, 12))).length === 1) p = Math.max(p, 25);
      if (p > mejorP) { mejorP = p; mejor = e; }
    }
    if (mejor) asign.set(nodo, mejor);
  }
  return asign;
}

/**
 * @param {object} probe
 * @param {{porSesion:Object, sesionesCreadas:string[], esperaSinSesion?:boolean}} exp
 * @returns {Array<{tag:string, detalle:string}>}
 */
function evaluar(probe, exp) {
  const f = [];
  if (probe.probeError) return [{ tag: 'probe-fallo', detalle: probe.probeError }];
  if (!probe.agents) return [{ tag: 'probe-fallo', detalle: 'no se pudo leer el mapa de agentes del canvas' }];

  const sesiones = (probe.sessions || []).map((s) => s.id);
  if (exp.esperaSinSesion) {
    if (sesiones.length) f.push({ tag: 'sesion-extra', detalle: `no deberia haber sesiones, hay ${sesiones.length}` });
    if ((probe.agents || []).length) f.push({ tag: 'nodo-extra', detalle: `agentes con sesion vieja: ${probe.agents.map((a) => a.key).join(',')}` });
    return f;
  }

  for (const sid of exp.sesionesCreadas) if (!sesiones.includes(sid)) f.push({ tag: 'sesion-faltante', detalle: `falta ${sid.slice(0, 8)} en la lista` });

  const sel = probe.selected;
  if (!sel) { f.push({ tag: 'sesion-desconocida', detalle: 'el visor no reporta sesion seleccionada' }); return f; }
  const grupo = exp.porSesion[sel];
  if (!grupo) { f.push({ tag: 'sesion-equivocada', detalle: `sigue ${String(sel).slice(0, 8)}, que no es ninguna sesion del caso` }); return f; }

  const agentes = probe.agents;
  const orq = agentes.find((a) => a.id === 'orchestrator' || a.key === 'orchestrator')
    || agentes.find((a) => a.isMain);
  if (!orq) f.push({ tag: 'orquestador-faltante', detalle: 'no hay nodo principal' });

  const candidatos = agentes.filter((a) => a !== orq);
  const asign = atribuir(candidatos, grupo.esperados);
  const usados = new Set();
  for (const e of grupo.esperados) {
    const m = candidatos.filter((a) => asign.get(a) === e);
    m.forEach((a) => usados.add(a));
    if (m.length > 1) { f.push({ tag: 'nodo-duplicado', detalle: `${e.nombre}: ${m.map((a) => `${a.key}=${a.state}`).join(' | ')}` }); continue; }
    if (m.length === 0) {
      // Un agente terminado puede estar ausente: el webview desvanece y poda el
      // nodo completado a proposito. Solo falla si un agente VIVO no se ve.
      if (e.expect === 'vivo') f.push({ tag: 'nodo-faltante', detalle: `${e.nombre} deberia verse vivo y no esta` });
      continue;
    }
    const st = m[0].state;
    if (e.expect === 'vivo' && TERMINAL.has(st)) f.push({ tag: 'terminado-de-mas', detalle: `${e.nombre} sigue trabajando y aparece ${st}` });
    if (e.expect === 'terminado' && !TERMINAL.has(st))
      f.push({ tag: 'fantasma-vivo', detalle: `${e.nombre} ya termino y aparece ${st}` });
  }

  for (const a of agentes) {
    if (a === orq || usados.has(a)) continue;
    f.push({ tag: 'nodo-extra', detalle: `nodo no atribuible: ${a.key} (${a.state})` });
  }

  for (const e of probe.edges || []) if (e.from === e.to) f.push({ tag: 'auto-arista', detalle: `${e.from} -> ${e.to}` });

  return f;
}

/**
 * @param {{app:string, port:number, root:string, browser:object}} ctx
 * @param {object} caso
 */
async function runCase(ctx, caso) {
  const d = caso.dims;
  const extra = caso.extra || {};
  const t0 = Date.now();
  const res = { id: caso.id, grupo: caso.grupo, nombre: caso.nombre || null, dims: d, score: caso.score, fallas: [], probes: {}, info: {} };
  let inst = null, pp = null;

  try {
    inst = new Instance({ root: ctx.root, port: ctx.port, app: ctx.app });
    await inst.start();
    pp = await ProbePage.open(ctx.browser, inst.url);

    // ── sesiones ────────────────────────────────────────────────────────
    const cwdA = d.sesion === 'cwd-subdir' ? path.join(inst.ws, '.claude') : inst.ws;
    if (d.sesion === 'cwd-subdir') fs.mkdirSync(cwdA, { recursive: true });
    const simA = new Sim(inst, { label: `Caso ${caso.id} ${d.tipo}/${d.cierre}`, cwd: cwdA });
    const sesionesCreadas = [simA.sessionId];

    if (extra.sesionVieja) {
      // la sesion existe pero su ultima escritura es de hace 15 min: el visor no debe adoptarla
      await simA.sessionStart({ withHook: false });
      simA.backdateSession(15);
      await inst.restart();          // arranca con la sesion ya vieja en disco
      await pp.reload();
      await sleep(2500);
      const p = await pp.probe();
      res.probes.vivo = resumen(p);
      res.fallas.push(...evaluar(p, { esperaSinSesion: true }).map((x) => ({ punto: 'vivo', ...x })));
      res.ms = Date.now() - t0;
      res.ok = res.fallas.length === 0;
      return res;
    }

    await simA.sessionStart();
    await pp.settle((p) => (p.agents || []).length >= 1, 6000);

    // ── agentes de la sesion A ──────────────────────────────────────────
    const orden = d.orden;
    const esperadosA = [];
    const handles = [];
    let padre = null;

    const nAgentes = extra.paralelo || 1;
    for (let i = 0; i < nAgentes; i++) {
      let h;
      if (d.tipo === 'anidado') {
        if (!padre) {
          padre = await simA.spawnAgent({ kind: 'named-type', name: `padre${caso.id}`, subagentType: 'operador', description: `padre de ${caso.id}` }, { order: orden });
          await simA.work(padre, 1);
          esperadosA.push({ nombre: 'padre', labels: padre.labels, expect: 'vivo', h: padre });
        }
        h = await simA.spawnAgent({ ...specFor('anidado', i + 1, extra), parent: padre }, { order: orden });
      } else {
        h = await simA.spawnAgent(specFor(d.tipo, i + 1, extra), { order: orden });
      }
      handles.push(h);
      await simA.work(h, 1);
    }

    // ── segunda sesion ──────────────────────────────────────────────────
    let simB = null; const esperadosB = [];
    if (d.sesion === 'segunda-nueva' || extra.dosSesiones || extra.mismoNombre) {
      simB = new Sim(inst, { label: `Caso ${caso.id} sesion B` });
      sesionesCreadas.push(simB.sessionId);
      await simB.sessionStart();
      const nombreB = extra.mismoNombre ? specFor(d.tipo, 1, extra).name || 'agB' : `agB${caso.id}`;
      const hB = await simB.spawnAgent({ kind: 'named-type', name: nombreB, subagentType: 'revisor', description: `caso ${caso.id} sesion B` }, { order: orden });
      await simB.work(hB, 1);
      esperadosB.push({ nombre: 'agente de la sesion B', labels: hB.labels, expect: 'vivo', h: hB });
      res.info.sesionB = simB.sessionId;
    }

    // ── variantes de sesion ─────────────────────────────────────────────
    if (d.sesion === 'resume') { await simA.sessionEnd('clear'); await sleep(500); await simA.sessionStart(); await simA.userTurn('sigo despues del resume'); }
    if (d.sesion === 'pausa-reanuda') { await sleep(3000); await simA.userTurn('sigo tras la pausa'); }

    // ── interrupcion a la mitad ─────────────────────────────────────────
    if (d.servidor === 'reinicio-a-la-mitad') { await inst.restart(); await sleep(400); await pp.reload(); await sleep(800); }
    else if (d.servidor === 'recarga-a-la-mitad') { await pp.reload(); await sleep(600); }

    // ── cierre ──────────────────────────────────────────────────────────
    if (extra.sessionEndAntes) { await simA.sessionEnd('clear'); await sleep(400); }
    for (const h of handles) await simA.closeAgent(h, d.cierre);
    if (d.cierre.startsWith('muerto-')) for (const h of handles) simA.backdate(h, 3);

    // esperado por agente segun el modo de cierre
    // Turno entregado (stop_reason end_turn) => terminado, con o sin SubagentStop.
    // 'muerto-a-media-tool' y 'stop-padre-antes' dejan el agente realmente vivo:
    // el primero es indistinguible de una tool larga y nunca cuenta como falla.
    const VIVOS = ['stop-padre-antes', 'muerto-a-media-tool'];
    const expectPrincipal = VIVOS.includes(d.cierre) ? 'vivo' : 'terminado';
    for (const h of handles) esperadosA.push({ nombre: h.name || h.desc, labels: h.labels, expect: extra.revive ? 'vivo' : expectPrincipal, h });

    const exp = {
      sesionesCreadas,
      porSesion: { [simA.sessionId]: { esperados: esperadosA }, ...(simB ? { [simB.sessionId]: { esperados: esperadosB } } : {}) },
    };
    // Regla general: el estado esperado se afirma con polling hasta agotar el
    // tiempo; solo falla si nunca llega. 'meta-tarde' necesita mas margen porque
    // el visor no cierra el nodo hasta que aterriza el .meta.json.
    // Un esperado ausente cuenta como poda valida SOLO si su nodo llego a verse:
    // sin esto el polling sale en el primer sondeo, antes de que el visor pinte
    // al subagente, y da verde falso.
    const vistos = new Set();
    const conVistos = (e) => (p) => {
      const g = p.selected && e.porSesion[p.selected];
      if (!g || !p.agents) return false;
      for (const esp of atribuir(p.agents, g.esperados).values()) vistos.add(esp.nombre);
      return g.esperados.every((x) => vistos.has(x.nombre)) && evaluar(p, e).length === 0;
    };
    const listo = conVistos(exp);
    const ESPERA = Number(process.env.RIG_ESPERA_MS) || (d.orden === 'meta-tarde' ? META_DELAY + 3000 : 6000);

    // ── medicion 1: sin recargar ────────────────────────────────────────
    let p1 = await pp.settle(listo, ESPERA);
    res.probes.vivo = resumen(p1);
    res.fallas.push(...evaluar(p1, exp).map((x) => ({ punto: 'vivo', ...x })));

    // ── medicion 2: tras recargar la pagina ─────────────────────────────
    await pp.reload();
    const p2 = await pp.settle(listo, ESPERA);
    res.probes.recarga = resumen(p2);
    res.fallas.push(...evaluar(p2, exp).map((x) => ({ punto: 'recarga', ...x })));

    // ── medicion 3: tras reiniciar la instancia ─────────────────────────
    await inst.restart();
    await sleep(1500);
    const pSolo = await pp.probe();          // informativo: reconecto sin recargar?
    res.info.reconectoSolo = !!(pSolo.agents && pSolo.agents.length);
    // "revive": el agente estaba viejo (silenciado) y vuelve a escribir ya con el
    // servidor nuevo; tiene que despertar y verse vivo.
    if (extra.revive) { for (const h of handles) await simA.work(h, 1); await sleep(400); }
    await pp.reload();
    const expR = JSON.parse(JSON.stringify(exp));
    const listoR = (p) => {
      const g = p.selected && expR.porSesion[p.selected];
      if (!g) return false;
      const ids = (p.sessions || []).map((s) => s.id);
      if (!sesionesCreadas.every((s) => ids.includes(s))) return false;
      return (p.agents || []).length >= 1 + g.esperados.filter((e) => e.expect === 'vivo').length;
    };
    // Cuando lo que se pide es que un nodo NO aparezca, salir en cuanto "ya se ve
    // bien" mide antes de tiempo: el visor todavia puede repintarlo en el
    // siguiente barrido (1 s) o poll (3 s). Se espera el ciclo completo.
    if (d.cierre.startsWith('muerto-')) await sleep(4000);
    const p3 = await pp.settle(listoR, 6000);
    res.probes.reinicio = resumen(p3);
    res.fallas.push(...evaluar(p3, expR).map((x) => ({ punto: 'reinicio', ...x })));

    if (pp.errors.length) res.fallas.push({ punto: 'pagina', tag: 'pageerror', detalle: pp.errors.slice(0, 3).join(' ; ') });

    // la sesion que el usuario estaba viendo no deberia cambiarle sola
    if (sesionesCreadas.length > 1) {
      if (res.probes.recarga.sesion && res.probes.recarga.sesion !== res.probes.vivo.sesion)
        res.fallas.push({ punto: 'recarga', tag: 'cambio-de-sesion', detalle: `seguia ${String(res.probes.vivo.sesion).slice(0, 8)} y tras recargar sigue ${String(res.probes.recarga.sesion).slice(0, 8)}` });
      if (res.probes.reinicio.sesion && res.probes.reinicio.sesion !== res.probes.vivo.sesion)
        res.fallas.push({ punto: 'reinicio', tag: 'cambio-de-sesion', detalle: `seguia ${String(res.probes.vivo.sesion).slice(0, 8)} y tras reiniciar sigue ${String(res.probes.reinicio.sesion).slice(0, 8)}` });
    }

    // perdidas exclusivas de recarga/reinicio: retiqueta para agrupar por causa
    const tagsVivo = new Set(res.fallas.filter((x) => x.punto === 'vivo').map((x) => x.tag));
    for (const x of res.fallas) {
      if (x.punto === 'recarga' && !tagsVivo.has(x.tag) && x.tag === 'nodo-faltante') x.tag = 'perdido-tras-recarga';
      if (x.punto === 'reinicio' && !tagsVivo.has(x.tag) && x.tag === 'nodo-faltante') x.tag = 'perdido-tras-reinicio';
    }
  } catch (e) {
    res.fallas.push({ punto: 'infra', tag: 'infra-' + (e.code || 'error'), detalle: String(e && e.message ? e.message : e) });
  } finally {
    try { if (pp) await pp.close(); } catch {}
    try { if (inst) await inst.stop(); } catch {}
    try { if (inst) inst.destroy(); } catch {}
  }

  res.ms = Date.now() - t0;
  res.ok = res.fallas.length === 0;
  return res;
}

module.exports = { runCase, evaluar, atribuir, specFor, resumen, TERMINAL };

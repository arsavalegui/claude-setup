#!/usr/bin/env node
// Rig de pruebas del visor agent-flow.
//   node run.js                 corre matriz + extras + inactividad
//   node run.js --solo matriz   solo un grupo (matriz|extras|inactividad)
//   node run.js --full          cruza (orden x sesion x servidor) completo (1080 casos)
//   node run.js --workers 4     instancias/pestanas en paralelo
//   node run.js --dist-md5 <md5> aborta si dist/app.js cambia durante la corrida
// Escribe resultados.json y una tabla resumen por stdout.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { TMP, BASE_PORT, WORKERS, RIG_DIR } = require('./lib/config');
const { Instance, PKG_DIR, snapshotDist, sleep } = require('./lib/instance');
const { Sim } = require('./lib/sim');
const { launchBrowser, ProbePage } = require('./lib/page');
const { runCase, evaluar, specFor, resumen } = require('./lib/caso');
const M = require('./lib/matrix');
const { tabla } = require('./lib/tabla');

const argv = process.argv.slice(2);
const flag = (n, def) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : def; };
const has = (n) => argv.includes(n);

const OPTS = {
  full: has('--full'),
  workers: Number(flag('--workers', WORKERS)),
  solo: flag('--solo', null),
  limite: Number(flag('--limite', 0)),
  ids: (flag('--ids', '') || '').split(',').filter(Boolean),
  salida: flag('--salida', path.join(RIG_DIR, 'resultados.json')),
  distMd5: flag('--dist-md5', null),
  app: flag('--app', null),   // correr contra otro dist (p.ej. el pristine) para validar el arnes
};

// md5 del paquete INSTALADO (no del snapshot): detecta que lo parcharon a media corrida
function md5Instalado() {
  try {
    return require('crypto').createHash('md5')
      .update(fs.readFileSync(path.join(PKG_DIR, 'dist', 'app.js'))).digest('hex');
  } catch { return null; }
}
function abortarSiCambio(esperado) {
  const ahora = md5Instalado();
  if (esperado && ahora !== esperado) {
    console.error(`\nABORTADO: dist/app.js cambio durante la corrida (${esperado} -> ${ahora}). Los resultados no serian reproducibles.`);
    process.exit(2);
  }
}

// ── worker: consume casos de una cola, cada uno en su propia instancia ─────
async function worker(slot, cola, ctx, resultados, onDone) {
  const root = path.join(TMP, `w${slot}`);
  const port = BASE_PORT + slot;
  while (cola.length) {
    const caso = cola.shift();
    if (!caso) break;
    const r = await runCase({ ...ctx, root, port }, caso);
    resultados.push(r);
    onDone(r);
  }
}

// ── grupo de inactividad: todas las instancias arriba y UNA espera de 6 min ─
async function correrInactivos(casos, ctx) {
  const out = [];
  const vivos = [];
  for (let i = 0; i < casos.length; i++) {
    const caso = casos[i];
    const inst = new Instance({ root: path.join(TMP, `inact${i}`), port: BASE_PORT + 40 + i, app: ctx.app });
    await inst.start();
    const pp = await ProbePage.open(ctx.browser, inst.url);
    const sim = new Sim(inst, { label: `Inactividad ${caso.id}` });
    await sim.sessionStart();
    await pp.settle((p) => (p.agents || []).length >= 1, 6000);
    let padre = null, h;
    if (caso.dims.tipo === 'anidado') {
      padre = await sim.spawnAgent({ kind: 'named-type', name: `padre${caso.id}`, subagentType: 'operador' });
      h = await sim.spawnAgent({ ...specFor('anidado', 1), parent: padre });
    } else {
      h = await sim.spawnAgent(specFor(caso.dims.tipo, 1));
    }
    await sim.work(h, 1);
    if (caso.dims.cierre === 'subagentstop') await sim.closeAgent(h, 'subagentstop');
    vivos.push({ caso, inst, pp, sim, h, padre });
  }

  console.log(`[inactividad] ${vivos.length} instancias arriba; esperando 6 min de silencio...`);
  await sleep(6 * 60 * 1000 + 15000);

  for (const v of vivos) {
    const { caso, inst, pp, sim, h, padre } = v;
    const res = { id: caso.id, grupo: caso.grupo, nombre: caso.nombre, dims: caso.dims, score: caso.score, fallas: [], probes: {}, info: {} };
    try {
      const esperados = [];
      if (padre) esperados.push({ nombre: 'padre', labels: padre.labels, expect: 'vivo', h: padre });
      esperados.push({ nombre: h.name || h.desc, labels: h.labels, expect: caso.dims.cierre === 'subagentstop' ? 'terminado' : 'vivo', h });
      const exp = { sesionesCreadas: [sim.sessionId], porSesion: { [sim.sessionId]: { esperados } } };

      const p1 = await pp.probe();
      res.probes.silencio = resumen(p1);
      res.fallas.push(...evaluar(p1, exp).map((x) => ({ punto: 'tras-6-min', ...x })));

      if (caso.extra && caso.extra.revive) {
        await sim.work(h, 1);
        const p2 = await pp.settle((p) => (p.agents || []).length >= 1 + esperados.length, 8000);
        res.probes.revive = resumen(p2);
        res.fallas.push(...evaluar(p2, exp).map((x) => ({ punto: 'vuelve-a-escribir', ...x })));
      }

      await pp.reload();
      const p3 = await pp.settle((p) => !!p.selected, 6000);
      res.probes.recarga = resumen(p3);
      res.fallas.push(...evaluar(p3, exp).map((x) => ({ punto: 'recarga', ...x })));

      if (pp.errors.length) res.fallas.push({ punto: 'pagina', tag: 'pageerror', detalle: pp.errors.slice(0, 3).join(' ; ') });
    } catch (e) {
      res.fallas.push({ punto: 'infra', tag: 'infra-error', detalle: String(e.message || e) });
    } finally {
      try { await pp.close(); } catch {}
      try { await inst.stop(); } catch {}
      try { inst.destroy(); } catch {}
    }
    res.ok = res.fallas.length === 0;
    out.push(res);
  }
  return out;
}

// ── grupo de inactividad de SESION (resetInactivityTimer + claude_pid) ─────
// A diferencia de correrInactivos() (staleness de subagentes, timer real de
// 30 min), esto prueba que la sesion principal no se declare "ended" cuando
// el proceso claude sigue vivo. Se acorta INACTIVITY_TIMEOUT_MS via la env
// AGENT_FLOW_INACTIVITY_MS (leida una sola vez al boot de app.js) para correr
// en segundos en vez de minutos.
async function correrInactividadSesion(casos, ctx) {
  if (!casos.length) return [];
  const TIMEOUT_MS = 3000;
  const out = [];
  const prevEnv = process.env.AGENT_FLOW_INACTIVITY_MS;
  process.env.AGENT_FLOW_INACTIVITY_MS = String(TIMEOUT_MS);
  try {
    for (let i = 0; i < casos.length; i++) {
      const caso = casos[i];
      const res = { id: caso.id, grupo: caso.grupo, nombre: caso.nombre, dims: caso.dims, score: caso.score, fallas: [], probes: {}, info: {} };
      let inst = null, pp = null;
      try {
        let claudePid = null;
        if (caso.extra.pidMode === 'vivo') {
          claudePid = process.pid;   // el propio rig: garantizado vivo durante la corrida
        } else if (caso.extra.pidMode === 'muerto') {
          // ponytail: riesgo minimo de reuso de pid por el SO entre la salida
          // del proceso y el probe (segundos despues); aceptable en un rig.
          const dead = spawn('true');
          claudePid = await new Promise((res2) => dead.on('exit', () => res2(dead.pid)));
        }
        inst = new Instance({ root: path.join(TMP, `isesion${i}`), port: BASE_PORT + 60 + i, app: ctx.app });
        await inst.start();
        pp = await ProbePage.open(ctx.browser, inst.url);
        const sim = new Sim(inst, { label: `Inactividad sesion ${caso.id}` });
        await sim.sessionStart({ hookExtra: claudePid ? { claude_pid: claudePid } : {} });
        await pp.settle((p) => (p.agents || []).length >= 1, 6000);

        await sleep(TIMEOUT_MS * 3 + 3000);   // deja pasar >=2 vueltas del timer acortado

        const p1 = await pp.probe();
        res.probes.silencio = { sseTipos: p1.sseTypes, agentes: (p1.agents || []).map((a) => `${a.key}=${a.state}`), sesiones: (p1.sessions || []).map((s) => `${s.id}:${s.status}`) };
        const termino = (p1.sseTypes || []).includes('session-ended');
        if (termino !== caso.extra.terminaEsperado) {
          res.fallas.push({ punto: 'silencio', tag: termino ? 'termino-de-mas' : 'no-termino', detalle: `sseTypes=${JSON.stringify(p1.sseTypes)}` });
        }
        if (!caso.extra.terminaEsperado) {
          const main = (p1.agents || []).find((a) => a.isMain);
          if (!main) res.fallas.push({ punto: 'silencio', tag: 'nodo-faltante', detalle: 'no se ve el nodo principal tras la inactividad' });
          // reconexion: recarga y confirma que la sesion sigue viva, no "WAITING"
          await pp.reload();
          const p2 = await pp.settle((p) => !!p.selected, 6000);
          res.probes.recarga = { sesion: p2.selected, agentes: (p2.agents || []).map((a) => `${a.key}=${a.state}`) };
          if (!p2.selected) res.fallas.push({ punto: 'recarga', tag: 'sesion-desconocida', detalle: 'la sesion desaparecio tras recargar' });
        }
        if (pp.errors.length) res.fallas.push({ punto: 'pagina', tag: 'pageerror', detalle: pp.errors.slice(0, 3).join(' ; ') });
      } catch (e) {
        res.fallas.push({ punto: 'infra', tag: 'infra-error', detalle: String(e.message || e) });
      } finally {
        try { if (pp) await pp.close(); } catch {}
        try { if (inst) await inst.stop(); } catch {}
        try { if (inst) inst.destroy(); } catch {}
      }
      res.ok = res.fallas.length === 0;
      out.push(res);
    }
  } finally {
    if (prevEnv === undefined) delete process.env.AGENT_FLOW_INACTIVITY_MS;
    else process.env.AGENT_FLOW_INACTIVITY_MS = prevEnv;
  }
  return out;
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  if (OPTS.distMd5) abortarSiCambio(OPTS.distMd5);
  const snap = snapshotDist(TMP);
  const md5Fijo = OPTS.distMd5 || snap.hashes['dist/app.js'];
  console.log('dist congelado para esta corrida:', JSON.stringify(snap.hashes, null, 0));

  let casos = [];
  if (!OPTS.solo || OPTS.solo === 'matriz') casos.push(...M.matriz({ full: OPTS.full }));
  if (!OPTS.solo || OPTS.solo === 'extras') casos.push(...M.extras());
  const inactivos = (!OPTS.solo || OPTS.solo === 'inactividad') ? M.inactividad() : [];
  const inactivosSesion = (!OPTS.solo || OPTS.solo === 'inactividad') ? M.inactividadSesion() : [];
  if (OPTS.ids.length) casos = casos.filter((c) => OPTS.ids.includes(c.id));
  if (OPTS.limite) casos = casos.slice(0, OPTS.limite);

  console.log(`casos: ${casos.length} en paralelo (${OPTS.workers} workers) + ${inactivos.length} de inactividad + ${inactivosSesion.length} de inactividad de sesion`);
  const browser = await launchBrowser();
  const ctx = { app: OPTS.app || snap.app, browser };
  const resultados = [];
  const t0 = Date.now();

  if (inactivosSesion.length) resultados.push(...await correrInactividadSesion(inactivosSesion, ctx));
  if (inactivos.length) resultados.push(...await correrInactivos(inactivos, ctx));
  const tMatriz = Date.now();   // el ETA no debe cargar con los 6 min de inactividad

  let hechos = 0;
  const onDone = (r) => {
    hechos++;
    abortarSiCambio(md5Fijo);
    if (!r.ok || hechos % 25 === 0) {
      const tags = [...new Set(r.fallas.map((f) => f.tag))].join(',') || 'ok';
      const eta = ((Date.now() - tMatriz) / hechos) * (casos.length - hechos) / 1000;
      console.log(`[${hechos}/${casos.length}] ${r.id} ${r.dims.tipo}/${r.dims.cierre}/${r.dims.orden}/${r.dims.sesion}/${r.dims.servidor} ${r.ok ? 'OK' : 'FALLA'} ${tags} (${r.ms}ms, faltan ~${Math.round(eta)}s)`);
    }
  };

  const cola = casos.slice();
  await Promise.all(Array.from({ length: OPTS.workers }, (_, i) => worker(i, cola, ctx, resultados, onDone)));
  await browser.close();

  abortarSiCambio(md5Fijo);
  resultados.sort((a, b) => a.id.localeCompare(b.id));
  const salida = {
    meta: {
      fecha: new Date().toISOString(),
      dist: snap.hashes,
      paquete: 'agent-flow-app 0.9.1',
      workers: OPTS.workers, full: OPTS.full,
      duracionS: Math.round((Date.now() - t0) / 1000),
      total: resultados.length,
      pasados: resultados.filter((r) => r.ok).length,
    },
    resultados,
  };
  fs.writeFileSync(OPTS.salida, JSON.stringify(salida, null, 2));
  const t = tabla(resultados);
  console.log('\n' + t);
  console.log(`\nresultados: ${OPTS.salida}`);
  fs.writeFileSync(OPTS.salida.replace(/\.json$/, '') + '-resumen.txt', t + '\n');
  process.exit(0);
})().catch((e) => { console.error('RIG FALLO:', e); process.exit(1); });

// Spike de vocabulario: que valores toma `state`, si el visor poda hijos al
// completar al orquestador, y si las aristas del canal de hooks son auto-aristas.
// Se corre una vez para fijar la tabla contra la que asierta el rig.
'use strict';
const path = require('path');
const { Instance, sleep } = require('./lib/instance');
const { Sim } = require('./lib/sim');
const { launchBrowser, ProbePage } = require('./lib/page');
const { TMP, BASE_PORT } = require('./lib/config');

const snap = (p) => ({
  agentes: (p.agents || []).map((a) => `${a.isMain ? '*' : ''}${a.name}=${a.state}`),   // * = nodo principal
  header: p.headerAgents,
  sesion: p.selected && p.selected.slice(0, 8),
  sesiones: (p.sessions || []).map((s) => `${s.id.slice(0, 8)}:${s.status}`),
  aristas: (p.edges || []).map((e) => `${e.from}->${e.to}(${e.type})`),
  fuente: p.source,
});

(async () => {
  const inst = new Instance({ root: path.join(TMP, 'vocab'), port: BASE_PORT });
  await inst.start();
  const browser = await launchBrowser();
  const pp = await ProbePage.open(browser, inst.url);
  const sim = new Sim(inst, { label: 'Vocabulario de estados' });
  const R = {};

  await sim.sessionStart();
  await pp.settle((p) => (p.agents || []).length >= 1, 6000);
  R['1-sesion-arranca'] = snap(await pp.probe());

  const a = await sim.spawnAgent({ kind: 'named-type', name: 'uno', subagentType: 'tester' });
  await pp.settle((p) => (p.agents || []).length >= 2, 6000);
  R['2-agente-vivo'] = snap(await pp.probe());

  await sim.work(a, 1);
  await sleep(1200);
  R['3-agente-trabajando'] = snap(await pp.probe());

  await sim.closeAgent(a, 'subagentstop');
  await sleep(1500);
  R['4-agente-cerrado'] = snap(await pp.probe());

  await sim.stopTurn();
  await sleep(1500);
  R['5-stop-del-padre'] = snap(await pp.probe());

  // segundo agente vivo + Stop del padre (debe quedar pegado por el guard de activeSubagents)
  const b = await sim.spawnAgent({ kind: 'named-type', name: 'dos', subagentType: 'revisor' });
  await pp.settle((p) => (p.agents || []).length >= 3, 6000);
  await sim.stopTurn();
  await sleep(1500);
  R['6-stop-con-hijo-vivo'] = snap(await pp.probe());

  await sim.sessionEnd();
  await sleep(1500);
  R['7-session-end'] = snap(await pp.probe());

  // SessionEnd y DESPUES el SubagentStop del hijo que seguia vivo
  await sim.closeAgent(b, 'subagentstop');
  await sleep(1500);
  R['8-subagentstop-tras-session-end'] = snap(await pp.probe());

  console.log(JSON.stringify(R, null, 2));
  console.log('pageerrors:', pp.errors);
  await pp.close();
  await browser.close();
  await inst.stop();
  process.exit(0);
})().catch((e) => { console.error('FALLO:', e); process.exit(1); });

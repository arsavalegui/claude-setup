// Pagina Playwright que se queda abierta como la ventana del usuario.
// Toma el estado real que pinta el canvas (simulationRef.current.agents) y,
// si el visor expone window.__afAgents()/__afSession(), los prefiere.
'use strict';
const { execSync } = require('child_process');
module.paths.push(execSync('npm root -g').toString().trim());
const { chromium } = require('playwright');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const INIT = () => {
  window.__rigEvents = [];
  const OrigES = window.EventSource;
  if (OrigES && !window.__rigTapped) {
    window.__rigTapped = true;
    const Tapped = function (url, opts) {
      const es = new OrigES(url, opts);
      es.addEventListener('message', (ev) => {
        try { window.__rigEvents.push({ t: Date.now(), d: JSON.parse(ev.data) }); } catch {}
      });
      es.addEventListener('error', () => { window.__rigSseErrors = (window.__rigSseErrors || 0) + 1; });
      return es;
    };
    Tapped.prototype = OrigES.prototype;
    Tapped.CONNECTING = 0; Tapped.OPEN = 1; Tapped.CLOSED = 2;
    window.EventSource = Tapped;
  }

  window.__rigProbe = function () {
    const out = { agents: null, edges: null, sessions: null, selected: null, headerAgents: null,
                  source: null, sse: (window.__rigEvents || []).length,
                  sseTypes: [...new Set((window.__rigEvents || []).map((e) => e.d && e.d.type))],
                  // eventos de agente crudos, con ms desde el primero: para ver si un
                  // agent_complete llega tarde, nunca, o con otro nombre
                  sseAgentes: (() => {
                    const evs = window.__rigEvents || [];
                    const t0 = evs.length ? evs[0].t : 0;
                    const out = [];
                    for (const e of evs) {
                      const lote = e.d && e.d.type === 'agent-event-batch' ? e.d.events
                                 : e.d && e.d.type === 'agent-event' ? [e.d.event] : [];
                      for (const ev of lote) {
                        const p = ev.payload || {};
                        out.push(`+${e.t - t0}ms ${ev.type}:${p.name || p.agent || p.child || ''}`);
                      }
                    }
                    return out;
                  })(),
                  sseErrors: window.__rigSseErrors || 0 };
    try {
      const txt = document.body.innerText || '';
      const m = txt.match(/(\d+)\s+agents/);
      if (m) out.headerAgents = Number(m[1]);
      out.bodyText = txt.slice(0, 400);
    } catch {}

    // 1) API expuesta por el visor, si existe (se guarda aparte para contrastar)
    try {
      if (typeof window.__afAgents === 'function') {
        const a = window.__afAgents();
        if (a) {
          out.apiAgents = (a instanceof Map ? [...a.values()] : Array.isArray(a) ? a : Object.values(a))
            .map((x) => ({ name: x.name, state: x.state || x.status, parentId: x.parentId ?? x.parent ?? null }));
        }
      }
      if (typeof window.__afSession === 'function') {
        const s = window.__afSession();
        if (s) out.selected = typeof s === 'string' ? s : (s.id || s.sessionId || null);
      }
    } catch (e) { out.apiError = String(e); }

    // 2) fiber de React: es exactamente lo que dibuja el canvas
    try {
      const root = document.getElementById('root');
      const key = root && Object.keys(root).find((k) => k.startsWith('__reactContainer'));
      if (key) {
        const seen = new Set();
        const stack = [root[key]];
        let sim = null, sessions = null, selected = out.selected, n = 0;
        while (stack.length && n < 8000) {
          const f = stack.pop(); n++;
          if (!f || seen.has(f)) continue;
          seen.add(f);
          for (const bag of ['memoizedProps', 'memoizedState']) {
            const b = f[bag];
            if (!b || typeof b !== 'object') continue;
            try {
              const s = b.simulationRef && b.simulationRef.current;
              if (!sim && s && s.agents instanceof Map) sim = s;
            } catch {}
            for (const k of Object.keys(b)) {
              let v; try { v = b[k]; } catch { continue; }
              if (!sessions && Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object'
                  && 'id' in v[0] && 'status' in v[0] && 'label' in v[0]) sessions = v;
              if (selected == null && typeof v === 'string'
                  && (k === 'selectedSessionId' || k === 'activeSessionId' || k === 'sessionId')
                  && /^[0-9a-f-]{8,}$/i.test(v)) selected = v;
            }
          }
          if (f.child) stack.push(f.child);
          if (f.sibling) stack.push(f.sibling);
        }
        if (sim) {
          // el mapa del canvas es la verdad de "que se ve"
          out.source = 'fiber';
          out.agents = [...sim.agents.entries()].map(([k, a]) => ({
            key: k, id: a.id ?? null, name: a.name, state: a.state, parentId: a.parentId ?? null,
            // el nodo principal cambio de clave entre versiones (antes 'orchestrator',
            // ahora la etiqueta de la sesion): se identifica por id y, si no, por no tener padre
            isMain: a.id === 'orchestrator' || k === 'orchestrator' || (a.parentId ?? null) === null,
          }));
          out.edges = (sim.edges || []).map((e) => ({ from: e.from, to: e.to, type: e.type }));
        }
        if (sessions) out.sessions = sessions.map((s) => ({ id: s.id, label: s.label, status: s.status }));
        out.selected = selected;
      }
    } catch (e) { out.fiberError = String(e); }
    return out;
  };
};

async function launchBrowser() {
  return chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
}

class ProbePage {
  constructor(page, url) { this.page = page; this.url = url; this.errors = []; }

  static async open(browser, url) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pp = new ProbePage(page, url);
    page.on('pageerror', (e) => pp.errors.push(String(e && e.message ? e.message : e)));
    // El rig reinicia el servidor a proposito: los cortes de red del SSE son
    // ruido del propio arnes, no errores del visor.
    const RUIDO = /ERR_INCOMPLETE_CHUNKED_ENCODING|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_EMPTY_RESPONSE|ERR_NETWORK_CHANGED|Failed to load resource/i;
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      const t = m.text();
      if (RUIDO.test(t)) { pp.ruido = (pp.ruido || 0) + 1; return; }
      pp.errors.push('console: ' + t.slice(0, 200));
    });
    page.on('crash', () => pp.errors.push('page crash'));
    await page.addInitScript(INIT);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    return pp;
  }

  async probe() {
    try { return await this.page.evaluate(() => window.__rigProbe()); }
    catch (e) { return { probeError: String(e && e.message ? e.message : e), agents: null }; }
  }

  /** Espera hasta que se cumpla `ok(probe)` o se agote el tiempo; devuelve el ultimo probe. */
  async settle(ok, timeoutMs = 5000, stepMs = 250) {
    const t0 = Date.now();
    let last = await this.probe();
    while (Date.now() - t0 < timeoutMs) {
      if (ok && ok(last)) {
        await sleep(600);                    // deja que lleguen los eventos en vuelo
        return await this.probe();
      }
      await sleep(stepMs);
      last = await this.probe();
    }
    return last;
  }

  async reload() {
    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
  }

  async shot(file) { try { await this.page.screenshot({ path: file }); } catch {} }
  async close() { try { await this.page.close(); } catch {} }
}

module.exports = { launchBrowser, ProbePage, sleep };

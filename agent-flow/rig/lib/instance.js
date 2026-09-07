// Instancia aislada de agent-flow-app: HOME propio, workspace propio, puerto propio.
// Nunca toca ~/.claude ni el puerto 3001 de la instancia viva del usuario.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn, execSync } = require('child_process');

const NPM_ROOT = execSync('npm root -g').toString().trim();
const PKG_DIR = path.join(NPM_ROOT, 'agent-flow-app');
const APP = path.join(PKG_DIR, 'dist', 'app.js');
const REAL_DISCOVERY = path.join(os.homedir(), '.claude', 'agent-flow');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Congela el dist actual en un directorio propio: el paquete instalado se puede
 * estar parchando en paralelo y una corrida tiene que ser reproducible.
 * Devuelve { app, hashes } con el md5 de app.js y del bundle del webview.
 */
function snapshotDist(destRoot) {
  const dest = path.join(destRoot, 'dist-snapshot');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(path.join(PKG_DIR, 'dist'), path.join(dest, 'dist'), { recursive: true });
  try { fs.cpSync(path.join(PKG_DIR, 'package.json'), path.join(dest, 'package.json')); } catch {}
  const md5 = (p) => { try { return require('crypto').createHash('md5').update(fs.readFileSync(p)).digest('hex'); } catch { return null; } };
  return {
    app: path.join(dest, 'dist', 'app.js'),
    hashes: {
      'dist/app.js': md5(path.join(dest, 'dist', 'app.js')),
      'dist/webview/index.js': md5(path.join(dest, 'dist', 'webview', 'index.js')),
      'dist/webview/index.css': md5(path.join(dest, 'dist', 'webview', 'index.css')),
    },
  };
}

/** Puertos que usan las instancias REALES del usuario: prohibido pisarlos. */
function realPorts() {
  const out = new Set([3001, 3002]);
  try {
    for (const f of fs.readdirSync(REAL_DISCOVERY)) {
      if (!f.endsWith('.json') || f === 'pending-types.json' || f === 'workspaces.json') continue;
      try {
        const d = JSON.parse(fs.readFileSync(path.join(REAL_DISCOVERY, f), 'utf8'));
        if (d.port) out.add(d.port);
      } catch {}
    }
  } catch {}
  return out;
}

class Instance {
  /** @param {{root:string, port:number, label?:string}} opts */
  constructor(opts) {
    this.root = opts.root;                       // <tmp>/inst-N
    this.home = path.join(this.root, 'home');
    this.ws = path.join(this.root, 'ws');
    this.port = opts.port;
    this.app = opts.app || APP;                  // permite correr contra un dist congelado
    this.label = opts.label || path.basename(this.root);
    this.proc = null;
    this.hookPort = null;
    this.log = [];
  }

  get projectsDir() { return path.join(this.home, '.claude', 'projects'); }
  get discoveryDir() { return path.join(this.home, '.claude', 'agent-flow'); }
  get url() { return `http://127.0.0.1:${this.port}/`; }

  /** slug del proyecto tal como lo calcula agent-flow: realpath con no-alfanumericos a '-' */
  slugFor(cwd) {
    let r = cwd;
    try { r = fs.realpathSync(cwd); } catch {}
    return r.replace(/[^a-zA-Z0-9]/g, '-');
  }

  projectDirFor(cwd) { return path.join(this.projectsDir, this.slugFor(cwd)); }

  async start({ fresh = true } = {}) {
    if (fresh) {
      fs.rmSync(this.root, { recursive: true, force: true });
      fs.mkdirSync(this.projectsDir, { recursive: true });
      fs.mkdirSync(this.ws, { recursive: true });
    }
    const banned = realPorts();
    if (banned.has(this.port)) throw new Error(`puerto ${this.port} pertenece a una instancia real`);

    this.proc = spawn(process.execPath, [this.app, '--no-open', '--port', String(this.port)], {
      cwd: this.ws,
      env: { ...process.env, HOME: this.home, AGENT_FLOW_TELEMETRY: 'false', AGENT_FLOW_RUNTIME: 'claude' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.exited = null;
    this.proc.on('exit', (c, s) => { this.exited = { code: c, signal: s }; });
    const cap = (d) => { this.log.push(String(d)); if (this.log.length > 200) this.log.shift(); };
    this.proc.stdout.on('data', cap);
    this.proc.stderr.on('data', cap);

    this.hookPort = await this.waitHookPort();
    if (banned.has(this.hookPort)) throw new Error(`hookPort ${this.hookPort} choca con instancia real`);
    await this.waitHttp();
    return this;
  }

  async waitHookPort() {
    for (let i = 0; i < 200; i++) {
      await sleep(50);
      if (this.exited) throw new Error(`la instancia murio al arrancar: ${this.log.join('')}`);
      try {
        for (const f of fs.readdirSync(this.discoveryDir)) {
          if (!f.endsWith('.json') || f === 'pending-types.json') continue;
          const d = JSON.parse(fs.readFileSync(path.join(this.discoveryDir, f), 'utf8'));
          if (d.pid === this.proc.pid && d.port) return d.port;
        }
      } catch {}
    }
    throw new Error('no aparecio el discovery file con el pid de la instancia');
  }

  async waitHttp() {
    for (let i = 0; i < 100; i++) {
      const ok = await new Promise((res) => {
        const req = http.get({ hostname: '127.0.0.1', port: this.port, path: '/' }, (r) => { r.resume(); res(r.statusCode === 200); });
        req.on('error', () => res(false));
        req.setTimeout(500, () => { req.destroy(); res(false); });
      });
      if (ok) return;
      await sleep(50);
    }
    throw new Error('el servidor http no respondio');
  }

  /** POST de hook con la misma forma que hook.js (cuerpo JSON crudo a /). */
  hook(payload) {
    return new Promise((resolve) => {
      const body = JSON.stringify(payload);
      const req = http.request({
        hostname: '127.0.0.1', port: this.hookPort, method: 'POST', path: '/',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 2000,
      }, (res) => { res.resume(); res.on('end', () => resolve(true)); });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.write(body); req.end();
    });
  }

  async stop(signal = 'SIGTERM') {
    if (!this.proc || this.exited) return;
    this.proc.kill(signal);
    for (let i = 0; i < 100 && !this.exited; i++) await sleep(30);
    if (!this.exited) { this.proc.kill('SIGKILL'); await sleep(200); }
  }

  /** Reinicio conservando HOME/workspace/puerto: el hookPort cambia (es efimero). */
  async restart() {
    await this.stop();
    await sleep(150);
    await this.start({ fresh: false });
  }

  destroy() {
    try { fs.rmSync(this.root, { recursive: true, force: true }); } catch {}
  }
}

module.exports = { Instance, sleep, APP, PKG_DIR, realPorts, snapshotDist };

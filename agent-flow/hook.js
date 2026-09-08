#!/usr/bin/env node
// Agent Flow hook forwarder v3 — installed by the Agent Flow setup script.
// Claude Code invokes this as a command hook. It reads a discovery directory to
// find live extension instances, checks their PIDs, and forwards the event via
// HTTP POST. Dead instances are cleaned up automatically.
//
// Local addition: Claude Code's SubagentStart/Stop events carry `agent_type` =
// the real subagent_type UNLESS the caller passed a custom `name`, in which
// case agent_type becomes that name and the real type is otherwise lost to
// agent-flow (it only reads `agent_type`, no separate name field). We recover
// the type from the earlier PreToolUse(Agent/Task) event's
// tool_input.subagent_type, cached in pending-types.json since hook.js is a
// fresh process per event. Only the real agent-flow listener (identified by
// its process cmdline) gets the enriched agent_type — other listeners such as
// Centro de Mando already do their own equivalent resolution and expect the
// original raw value untouched.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');

setTimeout(() => process.exit(0), 1500);

const DIR = path.join(os.homedir(), '.claude', 'agent-flow');
const PENDING_FILE = path.join(DIR, 'pending-types.json');
const PENDING_MAX = 2000;
const IS_WIN = process.platform === 'win32';

function normPath(p) {
  let r = path.resolve(p);
  try { r = fs.realpathSync(r); } catch {}
  return r;
}

function isAlive(pid) {
  if (IS_WIN) return true;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function loadPending() {
  try { return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')); } catch { return {}; }
}

// ponytail: no lock — concurrent subagent spawns can race this read-modify-
// write. Worst case a name→type mapping is briefly dropped; purely cosmetic.
// Add a lockfile if that ever matters.
function rememberDelegation(toolInput) {
  if (!toolInput) return;
  // Sin subagent_type, Claude Code usa general-purpose; guardarlo igual para
  // que ambos canales (hooks y transcript) converjan en el mismo nombre.
  const type = toolInput.subagent_type || 'general-purpose';
  const pending = loadPending();
  for (const key of [toolInput.name, toolInput.description]) {
    if (key) pending[key] = type;
  }
  const keys = Object.keys(pending);
  for (const k of keys.slice(0, keys.length - PENDING_MAX)) delete pending[k];
  try { fs.writeFileSync(PENDING_FILE, JSON.stringify(pending)); } catch {}
}

// Returns the body to send to agent-flow: unchanged unless `agent_type` is
// actually a name/description we saw at delegation time, in which case it's
// rewritten to "<real type> · <name>" so the UI shows both.
function enrichedBody(payload, raw) {
  const atype = (payload.agent_type || '').trim();
  if (!atype) return raw;
  const realType = loadPending()[atype];
  if (!realType || realType === atype) return raw;
  return JSON.stringify({ ...payload, agent_type: `${realType} · ${atype}` });
}

const { execFileSync } = require('child_process');
const HAS_PROC = fs.existsSync('/proc/self/stat');

// Línea de comandos de un proceso: /proc en Linux, `ps` en macOS.
function cmdlineOf(pid) {
  try {
    if (HAS_PROC) return fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', timeout: 300 });
  } catch { return ''; }
}

function ppidOf(pid) {
  try {
    if (HAS_PROC) {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      return parseInt(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1], 10);
    }
    return parseInt(execFileSync('ps', ['-o', 'ppid=', '-p', String(pid)], { encoding: 'utf8', timeout: 300 }), 10);
  } catch { return 0; }
}

function cmdlineHasAgentFlow(pid) {
  return cmdlineOf(pid).includes('agent-flow');
}

// claude-mem's worker-service.cjs spawns short-lived `claude` background
// sessions (SDK mode) to condense observations; those fire the same hooks as
// a real interactive session and show up in agent-flow as noise tabs. Detect
// them by walking up the process tree looking for that worker — cheaper and
// more stable than trying to read claude-mem's own supervisor.json.
function isClaudeMemDescendant() {
  let p = process.ppid;
  for (let i = 0; i < 10 && p && p > 1; i++) {
    const cmd = cmdlineOf(p);
    if (!cmd) return false;
    if (cmd.includes('claude-mem') || cmd.includes('worker-service')) return true;
    p = ppidOf(p);
  }
  return false;
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let payload;
  try { payload = JSON.parse(input); } catch { process.exit(0); }
  const cwd = payload && payload.cwd;
  if (!cwd) process.exit(0);

  // Bitácora local de hooks (diagnóstico): una línea JSON por evento, sin
  // contenido de prompts/resultados. Rotación simple: se trunca al pasar 5 MB.
  try {
    const LOG = path.join(DIR, 'hooks.log');
    try { if (fs.statSync(LOG).size > 5e6) fs.truncateSync(LOG, 0); } catch {}
    const ti = payload.tool_input || {};
    fs.appendFileSync(LOG, JSON.stringify({
      ts: new Date().toISOString(),
      ev: payload.hook_event_name,
      sid: payload.session_id,
      agent_id: payload.agent_id,
      agent_type: payload.agent_type,
      tool: payload.tool_name,
      name: ti.name,
      subagent_type: ti.subagent_type,
      cwd,
    }) + '\n');
  } catch {}

  if (payload.hook_event_name === 'PreToolUse' &&
      (payload.tool_name === 'Agent' || payload.tool_name === 'Task')) {
    rememberDelegation(payload.tool_input);
  }

  const resolvedCwd = normPath(cwd);

  let allFiles;
  try {
    allFiles = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'workspaces.json' && f !== 'pending-types.json');
  } catch { process.exit(0); }
  if (!allFiles.length) process.exit(0);

  const matches = [];
  for (const file of allFiles) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8')); } catch { continue; }
    if (!d.workspace || !d.pid || !d.port) continue;

    if (!isAlive(d.pid)) {
      try { fs.unlinkSync(path.join(DIR, file)); } catch {}
      continue;
    }

    const ws = normPath(d.workspace);
    if (resolvedCwd === ws || resolvedCwd.startsWith(ws + path.sep)) {
      matches.push({ d, file, wsLen: ws.length });
    }
  }

  if (!matches.length) process.exit(0);

  matches.sort((a, b) => b.wsLen - a.wsLen);
  const bestLen = matches[0].wsLen;
  let targets = matches.filter(m => m.wsLen === bestLen);

  targets = targets.map(({ d }) => ({ d, isAgentFlow: cmdlineHasAgentFlow(d.pid) }));

  // Skip claude-mem's background condense sessions only for the agent-flow
  // target — other listeners (e.g. Centro de Mando) still get everything.
  if (isClaudeMemDescendant()) {
    targets = targets.filter(t => !t.isAgentFlow);
  }
  if (!targets.length) process.exit(0);

  let pending = targets.length;
  for (const { d, isAgentFlow } of targets) {
    const body = isAgentFlow ? enrichedBody(payload, input) : input;
    let settled = false;
    const finish = () => { if (settled) return; settled = true; done(); };
    const req = http.request({
      hostname: '127.0.0.1', port: d.port, method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      timeout: 1000,
    }, res => { res.resume(); res.on('end', finish); });
    req.on('error', finish);
    req.on('timeout', () => { req.destroy(); });
    req.write(body);
    req.end();
  }

  function done() { if (--pending <= 0) process.exit(0); }
});

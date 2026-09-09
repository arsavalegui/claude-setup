// Simulador de Claude Code: escribe transcripts con la forma real y manda los
// hooks al puerto de la instancia, replicando lo que hace ~/.claude/agent-flow/hook.js
// (incluido pending-types.json y el enriquecimiento de agent_type).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VERSION = '2.1.263';
const SPAWNED_OK = 'Spawned successfully. (This tool result is internal metadata — never quote or paste any part of it, including the ID below, into a user-facing reply.)';
const CHILD_NAME_MAX = 30;   // igual que el visor
// retraso del .meta.json en 'meta-tarde'; 2000 = SUBAGENT_META_MAX_WAIT_MS del visor
const META_DELAY_MS = Number(process.env.RIG_META_DELAY_MS || 2000);
const SUBAGENT_ID_SUFFIX = 6;

let seq = 0;
const uid = (p) => `${p}_${(seq++).toString(36)}${crypto.randomBytes(4).toString('hex')}`;
const hex = (n) => crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);

/** Misma logica de etiqueta que el visor, para saber que nombre produce cada canal. */
function childNameFromInput(input, pendingTypes) {
  let type = input.subagent_type || input.customAgentType;
  if (!type && input.name && pendingTypes) type = pendingTypes[input.name];
  const fallback = input.name || input.description;
  const label = type ? (fallback && fallback !== type ? `${type} · ${fallback}` : type)
                     : (input.description || 'subagent');
  return String(label).slice(0, CHILD_NAME_MAX);
}

class Sim {
  /** @param {import('./instance').Instance} inst */
  constructor(inst, { sessionId, cwd, label } = {}) {
    this.inst = inst;
    this.sessionId = sessionId || crypto.randomUUID();
    this.cwd = cwd || inst.ws;
    this.label = label || `Sesion rig ${this.sessionId.slice(0, 8)}`;
    this.projectDir = inst.projectDirFor(this.cwd);
    this.mainFile = path.join(this.projectDir, `${this.sessionId}.jsonl`);
    this.subDir = path.join(this.projectDir, this.sessionId, 'subagents');
    this.lastUuid = null;
    this.agents = [];
    fs.mkdirSync(this.projectDir, { recursive: true });
  }

  // ── plomeria ────────────────────────────────────────────────────────────
  get pendingFile() { return path.join(this.inst.discoveryDir, 'pending-types.json'); }
  readPending() { try { return JSON.parse(fs.readFileSync(this.pendingFile, 'utf8')); } catch { return {}; } }
  writePending(map) {
    try { fs.mkdirSync(this.inst.discoveryDir, { recursive: true }); } catch {}
    fs.writeFileSync(this.pendingFile, JSON.stringify(map));
  }

  line(file, obj) {
    const uuid = crypto.randomUUID();
    const full = {
      parentUuid: this.lastUuid, isSidechain: !!obj.__sidechain, type: obj.type,
      message: obj.message, uuid, timestamp: new Date().toISOString(), userType: 'external',
      cwd: this.cwd, sessionId: this.sessionId, version: VERSION, gitBranch: 'HEAD',
      ...(obj.__extra || {}),
    };
    if (obj.__agentId) full.agentId = obj.__agentId;
    if (obj.toolUseResult) full.toolUseResult = obj.toolUseResult;
    fs.appendFileSync(file, JSON.stringify(full) + '\n');
    this.lastUuid = uuid;
    return uuid;
  }

  mainLine(obj) { return this.line(this.mainFile, obj); }

  hook(ev, extra = {}) {
    return this.inst.hook({ session_id: this.sessionId, hook_event_name: ev, cwd: this.cwd, ...extra });
  }

  // ── ciclo de vida de la sesion ──────────────────────────────────────────
  async sessionStart({ withHook = true, hookExtra = {} } = {}) {
    this.mainLine({ type: 'user', message: { role: 'user', content: this.label } });
    if (withHook) await this.hook('SessionStart', { source: 'startup', ...hookExtra });
    return this;
  }

  async userTurn(text) {
    this.mainLine({ type: 'user', message: { role: 'user', content: text } });
  }

  async assistantText(text, stopReason = 'end_turn') {
    this.mainLine({
      type: 'assistant',
      message: { id: uid('msg'), role: 'assistant', model: 'claude-opus-4-6', type: 'message',
                 content: [{ type: 'text', text }], stop_reason: stopReason,
                 usage: { input_tokens: 1200, output_tokens: 80 } },
    });
  }

  async stopTurn() { await this.hook('Stop', { stop_hook_active: false }); }
  async sessionEnd(reason = 'clear') { await this.hook('SessionEnd', { reason }); }

  // ── agentes ─────────────────────────────────────────────────────────────
  /**
   * spec: { kind, name, subagentType, description, model, parent }
   *   kind: 'named-type' | 'named-sin-enriquecer' | 'named-sin-type' | 'sin-name' | 'builtin' | 'anidado'
   * opts: { order: 'hook-primero'|'archivo-primero'|'meta-tarde' }
   */
  async spawnAgent(spec, opts = {}) {
    const order = opts.order || 'archivo-primero';
    const kind = spec.kind;
    const teammate = kind.startsWith('named');
    const name = spec.name;
    const stype = spec.subagentType || null;
    const desc = spec.description || `tarea ${name || stype || 'sin nombre'}`;
    const parent = spec.parent || null;         // handle de otro agente (anidado)
    const agentId = teammate ? `a${name}-${hex(16)}` : `a${hex(17)}`;

    // 1) tool_use en el transcript del padre (main o subagente padre)
    const toolUseId = uid('toolu');
    const input = { description: desc, prompt: `Prompt sintetico del rig para ${desc}`, model: spec.model || 'haiku' };
    if (stype) input.subagent_type = stype;
    if (name) input.name = name;

    const parentFile = parent ? parent.file : this.mainFile;
    const parentIsSub = !!parent;
    this.line(parentFile, {
      type: 'assistant', __sidechain: parentIsSub, __agentId: parent ? parent.agentId : undefined,
      message: { id: uid('msg'), role: 'assistant', model: 'claude-opus-4-6', type: 'message',
                 content: [{ type: 'tool_use', id: toolUseId, name: teammate ? 'Agent' : 'Task', input }],
                 stop_reason: 'tool_use', usage: { input_tokens: 900, output_tokens: 120 } },
    });

    // 2) hook.js: PreToolUse(Agent/Task) memoriza name -> subagent_type
    await this.hook('PreToolUse', { tool_name: teammate ? 'Agent' : 'Task', tool_input: input,
                                    ...(parent ? { agent_id: parent.agentId, agent_type: parent.hookType } : {}) });
    const enrich = kind !== 'named-sin-enriquecer';
    if (stype && enrich) {
      const p = this.readPending();
      if (name) p[name] = stype;
      if (desc) p[desc] = stype;
      this.writePending(p);
    }

    // meta.json tal como lo escribe Claude Code
    const meta = parent
      ? { agentType: stype || 'Explore', description: desc, toolUseId, parentAgentId: parent.agentId, spawnDepth: 1, model: spec.model || 'haiku' }
      : teammate
        ? { agentType: name, description: desc, name, spawnDepth: 0, model: spec.model || 'haiku',
            taskKind: 'in_process_teammate', teamName: `session-${this.sessionId.slice(0, 8)}`, color: 'red',
            planModeRequired: false, ...(stype ? { customAgentType: stype } : {}), permissionMode: 'bypassPermissions' }
        : { agentType: stype || 'Explore', description: desc, toolUseId, spawnDepth: 0, model: spec.model || 'haiku' };

    const file = path.join(this.subDir, `agent-${agentId}.jsonl`);
    const metaFile = file.replace(/\.jsonl$/, '.meta.json');
    // agent_type que manda hook.js: enriquecido a "<tipo> · <name>" si conoce el tipo
    const pend = this.readPending();
    const rawType = teammate ? name : (stype || 'Explore');
    const hookType = (pend[rawType] && pend[rawType] !== rawType) ? `${pend[rawType]} · ${rawType}` : rawType;

    const writeFiles = async ({ withMeta = true } = {}) => {
      fs.mkdirSync(this.subDir, { recursive: true });
      if (withMeta) fs.writeFileSync(metaFile, JSON.stringify(meta));
      fs.appendFileSync(file, JSON.stringify({
        parentUuid: null, isSidechain: true, agentId, type: 'user',
        message: { role: 'user', content: `Prompt sintetico del rig para ${desc}` },
        uuid: crypto.randomUUID(), timestamp: new Date().toISOString(), userType: 'external',
        cwd: this.cwd, sessionId: this.sessionId, version: VERSION, gitBranch: 'HEAD',
      }) + '\n');
    };
    const sendStart = () => this.hook('SubagentStart', { agent_id: agentId, agent_type: hookType });

    if (order === 'hook-primero') { await sendStart(); await sleep(120); await writeFiles(); }
    else if (order === 'meta-tarde') {
      await writeFiles({ withMeta: false }); await sendStart();
      setTimeout(() => { try { fs.writeFileSync(metaFile, JSON.stringify(meta)); } catch {} }, META_DELAY_MS);
    } else { await writeFiles(); await sleep(120); await sendStart(); }

    // 3) para teammates el tool_result llega de inmediato con "Spawned successfully"
    if (teammate) {
      this.line(parentFile, {
        type: 'user', __sidechain: parentIsSub, __agentId: parent ? parent.agentId : undefined,
        message: { role: 'user', content: [{ tool_use_id: toolUseId, type: 'tool_result',
          content: [{ type: 'text', text: `${SPAWNED_OK}\nagent_id: ${name}@session-${this.sessionId.slice(0, 8)}\nname: ${name}\nThe agent is now running and will receive instructions via mailbox.` }] }] },
        toolUseResult: { status: 'teammate_spawned', agentId },
      });
      await this.hook('PostToolUse', { tool_name: 'Agent', tool_input: input, tool_response: { status: 'teammate_spawned' },
                                       ...(parent ? { agent_id: parent.agentId, agent_type: parent.hookType } : {}) });
    }

    const handle = { agentId, file, metaFile, toolUseId, name, stype, desc, kind, teammate,
                     hookType, parent, parentFile, parentIsSub, meta, closed: false,
                     labels: this.plausibleLabels({ input, meta, hookType, agentId, teammate }) };
    this.agents.push(handle);
    return handle;
  }

  /** Etiquetas que puede producir cada canal para este agente (para atribuir nodos). */
  plausibleLabels({ input, meta, hookType, agentId, teammate }) {
    const set = new Set();
    set.add(childNameFromInput(input, this.readPending()));
    set.add(childNameFromInput(meta, this.readPending()));
    const enriched = hookType.includes(' · ');
    set.add(enriched ? hookType.slice(0, CHILD_NAME_MAX) : `${hookType}-${agentId.slice(-SUBAGENT_ID_SUFFIX)}`);
    return [...set];
  }

  /** Un poco de trabajo del agente: lineas en su jsonl + hooks de tool. */
  async work(h, n = 1) {
    for (let i = 0; i < n; i++) {
      const tid = uid('toolu');
      const input = { command: `echo rig-${i}`, description: 'paso del rig' };
      await this.hook('PreToolUse', { agent_id: h.agentId, agent_type: h.hookType, tool_name: 'Bash', tool_input: input });
      fs.appendFileSync(h.file, JSON.stringify({
        parentUuid: null, isSidechain: true, agentId: h.agentId, type: 'assistant',
        message: { id: uid('msg'), role: 'assistant', model: 'claude-haiku-4-5', type: 'message',
                   content: [{ type: 'tool_use', id: tid, name: 'Bash', input }], stop_reason: 'tool_use',
                   usage: { input_tokens: 500, output_tokens: 40 } },
        uuid: crypto.randomUUID(), timestamp: new Date().toISOString(), cwd: this.cwd,
        sessionId: this.sessionId, version: VERSION,
      }) + '\n');
      fs.appendFileSync(h.file, JSON.stringify({
        parentUuid: null, isSidechain: true, agentId: h.agentId, type: 'user',
        message: { role: 'user', content: [{ tool_use_id: tid, type: 'tool_result', content: [{ type: 'text', text: `rig-${i}` }] }] },
        uuid: crypto.randomUUID(), timestamp: new Date().toISOString(), cwd: this.cwd,
        sessionId: this.sessionId, version: VERSION,
      }) + '\n');
      await this.hook('PostToolUse', { agent_id: h.agentId, agent_type: h.hookType, tool_name: 'Bash',
                                       tool_input: input, tool_response: { stdout: `rig-${i}`, stderr: '' } });
    }
  }

  /**
   * modo: 'subagentstop' | 'solo-end-turn' | 'stop-padre-antes'
   *     | 'muerto-a-media-tool'  proceso muerto con un tool_use sin resultado
   *     | 'muerto-tras-entregar' proceso muerto despues de entregar el turno
   */
  async closeAgent(h, modo) {
    if (modo === 'muerto-a-media-tool') {                // queda un tool_use colgado
      fs.appendFileSync(h.file, JSON.stringify({
        parentUuid: null, isSidechain: true, agentId: h.agentId, type: 'assistant',
        message: { id: uid('msg'), role: 'assistant', model: 'claude-haiku-4-5', type: 'message',
                   content: [{ type: 'tool_use', id: uid('toolu'), name: 'Bash', input: { command: 'sleep 900', description: 'tool larga' } }],
                   stop_reason: 'tool_use', usage: { input_tokens: 500, output_tokens: 40 } },
        uuid: crypto.randomUUID(), timestamp: new Date().toISOString(), cwd: this.cwd,
        sessionId: this.sessionId, version: VERSION,
      }) + '\n');
      return;
    }

    if (modo === 'stop-padre-antes') {                   // el padre cierra su turno con el hijo vivo
      await this.stopTurn();
      return;
    }

    // linea final del subagente (end_turn) — presente en los dos modos restantes
    fs.appendFileSync(h.file, JSON.stringify({
      parentUuid: null, isSidechain: true, agentId: h.agentId, type: 'assistant',
      message: { id: uid('msg'), role: 'assistant', model: 'claude-haiku-4-5', type: 'message',
                 content: [{ type: 'text', text: `Listo: ${h.desc}` }], stop_reason: 'end_turn',
                 usage: { input_tokens: 800, output_tokens: 60 } },
      uuid: crypto.randomUUID(), timestamp: new Date().toISOString(), cwd: this.cwd,
      sessionId: this.sessionId, version: VERSION,
    }) + '\n');

    // 'muerto-tras-entregar' es igual que 'solo-end-turn' en disco; lo que cambia
    // es que el caso lo envejece 3 min para probar el silenciado por mtime.
    if (modo === 'solo-end-turn' || modo === 'muerto-tras-entregar') { h.closed = true; return; }

    // subagentstop: hook + (para Task no-teammate) tool_result en el padre
    if (!h.teammate) {
      this.line(h.parentFile, {
        type: 'user', __sidechain: h.parentIsSub, __agentId: h.parent ? h.parent.agentId : undefined,
        message: { role: 'user', content: [{ tool_use_id: h.toolUseId, type: 'tool_result',
                    content: [{ type: 'text', text: `Resultado del rig para ${h.desc}` }] }] },
      });
    }
    await this.hook('SubagentStop', { agent_id: h.agentId, agent_type: h.hookType });
    h.closed = true;
  }

  /** Envejece los archivos del agente (mtime) para disparar rutas por antiguedad. */
  backdate(h, minutes) {
    const t = new Date(Date.now() - minutes * 60 * 1000);
    for (const f of [h.file, h.metaFile]) { try { fs.utimesSync(f, t, t); } catch {} }
  }

  backdateSession(minutes) {
    const t = new Date(Date.now() - minutes * 60 * 1000);
    try { fs.utimesSync(this.mainFile, t, t); } catch {}
  }
}

module.exports = { Sim, sleep, childNameFromInput, SPAWNED_OK, CHILD_NAME_MAX };

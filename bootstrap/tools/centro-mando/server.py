#!/usr/bin/env python3
"""Centro de Mando: vista del equipo de agentes de Claude Code, siempre visible.

Sin dependencias externas. Recibe los hooks de Claude Code por HTTP POST (el
reenviador de agent-flow en ~/.claude/agent-flow/hook.js manda cada evento a
todos los servidores registrados en ese directorio), mantiene el estado de cada
agente del roster (~/.claude/agents/*.md) y lo rebroadcastea por SSE a la página.
"""
import glob
import json
import os
import re
import signal
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from queue import Queue, Empty, Full

HOME = os.path.expanduser("~")
PORT = int(os.environ.get("CENTRO_MANDO_PORT", "3002"))
AGENTS_DIR = os.path.join(HOME, ".claude", "agents")
DISC_DIR = os.path.join(HOME, ".claude", "agent-flow")
DISC_FILE = os.path.join(DISC_DIR, f"centro-mando-{os.getpid()}.json")
HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "index.html")
# ponytail: si una terminal se cierra sin SubagentStop/Stop, el agente se apaga solo tras este lapso
IDLE_TIMEOUT = int(os.environ.get("CENTRO_MANDO_IDLE", "600"))
CORE_ID = "claude"
RAW_MAX = 300

lock = threading.Lock()
clients: list[Queue] = []
raw_log: list[dict] = []
agents: dict[str, dict] = {}       # id -> estado
agent_ids: dict[str, str] = {}     # agent_id de Claude Code -> id del roster / ad-hoc
pending: dict[str, str] = {}       # name/description de una delegación -> subagent_type
sessions: dict[str, float] = {}    # session_id -> último evento


def now() -> float:
    return time.time()


def load_roster() -> dict[str, dict]:
    roster = {CORE_ID: node(CORE_ID, "Claude", "Orquestador central: coordina y delega al equipo.", "core")}
    for path in sorted(glob.glob(os.path.join(AGENTS_DIR, "*.md"))):
        try:
            text = open(path, encoding="utf-8").read()
        except OSError:
            continue
        m = re.match(r"---\n(.*?)\n---", text, re.S)
        fm = m.group(1) if m else ""
        name = re.search(r"^name:\s*(.+)$", fm, re.M)
        desc = re.search(r"^description:\s*(.+)$", fm, re.M)
        nid = (name.group(1) if name else os.path.basename(path)[:-3]).strip()
        roster[nid] = node(nid, nid, (desc.group(1).strip() if desc else ""), "roster")
    return roster


def node(nid: str, name: str, desc: str, kind: str) -> dict:
    return {"id": nid, "name": name, "desc": desc, "kind": kind, "status": "standby",
            "step": "", "steps": 0, "tool": "", "last_active": None, "active_since": None, "active_ids": []}


def snapshot() -> dict:
    return {"type": "state", "now": now(), "sessions": len(sessions),
            "agents": [dict(a, active_ids=len(a["active_ids"])) for a in agents.values()]}


def broadcast() -> None:
    msg = json.dumps(snapshot(), ensure_ascii=False)
    for q in list(clients):
        try:
            q.put_nowait(msg)
        except Full:  # cliente atorado: se pierde este frame, el siguiente trae el estado completo
            pass


def preview(tool: str, inp: dict) -> str:
    if not isinstance(inp, dict):
        return tool
    if tool == "Bash":
        return f"Bash: {inp.get('description') or inp.get('command', '')}"[:90]
    if tool in ("Read", "Edit", "Write", "MultiEdit", "NotebookEdit"):
        return f"{tool}: {os.path.basename(str(inp.get('file_path') or inp.get('notebook_path') or ''))}"
    if tool in ("Agent", "Task"):
        return f"delegando: {inp.get('description') or inp.get('subagent_type') or ''}"[:90]
    if tool in ("Grep", "Glob"):
        return f"{tool}: {inp.get('pattern', '')}"[:90]
    if tool == "Skill":
        return f"Skill: {inp.get('skill', '')}"
    if tool.startswith("mcp__"):
        return tool.split("__")[-1]
    return tool


def resolve_actor(ev: dict) -> str:
    """Devuelve el id de nodo al que pertenece el evento."""
    aid = ev.get("agent_id")
    if not aid:
        return CORE_ID
    if aid in agent_ids:
        return agent_ids[aid]
    # agent_type trae el subagent_type, salvo que el orquestador le haya puesto `name`:
    # entonces trae ese nombre y el tipo real se recupera de la delegación (PreToolUse Agent)
    atype = (ev.get("agent_type") or "").strip()
    nid = atype if atype in agents else pending.get(atype, atype) or f"agente-{aid[:6]}"
    if nid not in agents:
        agents[nid] = node(nid, nid, "Agente temporal (no está en el roster).", "adhoc")
    agent_ids[aid] = nid
    return nid


def remember_delegation(inp: dict) -> None:
    if not isinstance(inp, dict) or not inp.get("subagent_type"):
        return
    for key in (inp.get("name"), inp.get("description")):
        if key:
            pending[key] = inp["subagent_type"]
    for key in list(pending)[:-50]:
        pending.pop(key, None)


def activate(a: dict, aid: str | None, step: str) -> None:
    t = now()
    if a["status"] != "activo":
        a["active_since"] = t
    a["status"] = "activo"
    a["step"] = step
    a["last_active"] = t
    if aid and aid not in a["active_ids"]:
        a["active_ids"].append(aid)


def deactivate(a: dict, aid: str | None, step: str) -> None:
    for x in ([aid] if aid else a["active_ids"]):
        agent_ids.pop(x, None)
    a["active_ids"] = [x for x in a["active_ids"] if x != aid] if aid else []
    a["last_active"] = now()
    if a["active_ids"]:
        return
    a["status"] = "standby"
    a["step"] = step
    a["tool"] = ""
    a["active_since"] = None
    if a["kind"] == "adhoc":
        agents.pop(a["id"], None)


def handle(ev: dict) -> None:
    kind = ev.get("hook_event_name", "")
    sid = ev.get("session_id")
    if sid:
        sessions[sid] = now()
    aid = ev.get("agent_id")
    nid = resolve_actor(ev)
    a = agents[nid]
    tool = ev.get("tool_name", "")

    if kind == "SubagentStart":
        atype = ev.get("agent_type") or ""
        activate(a, aid, f"arrancando · {atype}" if atype and atype != nid else "arrancando")
        a["steps"] = 0
    elif kind == "SubagentStop":
        deactivate(a, aid, "terminó")
    elif kind == "PreToolUse":
        a["steps"] += 1
        a["tool"] = tool
        if tool in ("Agent", "Task"):
            remember_delegation(ev.get("tool_input", {}))
        activate(a, aid, preview(tool, ev.get("tool_input", {})))
    elif kind == "PostToolUse":
        activate(a, aid, a["step"] or tool)
    elif kind == "PostToolUseFailure":
        activate(a, aid, f"falló {tool}")
    elif kind == "Notification":
        activate(a, aid, f"aviso: {str(ev.get('message', ''))[:80]}")
    elif kind == "SessionStart":
        activate(a, None, "sesión iniciada")
    elif kind == "Stop":
        if nid == CORE_ID:
            deactivate(a, None, "esperando al dueño")
        else:
            deactivate(a, aid, "terminó")
    elif kind == "SessionEnd":
        if sid:
            sessions.pop(sid, None)
        if nid == CORE_ID and not sessions:
            deactivate(a, None, "sin sesiones")
    else:
        activate(a, aid, kind)


def reap() -> bool:
    """Apaga agentes sin eventos recientes (terminal cerrada, crash, etc.)."""
    t = now()
    changed = False
    for a in list(agents.values()):
        if a["status"] == "activo" and a["last_active"] and t - a["last_active"] > IDLE_TIMEOUT:
            deactivate(a, None, "sin señal, apagado automático")
            changed = True
    for sid, last in list(sessions.items()):
        if t - last > IDLE_TIMEOUT * 6:
            sessions.pop(sid, None)
            changed = True
    return changed


def reaper() -> None:
    while True:
        time.sleep(30)
        with lock:
            if reap():
                broadcast()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):  # silencio
        pass

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/events":
            return self.sse()
        views = {"/state": snapshot, "/raw": lambda: raw_log[-100:], "/roster": lambda: list(agents.values())}
        if self.path in views:
            with lock:  # serializar bajo lock, escribir el socket fuera (un cliente lento no congela los hooks)
                body = json.dumps(views[self.path](), ensure_ascii=False).encode()
            return self._send(200, body, "application/json")
        if self.path in ("/", "/index.html"):
            try:
                return self._send(200, open(INDEX, "rb").read(), "text/html; charset=utf-8")
            except OSError:
                return self._send(500, b"falta index.html", "text/plain")
        self._send(404, b"no", "text/plain")

    def _read_body(self) -> bytes:
        # hook.js manda el JSON con Transfer-Encoding: chunked (sin Content-Length)
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            body = b""
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    while self.rfile.readline().strip():
                        pass
                    return body
                body += self.rfile.read(size)
                self.rfile.readline()
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def do_POST(self):
        try:
            body = self._read_body()
        except (ValueError, OSError):
            body = b""
        self._send(200, b"ok", "text/plain")
        try:
            ev = json.loads(body)
        except ValueError:
            return
        if not isinstance(ev, dict):
            return
        with lock:
            raw_log.append({"t": now(), "ev": {k: v for k, v in ev.items() if k not in ("tool_response",)}})
            del raw_log[:-RAW_MAX]
            try:
                handle(ev)
            except Exception as e:  # nunca tirar el servidor por un evento raro
                print("evento no manejado:", e, file=sys.stderr)
            broadcast()

    def sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        q: Queue = Queue(maxsize=50)
        with lock:
            clients.append(q)
            q.put_nowait(json.dumps(snapshot(), ensure_ascii=False))
        try:
            while True:
                try:
                    msg = q.get(timeout=15)
                    self.wfile.write(f"data: {msg}\n\n".encode())
                except Empty:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            pass
        finally:
            with lock:
                if q in clients:
                    clients.remove(q)


def register() -> None:
    os.makedirs(DISC_DIR, exist_ok=True)
    with open(DISC_FILE, "w") as f:
        json.dump({"port": PORT, "pid": os.getpid(), "workspace": HOME}, f)


def unregister(*_) -> None:
    try:
        os.remove(DISC_FILE)
    except OSError:
        pass
    sys.exit(0)


def main() -> None:
    global agents
    agents = load_roster()
    register()
    signal.signal(signal.SIGTERM, unregister)
    signal.signal(signal.SIGINT, unregister)
    threading.Thread(target=reaper, daemon=True).start()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    srv.daemon_threads = True
    print(f"Centro de Mando en http://127.0.0.1:{PORT}  roster={len(agents) - 1} agentes + Claude", flush=True)
    try:
        srv.serve_forever()
    finally:
        unregister()


if __name__ == "__main__":
    main()

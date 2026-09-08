#!/usr/bin/env python3
"""Autoprueba mínima: python3 test_server.py (sin frameworks)."""
import io
import server


def ev(kind, **kw):
    return dict(hook_event_name=kind, session_id="s1", **kw)


def main():
    server.agents = server.load_roster()
    assert "claude" in server.agents and "tester" in server.agents and "revisor" in server.agents

    # Subagente con `name`: agent_type trae el nombre, el tipo real viene de la delegación
    server.handle(ev("PreToolUse", tool_name="Agent", tool_input={"subagent_type": "tester", "name": "mi-prueba", "description": "x"}))
    server.handle(ev("SubagentStart", agent_id="a1", agent_type="mi-prueba"))
    assert server.agents["tester"]["status"] == "activo", server.agents["tester"]
    assert "mi-prueba" in server.agents["tester"]["step"]
    server.handle(ev("PreToolUse", agent_id="a1", agent_type="mi-prueba", tool_name="Bash", tool_input={"description": "corre tests"}))
    assert server.agents["tester"]["step"] == "Bash: corre tests" and server.agents["tester"]["steps"] == 1
    server.handle(ev("SubagentStop", agent_id="a1", agent_type="mi-prueba"))
    assert server.agents["tester"]["status"] == "standby" and server.agents["tester"]["last_active"]

    # Subagente sin nombre: agent_type es el tipo del roster
    server.handle(ev("SubagentStart", agent_id="a2", agent_type="revisor"))
    assert server.agents["revisor"]["status"] == "activo"
    # Tipo fuera del roster: nodo temporal que aparece y se va
    server.handle(ev("SubagentStart", agent_id="a3", agent_type="Explore"))
    assert server.agents["Explore"]["kind"] == "adhoc"
    server.handle(ev("SubagentStop", agent_id="a3", agent_type="Explore"))
    assert "Explore" not in server.agents
    # Dos instancias del mismo tipo: se apaga hasta que termina la última
    server.handle(ev("SubagentStart", agent_id="a4", agent_type="revisor"))
    server.handle(ev("SubagentStop", agent_id="a2", agent_type="revisor"))
    assert server.agents["revisor"]["status"] == "activo"
    server.handle(ev("SubagentStop", agent_id="a4", agent_type="revisor"))
    assert server.agents["revisor"]["status"] == "standby"

    # Sesión principal: nodo central
    server.handle(ev("PreToolUse", tool_name="Read", tool_input={"file_path": "/a/b.py"}))
    assert server.agents["claude"]["status"] == "activo" and server.agents["claude"]["step"] == "Read: b.py"
    server.handle(ev("Stop"))
    assert server.agents["claude"]["status"] == "standby"
    assert server.snapshot()["sessions"] == 1

    # Reaper: sin señal por más de IDLE_TIMEOUT -> standby
    server.handle(ev("SubagentStart", agent_id="a5", agent_type="revisor"))
    server.agents["revisor"]["last_active"] -= server.IDLE_TIMEOUT + 1
    assert server.reap() and server.agents["revisor"]["status"] == "standby"
    assert "a5" not in server.agent_ids

    # Lectura de cuerpo chunked (así manda hook.js)
    class H(server.Handler):
        def __init__(self, raw):
            self.rfile = io.BytesIO(raw)
            self.headers = {"Transfer-Encoding": "chunked"}
    body = H(b"5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n")._read_body()
    assert body == b"hello world", body
    print("ok")


if __name__ == "__main__":
    main()

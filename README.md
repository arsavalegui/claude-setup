# ~/.claude

Configuración de Claude Code de Alan, versionada y portable entre Linux y macOS.

Aquí viven las instrucciones globales (`CLAUDE.md`), los gates por stack (`rules/`),
los subagentes (`agents/`), los hooks, los comandos y la memoria persistente.

**Para montar todo esto en una máquina nueva, lee
[`bootstrap/README.md`](bootstrap/README.md).**

```bash
git clone <url-del-repo> ~/.claude && ~/.claude/bootstrap/bootstrap.sh --dry-run
```

Este repo es **privado**: aunque no guarda secretos (ver el `.gitignore` y la
sección "Qué NO viaja" del bootstrap), sí describe cómo está armada la máquina.

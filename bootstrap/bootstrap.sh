#!/usr/bin/env bash
# bootstrap.sh — reproduce la configuración de Claude Code de Alan en una máquina nueva.
#
#   git clone <repo> ~/.claude && ~/.claude/bootstrap/bootstrap.sh
#
# Idempotente: correrlo dos veces no rompe nada. Linux y macOS.
# Flags: --skip-browsers  --skip-cbm  --skip-services  --dry-run
set -uo pipefail

CLAUDE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BOOT="$CLAUDE_DIR/bootstrap"

SKIP_BROWSERS=0; SKIP_CBM=0; SKIP_SERVICES=0; DRY=0
for a in "$@"; do
  case "$a" in
    --skip-browsers) SKIP_BROWSERS=1 ;;
    --skip-cbm)      SKIP_CBM=1 ;;
    --skip-services) SKIP_SERVICES=1 ;;
    --dry-run)       DRY=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Flag desconocido: $a"; exit 2 ;;
  esac
done

# ---------- utilería ----------
RED=$'\033[31m'; GRN=$'\033[32m'; YEL=$'\033[33m'; BLD=$'\033[1m'; RST=$'\033[0m'
WARNINGS=()
step() { printf '\n%s==> %s%s\n' "$BLD" "$1" "$RST"; }
ok()   { printf '  %s✓%s %s\n' "$GRN" "$RST" "$1"; }
skip() { printf '  %s·%s %s\n' "$YEL" "$RST" "$1"; }
warn() { printf '  %s!%s %s\n' "$YEL" "$RST" "$1"; WARNINGS+=("$1"); }
die()  { printf '  %s✗%s %s\n' "$RED" "$RST" "$1"; exit 1; }
run()  { if [ "$DRY" = 1 ]; then echo "  [dry-run] $*"; else "$@"; fi; }
# runq: igual que run, pero silencia la salida del comando. No le agregues
# redirecciones al llamarlo o te comes el aviso de dry-run.
runq() { if [ "$DRY" = 1 ]; then echo "  [dry-run] $*"; return 0; fi; "$@" >/dev/null 2>&1; }
have() { command -v "$1" >/dev/null 2>&1; }
sha()  { if have sha256sum; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

case "$(uname -s)" in
  Linux)  OS=linux ;;
  Darwin) OS=macos ;;
  *) die "Sistema no soportado: $(uname -s). Solo Linux y macOS." ;;
esac
case "$(uname -m)" in
  x86_64|amd64) ARCH=amd64 ;;
  arm64|aarch64) ARCH=arm64 ;;
  *) ARCH=amd64; warn "Arquitectura $(uname -m) desconocida, asumiendo amd64." ;;
esac

printf '%s' "$BLD"
echo "bootstrap de ~/.claude"
printf '%s' "$RST"
echo "  destino : $CLAUDE_DIR"
echo "  sistema : $OS/$ARCH   HOME=$HOME"
[ "$DRY" = 1 ] && echo "  modo    : DRY-RUN, no se escribe nada"

# ---------- 0. perfil de la máquina ----------
step "0. Perfil de la máquina"
HOSTSHORT="$(hostname -s 2>/dev/null || hostname)"
MIC_SOURCE=""; SERVICES_ENABLE=""; OLLAMA_BIN=""
PROFILE="$BOOT/machines/$HOSTSHORT.env"
if [ -f "$PROFILE" ]; then
  # shellcheck disable=SC1090
  . "$PROFILE"
  ok "cargado $PROFILE"
else
  warn "sin perfil para '$HOSTSHORT'. Copia bootstrap/machines/ejemplo-mac.env a $HOSTSHORT.env."
fi
[ -z "$SERVICES_ENABLE" ] && SERVICES_ENABLE="agent-flow centro-mando"

# ---------- 1. prerequisitos ----------
step "1. Prerequisitos"
MISSING=()
for c in git python3 curl tar; do have "$c" || MISSING+=("$c"); done
if [ ${#MISSING[@]} -gt 0 ]; then
  echo "  Faltan: ${MISSING[*]}"
  [ "$OS" = macos ] && echo "  Instálalos con: brew install ${MISSING[*]}"
  [ "$OS" = linux ] && echo "  Instálalos con: pkexec pacman -S ${MISSING[*]}   (sin sudo interactivo en esta máquina)"
  die "prerequisitos faltantes"
fi
ok "git, python3, curl, tar presentes"

if ! have node; then
  echo "  node no está instalado. Recomendado (ambos sistemas):"
  echo "    curl https://mise.run | sh && mise use -g node@26 && mise install"
  [ "$OS" = macos ] && echo "    o bien: brew install node"
  die "node ausente"
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  die "node $(node -v) es muy viejo. Se necesita >= 22 (aquí se usa 26). Usa: mise use -g node@26"
fi
ok "node $(node -v)  npm $(npm -v 2>/dev/null || echo '?')"
have claude || warn "el CLI 'claude' no está en el PATH todavía; se instala en el paso 2."

# ---------- 2. paquetes npm globales ----------
step "2. Paquetes npm globales"
# Versiones fijas donde importa. agent-flow-app y playwright van pineados a
# propósito: el patch de 13 hunks solo aplica sobre 0.9.1, y los navegadores que
# baja `playwright install` tienen que casar con la librería 1.63.0.
NPM_PKGS=(
  "@anthropic-ai/claude-code@latest"
  "agent-flow-app@0.9.1"
  "context-mode@latest"
  "omniroute@latest"
  "playwright@1.63.0"
  "tavily-cli@latest"
)
for p in "${NPM_PKGS[@]}"; do
  name="${p%@*}"; [ "${p:0:1}" = "@" ] && name="@${p:1}" && name="${name%@*}"
  want="${p##*@}"
  cur="$(npm ls -g --depth=0 --json 2>/dev/null | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      try{const j=JSON.parse(s);console.log((j.dependencies?.[process.argv[1]]||{}).version||"")}catch{console.log("")}})' "$name")"
  if [ "$cur" = "$want" ] || { [ "$want" = "latest" ] && [ -n "$cur" ]; }; then
    skip "$name ya en $cur"
  else
    runq npm i -g "$p" && ok "$p instalado" || warn "falló npm i -g $p"
  fi
done

# ---------- 3. patch de agent-flow ----------
step "3. Patch de agent-flow (13 hunks)"
NPM_ROOT="$(npm root -g 2>/dev/null)"
AF="$NPM_ROOT/agent-flow-app"
PATCH="$CLAUDE_DIR/agent-flow/agent-flow.patch"
if [ ! -d "$AF" ]; then
  warn "agent-flow-app no está instalado; se salta el patch"
elif [ ! -f "$PATCH" ]; then
  warn "no encuentro $PATCH"
elif ! have patch; then
  warn "el comando 'patch' no está instalado; se salta"
else
  # El patch solo es válido contra los archivos vírgenes de 0.9.1. Se compara
  # contra las copias .pristine del repo antes de tocar nada.
  A_INST="$AF/dist/app.js"; W_INST="$AF/dist/webview/index.js"
  A_PRIS="$CLAUDE_DIR/agent-flow/app.js.pristine"; W_PRIS="$CLAUDE_DIR/agent-flow/webview-index.js.pristine"
  if [ ! -f "$A_INST" ] || [ ! -f "$W_INST" ]; then
    warn "el paquete instalado no tiene dist/app.js o dist/webview/index.js"
  elif (cd "$AF" && patch -p1 -R --dry-run --silent < "$PATCH" >/dev/null 2>&1); then
    skip "el patch ya está aplicado"
  elif [ "$(sha "$A_INST")" != "$(sha "$A_PRIS")" ] || [ "$(sha "$W_INST")" != "$(sha "$W_PRIS")" ]; then
    warn "los archivos instalados no coinciden con los .pristine de 0.9.1. NO se aplica el patch a la fuerza. Revisa la versión del paquete."
  elif ! (cd "$AF" && patch -p1 --dry-run --silent < "$PATCH" >/dev/null 2>&1); then
    warn "patch --dry-run falló pese al sha correcto; no se aplica"
  else
    if [ "$DRY" = 1 ]; then echo "  [dry-run] patch -p1 < $PATCH  (en $AF)"
    else
      cp "$A_INST" "$A_INST.orig-preboot"; cp "$W_INST" "$W_INST.orig-preboot"
      (cd "$AF" && patch -p1 --silent < "$PATCH") && ok "patch aplicado" || warn "el patch falló al aplicarse"
    fi
  fi
fi

# ---------- 4. herramientas fuera de ~/.claude ----------
step "4. Herramientas locales"
run mkdir -p "$HOME/.local/bin" "$HOME/.local/share/centro-mando"

install_tool() { # origen destino
  if [ "$DRY" = 1 ]; then echo "  [dry-run] install -m 755 $1 $2"; return; fi
  install -m 755 "$1" "$2" && ok "$(basename "$2") -> $2"
}
install_tool "$BOOT/tools/pw-shot" "$HOME/.local/bin/pw-shot"

for f in server.py index.html test_server.py README.md; do
  if [ "$DRY" = 1 ]; then echo "  [dry-run] cp $BOOT/tools/centro-mando/$f -> ~/.local/share/centro-mando/"
  else cp "$BOOT/tools/centro-mando/$f" "$HOME/.local/share/centro-mando/$f"; fi
done
ok "centro-mando en ~/.local/share/centro-mando/"

# El grabador de juntas es solo-Linux (depende de pactl/PipeWire).
if [ "$OS" = linux ]; then
  install_tool "$BOOT/tools/mic-meeting-recorder" "$HOME/.local/bin/mic-meeting-recorder"
  if [ -n "$MIC_SOURCE" ]; then
    # MIC_SOURCE es una constante dentro del script, no una variable de entorno.
    # Se reescribe en la copia INSTALADA. La copia del repo conserva el valor de
    # la máquina canónica como default; el perfil de máquina es quien manda.
    if [ "$DRY" = 1 ]; then echo "  [dry-run] inyectar MIC_SOURCE=$MIC_SOURCE"
    else
      python3 - "$HOME/.local/bin/mic-meeting-recorder" "$MIC_SOURCE" <<'PY'
import re, sys
path, src = sys.argv[1], sys.argv[2]
t = open(path, encoding="utf-8").read()
new, n = re.subn(r'^MIC_SOURCE = ".*"$', 'MIC_SOURCE = "%s"' % src, t, count=1, flags=re.M)
if n: open(path, "w", encoding="utf-8").write(new)
sys.exit(0 if n else 1)
PY
      [ $? -eq 0 ] && ok "MIC_SOURCE inyectado: $MIC_SOURCE" || warn "no pude inyectar MIC_SOURCE"
    fi
  else
    warn "MIC_SOURCE vacío: el grabador usará el valor que trae el script. Ajústalo en bootstrap/machines/$HOSTSHORT.env"
  fi
  # venv de faster-whisper. Sin modelos: se bajan solos en la primera junta (~1.5 GB).
  VENV="$HOME/.local/share/mic-meeting-recorder/venv"
  if [ -x "$VENV/bin/python" ]; then
    skip "venv de faster-whisper ya existe"
  elif [ "$DRY" = 1 ]; then echo "  [dry-run] python3 -m venv $VENV && pip install faster-whisper"
  else
    python3 -m venv "$VENV" >/dev/null 2>&1 \
      && "$VENV/bin/pip" install -q --upgrade pip faster-whisper >/dev/null 2>&1 \
      && ok "venv de faster-whisper listo (modelo 'medium' se baja en el primer uso)" \
      || warn "no pude crear el venv de faster-whisper; hazlo a mano"
  fi
  have ffmpeg || warn "ffmpeg no está instalado; el grabador lo necesita (pkexec pacman -S ffmpeg)"
  have pactl  || warn "pactl no está instalado; el grabador lo necesita (pipewire-pulse)"
else
  skip "mic-meeting-recorder es solo-Linux (ver bootstrap/services/launchd/README.md)"
fi

# El skill de omarchy es un symlink a ~/.local/share/omarchy, que solo existe en
# esta laptop. En cualquier otra máquina queda colgado y Claude Code lo ignora.
if [ -e "$HOME/.local/share/omarchy/default/omarchy-skill" ]; then
  ok "skills/omarchy apunta a una instalación real de Omarchy"
else
  skip "skills/omarchy queda colgado (Omarchy no está en esta máquina). Es inofensivo."
fi

# ---------- 5. plugins de Claude Code ----------
step "5. Plugins"
if ! have claude; then
  warn "sin CLI 'claude' no puedo instalar plugins; corre el bootstrap otra vez tras abrir una terminal nueva"
else
  # Los marketplaces y los plugins salen de settings.json, que ya viaja en el repo.
  node -e '
    const s = require(process.argv[1] + "/settings.json");
    for (const [name, m] of Object.entries(s.extraKnownMarketplaces || {}))
      console.log("MARKET\t" + name + "\t" + (m.source?.repo || ""));
    for (const [k, on] of Object.entries(s.enabledPlugins || {}))
      if (on) console.log("PLUGIN\t" + k);
  ' "$CLAUDE_DIR" | while IFS=$'\t' read -r kind a b; do
    if [ "$kind" = MARKET ] && [ -n "$b" ]; then
      runq claude plugin marketplace add "$b" && ok "marketplace $a ($b)" || skip "marketplace $a ya estaba o falló"
    elif [ "$kind" = PLUGIN ]; then
      runq claude plugin install "$a" && ok "plugin $a" || skip "plugin $a ya estaba o falló"
    fi
  done
fi

# ---------- 6. servidores MCP ----------
step "6. Servidores MCP"
if ! have claude; then
  warn "sin CLI 'claude' no puedo registrar MCPs"
else
  mkdir -p "$HOME/.claude/mcp-memory"
  add_mcp() { # nombre json
    if claude mcp get "$1" >/dev/null 2>&1; then skip "MCP $1 ya registrado"; return; fi
    runq claude mcp add-json --scope user "$1" "$2" && ok "MCP $1" || warn "no pude registrar el MCP $1"
  }
  add_mcp memory "{\"type\":\"stdio\",\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-memory\"],\"env\":{\"MEMORY_FILE_PATH\":\"$HOME/.claude/mcp-memory/knowledge.json\"}}"
  add_mcp playwright '{"type":"stdio","command":"npx","args":["-y","@playwright/mcp@0.0.80","--headless","--isolated"],"env":{}}'
  add_mcp n8n-mcp '{"type":"stdio","command":"npx","args":["-y","n8n-mcp"],"env":{"MCP_MODE":"stdio","LOG_LEVEL":"error","DISABLE_CONSOLE_OUTPUT":"true"}}'
  # claude-mem y context-mode llegan como MCP de sus plugins, no se registran aquí.
fi

# ---------- 7. codebase-memory-mcp ----------
step "7. codebase-memory-mcp"
if [ "$SKIP_CBM" = 1 ]; then
  skip "--skip-cbm"
elif have codebase-memory-mcp || [ -x "$HOME/.local/bin/codebase-memory-mcp" ]; then
  CBM="$(command -v codebase-memory-mcp || echo "$HOME/.local/bin/codebase-memory-mcp")"
  ok "ya instalado: $("$CBM" --version 2>/dev/null | head -1)"
  runq "$CBM" config set auto_index true && ok "auto_index = true"
else
  # ~281 MB, no viaja en el repo. Se baja del release de GitHub.
  # No se registra con `claude mcp add-json`: el binario se auto-registra en los
  # clientes con su propio subcomando `install`.
  VER="v0.10.8"
  URL="https://github.com/DeusData/codebase-memory-mcp/releases/download/$VER/codebase-memory-mcp-${OS/macos/darwin}-${ARCH}.tar.gz"
  if [ "$DRY" = 1 ]; then echo "  [dry-run] curl -fsSL $URL | tar -xz -> ~/.local/bin/"
  else
    TMP="$(mktemp -d)"
    if curl -fsSL "$URL" -o "$TMP/cbm.tar.gz" && tar -xzf "$TMP/cbm.tar.gz" -C "$TMP"; then
      BIN="$(find "$TMP" -type f -name 'codebase-memory-mcp*' ! -name '*.tar.gz' | head -1)"
      if [ -n "$BIN" ]; then
        install -m 755 "$BIN" "$HOME/.local/bin/codebase-memory-mcp" && ok "codebase-memory-mcp $VER instalado"
        "$HOME/.local/bin/codebase-memory-mcp" install -y >/dev/null 2>&1 && ok "auto-registrado en los clientes" || warn "el 'install' del binario falló; córrelo a mano"
        "$HOME/.local/bin/codebase-memory-mcp" config set auto_index true >/dev/null 2>&1 && ok "auto_index = true"
      else
        warn "el tar.gz no traía el binario esperado"
      fi
    else
      warn "no pude bajar $URL — revisa el nombre del asset en el release $VER"
    fi
    rm -rf "$TMP"
  fi
fi

# ---------- 8. memoria persistente ----------
step "8. Memoria persistente"
# Claude Code guarda la memoria bajo projects/<$HOME con las / como ->/memory.
SRC_MEM="$CLAUDE_DIR/projects/-home-richer/memory"
SLUG="$(printf '%s' "$HOME" | tr '/' '-')"
DST_MEM="$CLAUDE_DIR/projects/$SLUG/memory"
if [ ! -d "$SRC_MEM" ]; then
  warn "no encuentro la memoria de origen en $SRC_MEM"
elif [ "$SRC_MEM" = "$DST_MEM" ]; then
  ok "el \$HOME coincide con el de origen; la memoria ya está en su lugar"
else
  if [ "$DRY" = 1 ]; then echo "  [dry-run] cp -a $SRC_MEM -> $DST_MEM"
  else
    mkdir -p "$DST_MEM"
    # Sin sobrescribir lo que ya exista en el destino.
    for f in "$SRC_MEM"/*.md; do [ -e "$f" ] && [ ! -e "$DST_MEM/$(basename "$f")" ] && cp "$f" "$DST_MEM/"; done
    ok "memoria copiada a projects/$SLUG/memory/ ($(ls -1 "$DST_MEM" | wc -l | tr -d ' ') archivos)"
  fi
fi

# ---------- 9. servicios ----------
step "9. Servicios"
if [ "$SKIP_SERVICES" = 1 ]; then
  skip "--skip-services"
elif [ "$OS" = linux ]; then
  UD="$HOME/.config/systemd/user"; run mkdir -p "$UD"
  for s in $SERVICES_ENABLE; do
    U="$BOOT/services/systemd/$s.service"
    if [ ! -f "$U" ]; then warn "no hay unit para '$s'"; continue; fi
    if [ "$DRY" = 1 ]; then echo "  [dry-run] instalar y habilitar $s.service"; continue; fi
    cp "$U" "$UD/$s.service"
    systemctl --user daemon-reload
    if systemctl --user enable --now "$s.service" >/dev/null 2>&1; then
      sleep 1
      if systemctl --user is-active --quiet "$s.service"; then ok "$s activo"
      else warn "$s quedó inactivo: revisa 'journalctl --user -u $s -n 30'"; fi
    else
      warn "no pude habilitar $s.service"
    fi
  done
else
  LA="$HOME/Library/LaunchAgents"; run mkdir -p "$LA" "$HOME/Library/Logs"
  for s in $SERVICES_ENABLE; do
    P="$BOOT/services/launchd/com.alan.$s.plist"
    if [ ! -f "$P" ]; then warn "no hay plist para '$s' (ver bootstrap/services/launchd/README.md)"; continue; fi
    if [ "$DRY" = 1 ]; then echo "  [dry-run] instalar y cargar com.alan.$s"; continue; fi
    sed "s|__HOME__|$HOME|g" "$P" > "$LA/com.alan.$s.plist"
    launchctl bootout "gui/$(id -u)/com.alan.$s" >/dev/null 2>&1
    if launchctl bootstrap "gui/$(id -u)" "$LA/com.alan.$s.plist" >/dev/null 2>&1; then ok "com.alan.$s cargado"
    else warn "no pude cargar com.alan.$s"; fi
  done
  echo "  ollama en macOS: brew install ollama && brew services start ollama"
fi

# ---------- 10. navegadores y precalentado ----------
step "10. Navegadores y precalentado"
if [ "$SKIP_BROWSERS" = 1 ]; then
  skip "--skip-browsers"
else
  if [ "$DRY" = 1 ]; then echo "  [dry-run] npx playwright install chromium"
  else
    npx --yes playwright install chromium >/dev/null 2>&1 && ok "chromium de Playwright listo" || warn "falló 'playwright install chromium'"
  fi
  # n8n-mcp corre por npx; precalentar la caché evita el timeout del primer arranque.
  if [ "$DRY" = 1 ]; then echo "  [dry-run] precalentar n8n-mcp"
  else
    (npx --yes n8n-mcp --version >/dev/null 2>&1 &) ; ok "n8n-mcp precalentándose en segundo plano"
  fi
fi

# ---------- 11. verificación ----------
step "11. Verificación"
[ -f "$CLAUDE_DIR/settings.json" ] \
  && node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$CLAUDE_DIR/settings.json" 2>/dev/null \
  && ok "settings.json es JSON válido" || warn "settings.json no parsea"
[ -x "$HOME/.local/bin/pw-shot" ] && ok "pw-shot ejecutable" || warn "pw-shot no quedó ejecutable"
if [ "$OS" = linux ] && [ "$SKIP_SERVICES" != 1 ] && [ "$DRY" != 1 ]; then
  for port in 3001 3002; do
    curl -fsS --max-time 3 "http://127.0.0.1:$port/" >/dev/null 2>&1 \
      && ok "puerto $port responde" || warn "puerto $port no responde todavía"
  done
fi

# ---------- resumen ----------
printf '\n%s==> Listo%s\n' "$BLD" "$RST"
if [ ${#WARNINGS[@]} -gt 0 ]; then
  printf '%sAvisos (%d):%s\n' "$YEL" "${#WARNINGS[@]}" "$RST"
  for w in "${WARNINGS[@]}"; do echo "  - $w"; done
fi
cat <<'EOF'

Falta hacer a mano (ver bootstrap/README.md):
  1. claude  (login con la cuenta, la sesión NO viaja en el repo)
  2. Llaves de API de los proyectos: cada .env vive en su repo, no aquí
  3. ollama pull de los modelos que ocupes
  4. Docker, si el proyecto lo necesita
  5. El vault de Obsidian (~/Notes) se sincroniza aparte
EOF

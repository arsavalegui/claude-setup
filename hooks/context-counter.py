#!/usr/bin/env python3
import json, os, re, sys, glob, time

MODEL_CONTEXT = {
    "claude-sonnet-4-6[1m]":     1_000_000,
    "claude-opus-4-7":           1_000_000,
    "claude-sonnet-4-6":           200_000,
    "claude-haiku-4-5-20251001":   200_000,
    "claude-haiku-4-5":            200_000,
}

try:
    data = json.load(sys.stdin)
    session_id = data.get("session_id", "")
    cwd = data.get("cwd", "")
except Exception:
    sys.exit(0)

if not session_id or not cwd:
    sys.exit(0)

sanitized = re.sub(r"[^a-zA-Z0-9]", "-", cwd).lstrip("-")
project_dir = os.path.expanduser(f"~/.claude/projects/-{sanitized}")

candidates = glob.glob(os.path.join(project_dir, "*.jsonl"))
if not candidates:
    sys.exit(0)
jsonl_path = max(candidates, key=os.path.getmtime)

last_usage = None
last_model = None
try:
    with open(jsonl_path) as f:
        for line in f:
            try:
                d = json.loads(line)
                if d.get("type") == "assistant":
                    msg = d.get("message", {})
                    usage = msg.get("usage", {})
                    if usage:
                        last_usage = usage
                        last_model = msg.get("model") or last_model
            except Exception:
                pass
except Exception:
    sys.exit(0)

_model = last_model or os.environ.get("ANTHROPIC_MODEL", "")
CONTEXT_MAX = MODEL_CONTEXT.get(_model, 1_000_000)

if not last_usage:
    sys.exit(0)

total = (
    last_usage.get("input_tokens", 0)
    + last_usage.get("cache_read_input_tokens", 0)
    + last_usage.get("cache_creation_input_tokens", 0)
)
pct = round(total / CONTEXT_MAX * 100, 1)

payload = {"tokens": total, "pct": pct, "session_id": session_id}

for path in [
    os.path.expanduser(f"~/.claude/context-tokens-{session_id}.json"),
    os.path.expanduser("~/.claude/context-tokens.json"),
    os.path.expanduser(f"~/.claude/context-tokens-cwd-{re.sub(r'[^a-zA-Z0-9]', '-', cwd).lstrip('-')}.json"),
]:
    try:
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            json.dump(payload, f)
        os.replace(tmp, path)
    except Exception:
        pass

cutoff = time.time() - 86400
for old in glob.glob(os.path.expanduser("~/.claude/context-tokens-*.json")):
    try:
        if os.path.getmtime(old) < cutoff:
            os.unlink(old)
    except OSError:
        pass

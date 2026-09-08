#!/bin/bash
# Barra de contexto en tiempo real. Claude Code manda JSON por stdin en cada
# refresco; context_window.used_percentage viene pre-calculado (null antes del
# primer mensaje y justo después de /compact).
python3 -c "
import json, sys
try:
    d = json.load(sys.stdin)
    pct = (d.get('context_window') or {}).get('used_percentage')
    if pct is None:
        print('░░░░░░░░░░ --')
    else:
        filled = min(10, round(pct / 10))
        color = '\033[32m' if pct < 70 else '\033[33m' if pct < 90 else '\033[31m'
        print(f\"{color}{'█' * filled}{'░' * (10 - filled)}\033[0m {pct:.1f}%\")
except Exception:
    print('░░░░░░░░░░ --')
"

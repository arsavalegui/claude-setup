#!/usr/bin/env python3
"""Is a meeting in progress right now?

macOS reports microphone use through power assertions. `pmset -g assertions`
lists a coreaudiod assertion per active audio-in resource, and each block names
the PID that opened it. Resolving that PID is what makes this usable: plenty of
things hold the microphone without being a meeting -- on this machine the OBSBOT
webcam holds it permanently, so a bare "is the mic hot" check is always true.

Exits 0 with the app name on stdout when a meeting app owns the microphone,
exits 1 otherwise.
"""

from __future__ import annotations

import pathlib
import re
import subprocess
import sys

# Substrings matched against the executable path of the process holding the mic.
MEETING_APPS = {
    "MSTeams": "Teams",
    "Microsoft Teams": "Teams",
    "zoom.us": "Zoom",
    "Slack": "Slack",
}


def assertions() -> str:
    try:
        return subprocess.run(
            ["pmset", "-g", "assertions"], capture_output=True, text=True, timeout=10
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return ""


def pids_holding_the_mic(text: str) -> list[int]:
    """PIDs from assertion blocks that list an audio-in resource.

    The block shape is:

        pid 640(coreaudiod): [...] PreventUserIdleSystemSleep named: "..."
            Created for PID: 31235.
            Resources: audio-in AppleUSBAudioEngine:...

    "Created for PID" and "Resources" belong to the assertion above them, so the
    parse tracks the most recent PID and only keeps it once audio-in shows up.
    """
    found: list[int] = []
    current: int | None = None
    for line in text.splitlines():
        created = re.search(r"Created for PID:\s*(\d+)", line)
        if created:
            current = int(created.group(1))
            continue
        if "Resources:" in line and "audio-in" in line and current is not None:
            found.append(current)
            current = None
    return found


def process_path(pid: int) -> str:
    try:
        return subprocess.run(
            ["ps", "-p", str(pid), "-o", "command="],
            capture_output=True,
            text=True,
            timeout=5,
        ).stdout.strip()
    except (subprocess.SubprocessError, OSError):
        return ""


FORCE_FILE = pathlib.Path.home() / ".meeting-recorder" / "FORCE_MEETING"


def meeting_app_in_call() -> str | None:
    """Name of the meeting app holding the microphone, or None.

    Creating FORCE_MEETING forces a positive. Recording only ever happens during
    a real call, which makes the pipeline awkward to exercise on purpose; this
    is the way to test it without waiting for one.
    """
    if FORCE_FILE.exists():
        return "Test"

    for pid in pids_holding_the_mic(assertions()):
        path = process_path(pid)
        for needle, name in MEETING_APPS.items():
            if needle in path:
                return name
    return None


def main() -> int:
    app = meeting_app_in_call()
    if app:
        print(app)
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

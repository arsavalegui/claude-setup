#!/usr/bin/env python3
"""Turn one meeting recording into a note in the Obsidian vault.

Called detached by the watcher, one process per meeting, so a slow transcription
never blocks the next meeting from being recorded.

    wav -> whisper-cli -> transcript -> claude -p -> note in ~/Notes/Meetings

The transcript is saved into the vault alongside the note, as Markdown so that
Obsidian indexes it. Summaries are lossy and this one is generated unattended;
when something in the note reads wrong, the transcript is what settles it.

The audio is deleted once both are written. It is by far the largest artefact
and has nothing left to offer at that point.
"""

from __future__ import annotations

import logging
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

HOME = Path.home()
BASE = HOME / ".meeting-recorder"
VAULT = HOME / "Notes"
NOTES = VAULT / "Meetings"
TRANSCRIPTS = BASE / "transcripts"
# Same folder as the notes, not a subfolder: a transcript of a meeting is
# still the meeting. The "(transcript)" suffix is what tells them apart.
TRANSCRIPTS_VAULT = NOTES
LOGS = BASE / "logs"

# The multilingual model, not the .en one: these meetings switch between Spanish
# and English mid-sentence and the English-only model mangles that.
MODEL = HOME / ".whisper-models" / "ggml-small.bin"

NOTES.mkdir(parents=True, exist_ok=True)
TRANSCRIPTS.mkdir(parents=True, exist_ok=True)
TRANSCRIPTS_VAULT.mkdir(parents=True, exist_ok=True)
LOGS.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(LOGS / "process.log"), logging.StreamHandler()],
)
log = logging.getLogger("process")

PROMPT = """You are writing a meeting note for Alan, a data engineer at Slalom \
working on the AURA project for Stryker and involved in Slalom's Innovation Lab. \
Below is an automatic transcript. It is imperfect: the meeting mixes Spanish and \
English, names are often mangled, and some lines are wrong.

Start your output with a single line in exactly this form:

TITLE: <short title>

The title is what this meeting will be filed under, so it has to say what the \
meeting was actually about. Three to seven words, no date, no the word \
"meeting". "Redis bake-off review with Ahmar" is useful; "Team sync" is not. If \
the transcript is too garbled to tell, use "Unclear - check transcript".

Then a blank line, then the note in English, in Markdown, in this shape:

## Summary
Two or three sentences. What was this meeting actually about?

## Decisions
What was decided. Omit the section if nothing was.

## Action items
Who owes what. Mark Alan's own items clearly. Omit if there are none.

## Open questions
What was raised and left unresolved. Omit if there are none.

## Mentioned
People, tickets, systems and repos that came up, as a plain list.

Rules that matter:
- Only what the transcript supports. Do not invent an action item to fill a \
section; an empty section is information too.
- If the transcript is too garbled to tell what happened, say so plainly instead \
of guessing.
- Attribute something to a person only when the transcript makes it clear.
- Keep it short. This note gets re-read; a wall of text does not.

Output the Markdown only. No preamble."""


def transcribe(wav: Path) -> str | None:
    if not MODEL.exists():
        log.error("Whisper model missing at %s", MODEL)
        return None

    out_base = TRANSCRIPTS / wav.stem
    log.info("Transcribing %s", wav.name)
    result = subprocess.run(
        [
            "whisper-cli",
            "-m", str(MODEL),
            "-f", str(wav),
            "-l", "auto",
            "-otxt",
            "-of", str(out_base),
            "-np",
        ],
        capture_output=True,
        text=True,
        timeout=7200,
    )
    if result.returncode != 0:
        log.error("whisper-cli failed: %s", result.stderr[-500:])
        return None

    produced = out_base.with_suffix(".txt")
    if not produced.exists():
        log.error("whisper-cli reported success but wrote no transcript")
        return None

    text = produced.read_text(errors="replace").strip()
    log.info("Transcript is %d characters", len(text))
    return text or None


def write_up(transcript: str) -> str | None:
    log.info("Asking Claude for the write-up")
    result = subprocess.run(
        ["claude", "-p", PROMPT],
        input=transcript,
        capture_output=True,
        text=True,
        timeout=900,
    )
    if result.returncode != 0:
        log.error("claude failed: %s", result.stderr[-500:])
        return None
    return result.stdout.strip() or None


def split_title(note: str) -> tuple[str, str]:
    """Pull the TITLE line off the front of the write-up.

    Falls back to a generic name rather than failing: a note filed under a dull
    title is still a note, and losing the meeting over a formatting slip is not.
    """
    lines = note.splitlines()
    if lines and lines[0].strip().upper().startswith("TITLE:"):
        title = lines[0].split(":", 1)[1].strip()
        return (title or "Untitled"), "\n".join(lines[1:]).lstrip("\n")
    return "Untitled", note


def safe_filename(text: str, limit: int = 60) -> str:
    """Trim a title down to something a filesystem and Obsidian both accept."""
    cleaned = re.sub(r"[/\\:*?\"<>|\n\r\t]", " ", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return (cleaned[:limit].rstrip() or "Untitled")


def save_transcript(transcript: str, when: datetime, title: str, app: str, minutes: str) -> Path:
    """Keep the transcript inside the vault so Obsidian can actually search it.

    As Markdown, not .txt: Obsidian only indexes Markdown, and a transcript that
    cannot be searched is the half of this that gets used least and matters most
    when a summary turns out to be wrong.
    """
    name = f"{when.strftime('%Y-%m-%d %H-%M')} {safe_filename(title)} (transcript)"
    path = TRANSCRIPTS_VAULT / f"{name}.md"
    header = [
        f"# {name}",
        "",
        f"Raw transcript, {app}, {minutes} min. Automatic and imperfect; names in "
        "particular come out mangled.",
        "",
        "---",
        "",
    ]
    path.write_text("\n".join(header) + transcript + "\n")
    return path


def save(note: str, when: datetime, title: str, app: str, minutes: str, transcript_link: str) -> Path:
    stem = f"{when.strftime('%Y-%m-%d %H-%M')} {safe_filename(title)}"
    path = NOTES / f"{stem}.md"

    front = [
        f"# {stem}",
        "",
        f"**When:** {when.strftime('%A %d %B %Y, %H:%M')}  ",
        f"**Duration:** {minutes} min  ",
        f"**Source:** {app}  ",
        f"**Transcript:** [[{transcript_link}]]",
        "",
        "Written up automatically from an imperfect transcript. Check the "
        "transcript before acting on anything that matters.",
        "",
        "---",
        "",
    ]
    path.write_text("\n".join(front) + note + "\n")
    return path


def main() -> int:
    if len(sys.argv) < 4:
        print("usage: process.py <wav> <app> <minutes>", file=sys.stderr)
        return 2

    wav, app, minutes = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
    if not wav.exists():
        log.error("No recording at %s", wav)
        return 1

    transcript = transcribe(wav)
    if not transcript:
        # The audio is the only remaining copy, so it stays until a transcript
        # exists. Deleting here would lose the meeting outright.
        log.error("Nothing transcribed; keeping %s", wav.name)
        return 1

    when = datetime.strptime("_".join(wav.stem.split("_")[0:2]), "%Y-%m-%d_%H-%M")

    raw = write_up(transcript)
    if raw:
        title, note = split_title(raw)
    else:
        # The transcript survived, which is the part that matters. File it under
        # a name that says the summary is missing rather than losing the meeting.
        title, note = "Write-up failed", "## Summary\n\nThe write-up failed; see the transcript.\n"

    transcript_path = save_transcript(transcript, when, title, app, minutes)
    # The vault copy is the one that gets read and searched; the working copy
    # whisper wrote is now a duplicate.
    (TRANSCRIPTS / f"{wav.stem}.txt").unlink(missing_ok=True)
    path = save(note, when, title, app, minutes, transcript_path.stem)
    log.info("Wrote %s", path)

    # Only now: the transcript is in the vault and the note is written, so the
    # audio has nothing left to offer and it is by far the largest artefact.
    size_mb = wav.stat().st_size / 1_000_000
    wav.unlink(missing_ok=True)
    log.info("Deleted the recording (%.0f MB)", size_mb)
    return 0


if __name__ == "__main__":
    sys.exit(main())

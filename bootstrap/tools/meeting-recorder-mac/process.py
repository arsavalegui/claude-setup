#!/usr/bin/env python3
"""Turn one meeting recording into a note in the Obsidian vault.

Called detached by the watcher, one process per meeting, so a slow transcription
never blocks the next meeting from being recorded.

    wav -> whisper-cli -> transcript -> claude -p -> note in ~/Notes/Meetings

The raw transcript stays local, as plain text under ~/.meeting-recorder/transcripts,
never in the vault: it is unedited whisper output, not something meant to be read
on its own. The note's frontmatter points at that local path, so a summary that
reads wrong can still be checked against the original.

If the write-up fails, no note is written: the transcript and the audio both stay
on disk so nothing is lost, and the failure is logged.

The audio is deleted once the note is written. It is by far the largest artefact
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
LOGS = BASE / "logs"

# The multilingual model, not the .en one: these meetings switch between Spanish
# and English mid-sentence and the English-only model mangles that.
MODEL = HOME / ".whisper-models" / "ggml-small.bin"

NOTES.mkdir(parents=True, exist_ok=True)
TRANSCRIPTS.mkdir(parents=True, exist_ok=True)
LOGS.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(LOGS / "process.log"), logging.StreamHandler()],
)
log = logging.getLogger("process")

# Shared with the Linux recorder: same sections, in Spanish, embedded in
# mic-meeting-recorder's CLAUDE_SYSTEM_PROMPT. Change both together.
TEMPLATE_PATH = HOME / ".claude" / "bootstrap" / "tools" / "meeting-note-template.md"

# Used only if the file above is missing, so a note is never lost over a
# missing file. Keep this in sync with meeting-note-template.md by hand.
TEMPLATE_FALLBACK = """\
## Context
One short paragraph: what the meeting was actually about, participants if named.

## Points discussed
- Point 1
- Point 2
- Point 3

## Decisions
- Decision 1 (or "None" if nothing was decided)

## Action items
- [ ] Owner — what (Alan's items first). "None" if there are none.

## Open questions
- Question 1 (omit this section if there are none)

## Related notes
- [[wikilink]] to an existing vault note (omit this section if none apply)

Rules that matter:
- Only what the transcript supports. Never invent an item to fill a section; an empty section is information too.
- Attribute something to a person only when the transcript makes it clear.
- No emojis, anywhere.
- Keep it short. This note gets re-read; a wall of text does not.
- Output Markdown only, starting at "## Context". No preamble, no code fences."""


def load_template() -> str:
    """Read the shared note structure, embedded fallback if the file is gone."""
    try:
        text = TEMPLATE_PATH.read_text()
    except OSError:
        log.warning("Template missing at %s, using the embedded fallback", TEMPLATE_PATH)
        return TEMPLATE_FALLBACK
    # Strip the leading HTML comment: it documents the file for humans, not for
    # the model reading the prompt.
    body = re.sub(r"^<!--.*?-->\s*", "", text, flags=re.DOTALL).strip()
    if body != TEMPLATE_FALLBACK:
        log.warning("Template file and embedded fallback differ; keep them in sync")
    return body


# Persona and transcript caveats, module-level so write_up() can reuse it if
# build_prompt() blows up building the rest of the prompt.
PERSONA = """You are writing a meeting note for Alan, a data engineer at Slalom \
working on the AURA project for Stryker and involved in Slalom's Innovation Lab. \
Below is an automatic transcript. It is imperfect: the meeting mixes Spanish and \
English, names are often mangled, and some lines are wrong.

Start your output with a single line in exactly this form:

TITLE: <short title>

The title is what this meeting will be filed under, so it has to say what the \
meeting was actually about. Three to seven words, no date, no the word \
"meeting". "Redis bake-off review with Ahmar" is useful; "Team sync" is not. If \
the transcript is too garbled to tell, use "Unclear - check transcript".

Then a blank line, then the note in English, in Markdown, in this shape:"""


def build_prompt() -> str:
    """Persona and transcript caveats, then the shared template, then the vault's
    actual notes so a wikilink never points at something that does not exist."""
    vault_notes = sorted(p.stem for p in VAULT.glob("*.md"))
    allowed_links = (
        'The only notes that already exist in the vault, and so the only valid '
        'wikilink targets for "Related notes", are: '
        + (", ".join(vault_notes) if vault_notes else "(none yet)")
    )
    return f"{PERSONA}\n\n{load_template()}\n\n{allowed_links}"


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
    try:
        prompt = build_prompt()
    except Exception:
        # A broken template file or vault listing must not cost the transcript:
        # fall back to the embedded skeleton with no wikilink targets.
        log.exception("build_prompt failed, falling back to the embedded template")
        prompt = (
            f"{PERSONA}\n\n{TEMPLATE_FALLBACK}\n\n"
            'No vault notes could be listed; omit "Related notes".'
        )
    result = subprocess.run(
        ["claude", "-p", prompt],
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


def save(note: str, when: datetime, title: str, app: str, minutes: str, transcript_path: Path) -> Path:
    stem = f"{when.strftime('%Y-%m-%d %H-%M')} {safe_filename(title)}"
    path = NOTES / f"{stem}.md"

    front = [
        "---",
        "tags: [meeting, auto-transcript]",
        f"date: {when.strftime('%Y-%m-%d')}",
        f'time: "{when.strftime("%H:%M")}"',
        f"duration_min: {int(minutes)}",
        f"source: {app}",
        f'transcript: "{transcript_path}"',
        "auto_transcript: true",
        "---",
        "",
        f"# {stem}",
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
    transcript_path = TRANSCRIPTS / f"{wav.stem}.txt"

    raw = write_up(transcript)
    if not raw:
        # The transcript is on disk, which is the part that matters. A note
        # built from nothing is worse than no note; leave it for a human to
        # write up from the transcript, or to retry later.
        log.error("Write-up failed; transcript kept at %s", transcript_path)
        return 1

    title, note = split_title(raw)
    path = save(note, when, title, app, minutes, transcript_path)
    log.info("Wrote %s", path)

    # Only now: the transcript is on disk and the note is written, so the
    # audio has nothing left to offer and it is by far the largest artefact.
    size_mb = wav.stat().st_size / 1_000_000
    wav.unlink(missing_ok=True)
    log.info("Deleted the recording (%.0f MB)", size_mb)
    return 0


if __name__ == "__main__":
    sys.exit(main())

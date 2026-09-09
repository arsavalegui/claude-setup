<!--
Canonical structure for automatic meeting notes.

The macOS meeting recorder (`process.py`, both in `~/.meeting-recorder/` and
the repo copy under `bootstrap/tools/meeting-recorder-mac/`) loads this file
at runtime to build the write-up prompt. The Linux `mic-meeting-recorder`
carries the same sections in Spanish, embedded directly in
`CLAUDE_SYSTEM_PROMPT`. Change both together when the structure changes.
-->

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
- Output Markdown only, starting at "## Context". No preamble, no code fences.

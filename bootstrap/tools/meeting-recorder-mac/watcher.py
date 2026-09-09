#!/usr/bin/env python3
"""Watch for meetings, record them, hand each recording off to be written up.

Runs continuously under launchd. The loop is deliberately dumb: poll, compare to
the last state, act on the transition.

Audio routing, which is the part that is easy to get wrong. It depends on
MIC_SOURCE in ~/.claude/bootstrap/machines/<hostname>.env:

  auto (default)
    Decided fresh at the start of each recording, not once at import: if
    SwitchAudioSource sees a Corsair device among the inputs, record as
    "corsair" below, otherwise as "mac". A headset unplugged between
    meetings used to leave the recorder pointed at a dead Aggregate Device
    -- 2.6s of audio, then digital zeros for the rest of the meeting.

  corsair
    output -> Multi-Output Device  (headset + BlackHole, so the meeting is both
                                    audible and captured)
    input  -> Aggregate Device     (BlackHole = everyone else, headset mic = me)
    The output device is switched only for the duration of a meeting and
    restored afterwards, so normal audio is untouched the rest of the day.

  mac
    input  -> MacBook Pro Microphone, nothing else. With the meeting on the
    speakers the same microphone hears me and everyone else, so there is no
    loopback to route and the output device is never touched.
"""

from __future__ import annotations

import logging
import re
import signal
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from detect import meeting_app_in_call  # noqa: E402

HOME = Path.home()
BASE = HOME / ".meeting-recorder"
RECORDINGS = BASE / "recordings"
LOGS = BASE / "logs"

POLL_SECONDS = 10
# Below this, it was a voice note or a mis-click, not a meeting worth writing up.
MIN_MEETING_SECONDS = 120
# Meetings are noisy at the edges; a couple of missed polls should not end one.
GRACE_POLLS = 3

# Must match the ffmpeg -ar/-ac below; used to size the silence check window.
SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2  # pcm_s16le
WAV_HEADER_BYTES = 44

# A capture device that drops mid-meeting (this MIC_SOURCE=auto exists because
# of one) keeps writing a same-size file of digital zeros, indistinguishable
# from a good recording by stat() alone. Check the tail every ~30s once the
# recording is old enough to have real content, and only once per meeting --
# if the fallback goes silent too there is nothing left to switch to.
SILENCE_CHECK_AFTER_SECONDS = 40
SILENCE_CHECK_INTERVAL_SECONDS = 30
SILENCE_CHECK_TAIL_SECONDS = 20

# One Aggregate Device (BlackHole + the microphones), downmixed to mono, the same
# thing the macOS screen recorder does when it is pointed at that device, and
# the only capture path that has produced usable audio inside a Teams call.
# Opening BlackHole and the headset as two separate avfoundation inputs looked
# better on paper (each side at full level) but in a live call it produced an
# hour of full-scale noise that whisper turned into Georgian: the headset
# changes format when Teams grabs it and the second input keeps decoding the
# old one. CoreAudio resamples inside the aggregate, so it survives that.
#
# The downmix averages the channels, which is what made the old recordings
# quiet; dynaudnorm below brings the level back up instead of touching the mix.
def machine_profile() -> dict[str, str]:
    """KEY="value" pairs from the per-machine env file of the claude-setup repo.

    Same file bootstrap.sh reads, so the machine is described in one place.
    Missing file or key means the defaults below; a typo is not fatal.
    """
    host = subprocess.run(["hostname", "-s"], capture_output=True, text=True).stdout.strip()
    path = HOME / ".claude" / "bootstrap" / "machines" / f"{host}.env"
    profile: dict[str, str] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            profile[key.strip()] = value.strip().strip('"').strip("'")
    return profile


MIC_SOURCE = machine_profile().get("MIC_SOURCE", "auto").lower() or "auto"

# (capture, fallback, monitor) devices per forced mode. "auto" (or anything
# else, e.g. a missing/misspelled value) picks one of these in
# capture_devices() at Recorder.start() time, not here, so a headset plugged
# or unplugged between meetings is picked up on the next recording.
DEVICES = {
    "corsair": ("Aggregate Device", "BlackHole 2ch", "Multi-Output Device"),
    "mac": ("MacBook Pro Microphone", None, None),
}

RECORDINGS.mkdir(parents=True, exist_ok=True)
LOGS.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.FileHandler(LOGS / "watcher.log"), logging.StreamHandler()],
)
log = logging.getLogger("watcher")


def run(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, timeout=15, **kwargs)


def current_output() -> str:
    return run(["SwitchAudioSource", "-c", "-t", "output"]).stdout.strip()


def set_output(device: str) -> bool:
    result = run(["SwitchAudioSource", "-s", device, "-t", "output"])
    if result.returncode != 0:
        log.error("Could not switch output to %s: %s", device, result.stderr.strip())
        return False
    return True


def device_index(name: str) -> int | None:
    """avfoundation refers to inputs by index, and indices move between reboots."""
    try:
        listing = subprocess.run(
            ["ffmpeg", "-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
            capture_output=True,
            text=True,
            timeout=20,
        ).stderr
    except Exception:
        # Same reasoning as capture_devices(): a hang here must come back as
        # "not found", which start() already treats as failure, not raise
        # into a caller that has already committed to a Recorder.
        log.exception("Could not list ffmpeg audio devices")
        return None
    in_audio = False
    for line in listing.splitlines():
        if "AVFoundation audio devices" in line:
            in_audio = True
            continue
        if not in_audio:
            continue
        # Lines look like: [AVFoundation indev @ 0x...] [0] Aggregate Device
        # so the index is the last bracketed number before the name.
        match = re.search(r"\[(\d+)\]\s+(.+)$", line)
        if match and match.group(2).strip() == name:
            return int(match.group(1))
    return None


def input_devices() -> list[str]:
    """Names SwitchAudioSource currently sees among the audio inputs."""
    listing = run(["SwitchAudioSource", "-a", "-t", "input"]).stdout
    return [line.strip() for line in listing.splitlines() if line.strip()]


def capture_devices() -> tuple[str, str | None, str | None]:
    """(capture, fallback, monitor) devices to use for this recording.

    MIC_SOURCE "corsair"/"mac" force a mode. Anything else ("auto", missing,
    a typo) checks for the headset right now instead of trusting a value
    fixed at import, so a device plugged or unplugged since the watcher
    started is still picked up correctly.
    """
    if MIC_SOURCE in DEVICES:
        mode = MIC_SOURCE
        log.info("MIC_SOURCE=%s -> recording as %s (forced)", MIC_SOURCE, mode)
        return DEVICES[mode]

    try:
        inputs = input_devices()
    except Exception:
        # SwitchAudioSource hanging or erroring must not leave capture_devices()
        # raising into Recorder.start(): the caller has already committed to a
        # Recorder by then, and a half-built one with no ffmpeg process would
        # get handed off at meeting end for a file that never existed.
        log.exception("MIC_SOURCE=auto: could not list inputs, defaulting to mac")
        return DEVICES["mac"]

    mode = "corsair" if any("corsair" in name.lower() for name in inputs) else "mac"
    # Logging the raw listing, not just the verdict, is what tells a future
    # "recorded mac but the headset was plugged in" apart from a genuinely
    # absent headset -- the failure mode a naming mismatch here would
    # produce is silent otherwise.
    log.info("MIC_SOURCE=%s -> recording as %s (inputs seen: %s)", MIC_SOURCE, mode, inputs)
    return DEVICES[mode]


def tail_is_silent(path: Path, seconds: int = SILENCE_CHECK_TAIL_SECONDS) -> bool:
    """True if the last `seconds` of a 16-bit PCM wav are all-zero samples.

    A zero int16 sample is two zero bytes and a nonzero sample has at least
    one nonzero byte, so checking the raw bytes is the same check without
    needing struct/array.
    """
    size = path.stat().st_size
    if size <= WAV_HEADER_BYTES:
        return False  # nothing recorded yet, not the failure this checks for
    want = seconds * SAMPLE_RATE * BYTES_PER_SAMPLE
    with path.open("rb") as f:
        f.seek(max(WAV_HEADER_BYTES, size - want))
        tail = f.read()
    return not any(tail)


class Recorder:
    """One ffmpeg process writing one meeting to disk."""

    def __init__(self, app: str):
        self.app = app
        self.started = datetime.now()
        stamp = self.started.strftime("%Y-%m-%d_%H-%M")
        self.path = RECORDINGS / f"{stamp}_{app}.wav"
        self.previous_output = current_output()
        self.process: subprocess.Popen | None = None

    def start(self, devices: tuple[str, str | None, str | None] | None = None) -> bool:
        capture_device, fallback_device, monitor_device = devices or capture_devices()

        index = device_index(capture_device)
        if index is None and fallback_device:
            # Without the aggregate there is no microphone, but the far side is
            # still worth having. Without BlackHole there is no meeting to record.
            index = device_index(fallback_device)
            if index is not None:
                log.warning("%s not found; recording %s only (no microphone)", capture_device, fallback_device)
        if index is None:
            log.error("%s not found among the audio inputs; not recording", capture_device)
            return False

        if monitor_device and self.previous_output != monitor_device and not set_output(monitor_device):
            log.warning("Recording anyway, but system audio will be missing")

        # Downmixed to 16 kHz mono because that is what whisper wants. Both
        # sides end up in one track; there is no speaker separation either way.
        # stderr goes to a file, not a pipe: nobody is reading the pipe while the
        # meeting runs, and a full pipe buffer would stall ffmpeg. It is also the
        # only record of why a recording came out empty.
        self.stderr_path = LOGS / f"{self.path.stem}.ffmpeg.log"
        self.stderr_file = self.stderr_path.open("w")

        command = [
            "ffmpeg", "-hide_banner", "-loglevel", "warning",
            # Without -nostdin ffmpeg tries to read the terminal for keyboard
            # commands. There is no terminal under launchd.
            "-nostdin",
            "-f", "avfoundation", "-i", f":{index}",
            "-ac", "1", "-ar", "16000",
            # Adaptive gain: the N-channel average leaves speech around -30 dB,
            # and whisper does markedly worse on quiet input. Frame and gain
            # sizes are wide so it lifts the level without pumping on pauses.
            "-af", "dynaudnorm=f=500:g=31:p=0.9",
            "-y", str(self.path),
        ]

        self.process = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=self.stderr_file,
        )
        log.info("Recording %s -> %s", self.app, self.path.name)
        return True

    def stop(self) -> float:
        """Stop, restore audio, return the duration in seconds."""
        if self.process and self.process.poll() is None:
            # SIGINT rather than kill: ffmpeg finalises the file on its way out,
            # and a killed process leaves an unreadable wav.
            self.process.send_signal(signal.SIGINT)
            try:
                self.process.wait(timeout=20)
            except subprocess.TimeoutExpired:
                log.warning("ffmpeg did not exit; killing it")
                self.process.kill()

        if getattr(self, "stderr_file", None):
            self.stderr_file.close()

        size = self.path.stat().st_size if self.path.exists() else 0
        complaint = ""
        if getattr(self, "stderr_path", None) and self.stderr_path.exists():
            complaint = self.stderr_path.read_text(errors="replace").strip()

        if complaint:
            log.error("ffmpeg said: %s", complaint[:800])
        if size == 0:
            log.error("Recording is empty: %s", self.path.name)

        if self.previous_output and current_output() != self.previous_output:
            set_output(self.previous_output)

        return (datetime.now() - self.started).total_seconds()


def hand_off(path: Path, app: str, minutes: float) -> None:
    """Transcribe and write up, detached so the watcher keeps watching."""
    subprocess.Popen(
        [sys.executable, str(BASE / "process.py"), str(path), app, f"{minutes:.0f}"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    log.info("Handed off %s for transcription", path.name)


def main() -> None:
    log.info("Watching for meetings. Poll %ss, minimum %ss. MIC_SOURCE=%s", POLL_SECONDS, MIN_MEETING_SECONDS, MIC_SOURCE)
    recorder: Recorder | None = None
    quiet_polls = 0
    last_silence_check: datetime | None = None
    silence_swapped = False

    while True:
        try:
            app = meeting_app_in_call()

            if app and recorder is None:
                recorder = Recorder(app)
                if not recorder.start():
                    recorder = None
                quiet_polls = 0
                last_silence_check = None
                silence_swapped = False

            elif app:
                quiet_polls = 0

                old_enough = recorder is not None and (
                    datetime.now() - recorder.started
                ).total_seconds() >= SILENCE_CHECK_AFTER_SECONDS
                due = last_silence_check is None or (
                    datetime.now() - last_silence_check
                ).total_seconds() >= SILENCE_CHECK_INTERVAL_SECONDS
                if recorder is not None and not silence_swapped and old_enough and due:
                    last_silence_check = datetime.now()
                    if tail_is_silent(recorder.path):
                        log.error(
                            "%s has gone silent (device likely dropped mid-meeting); "
                            "switching to the mac microphone for the rest of this meeting, keeping the file so far",
                            recorder.path.name,
                        )
                        recorder.stop()
                        recorder = Recorder(app)
                        if not recorder.start(devices=DEVICES["mac"]):
                            recorder = None
                        silence_swapped = True

            elif recorder is not None:
                # Do not end on the first quiet poll: muting, a device switch or
                # a screen-share handover can drop the microphone for a moment.
                quiet_polls += 1
                if quiet_polls >= GRACE_POLLS:
                    seconds = recorder.stop()
                    path, meeting_app = recorder.path, recorder.app
                    recorder = None
                    quiet_polls = 0

                    if seconds < MIN_MEETING_SECONDS:
                        log.info("Only %.0fs, discarding %s", seconds, path.name)
                        path.unlink(missing_ok=True)
                    else:
                        log.info("Meeting ended after %.1f minutes", seconds / 60)
                        hand_off(path, meeting_app, seconds / 60)

            time.sleep(POLL_SECONDS)

        except KeyboardInterrupt:
            if recorder is not None:
                recorder.stop()
            log.info("Stopped")
            return
        except Exception:
            # A watcher that dies on one bad poll is worse than one that logs
            # and carries on; the next poll usually succeeds.
            log.exception("Poll failed")
            time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()

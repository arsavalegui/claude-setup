#!/usr/bin/env python3
"""Watch for meetings, record them, hand each recording off to be written up.

Runs continuously under launchd. The loop is deliberately dumb: poll, compare to
the last state, act on the transition.

Audio routing, which is the part that is easy to get wrong. It depends on
MIC_SOURCE in ~/.claude/bootstrap/machines/<hostname>.env:

  corsair (default)
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


MIC_SOURCE = machine_profile().get("MIC_SOURCE", "corsair").lower() or "corsair"

if MIC_SOURCE == "mac":
    CAPTURE_DEVICE = "MacBook Pro Microphone"
    FALLBACK_DEVICE = None
    MONITOR_DEVICE = None
else:
    CAPTURE_DEVICE = "Aggregate Device"
    FALLBACK_DEVICE = "BlackHole 2ch"
    MONITOR_DEVICE = "Multi-Output Device"

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
    listing = subprocess.run(
        ["ffmpeg", "-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
        capture_output=True,
        text=True,
        timeout=20,
    ).stderr
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


class Recorder:
    """One ffmpeg process writing one meeting to disk."""

    def __init__(self, app: str):
        self.app = app
        self.started = datetime.now()
        stamp = self.started.strftime("%Y-%m-%d_%H-%M")
        self.path = RECORDINGS / f"{stamp}_{app}.wav"
        self.previous_output = current_output()
        self.process: subprocess.Popen | None = None

    def start(self) -> bool:
        index = device_index(CAPTURE_DEVICE)
        if index is None and FALLBACK_DEVICE:
            # Without the aggregate there is no microphone, but the far side is
            # still worth having. Without BlackHole there is no meeting to record.
            index = device_index(FALLBACK_DEVICE)
            if index is not None:
                log.warning("%s not found; recording %s only (no microphone)", CAPTURE_DEVICE, FALLBACK_DEVICE)
        if index is None:
            log.error("%s not found among the audio inputs; not recording", CAPTURE_DEVICE)
            return False

        if MONITOR_DEVICE and self.previous_output != MONITOR_DEVICE and not set_output(MONITOR_DEVICE):
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
    log.info("Watching for meetings. Poll %ss, minimum %ss. MIC_SOURCE=%s -> %s", POLL_SECONDS, MIN_MEETING_SECONDS, MIC_SOURCE, CAPTURE_DEVICE)
    recorder: Recorder | None = None
    quiet_polls = 0

    while True:
        try:
            app = meeting_app_in_call()

            if app and recorder is None:
                recorder = Recorder(app)
                if not recorder.start():
                    recorder = None
                quiet_polls = 0

            elif app:
                quiet_polls = 0

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

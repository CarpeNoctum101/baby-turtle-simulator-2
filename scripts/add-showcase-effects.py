"""Add music-timed effects locally with FFmpeg; preserve the existing AAC soundtrack.

Run: python3 scripts/add-showcase-effects.py
Optional: python3 scripts/add-showcase-effects.py input.mp4 output.mp4
No third-party Python packages or external services are used.
"""
from pathlib import Path
import array
import hashlib
import json
import math
import statistics
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "artifacts/showcase"
SOURCE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DIRECTORY / "baby-turtle-edit.mp4"
OUTPUT = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else DIRECTORY / "baby-turtle-edit-effects.mp4"
if SOURCE == OUTPUT:
    raise SystemExit("Choose a different output path to preserve the original cut.")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)


def run(command):
    result = subprocess.run(command, capture_output=True, check=False)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors="replace")[-12000:])
    return result.stdout


def probe(path):
    return json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))


info = probe(SOURCE)
duration = float(info["format"]["duration"])
if abs(duration - 31) > 0.05:
    raise SystemExit("Use the 31-second cut with the first 31 seconds of the song.")
if not any(stream["codec_type"] == "audio" for stream in info["streams"]):
    raise SystemExit("The input needs the supplied song embedded as an audio stream.")

# Detect strong low-frequency attacks in the actual embedded music. Keeping accents
# at least 0.85 seconds apart makes the effects readable instead of continuous flicker.
pcm = run(["ffmpeg", "-v", "error", "-i", str(SOURCE), "-vn", "-ac", "1", "-ar", "8000",
           "-af", "highpass=f=40,lowpass=f=180", "-f", "f32le", "-"])
samples = array.array("f")
samples.frombytes(pcm)
hop, window = 80, 320
energy = [math.sqrt(sum(v * v for v in samples[i:i + window]) / window)
          for i in range(0, len(samples) - window, hop)]
scores = []
for i, value in enumerate(energy):
    baseline = statistics.fmean(energy[max(0, i - 20):i]) if i else value
    scores.append(max(0, value - baseline) * value)
peaks = [i for i in range(2, len(scores) - 2)
         if scores[i] > 0 and scores[i] == max(scores[i - 2:i + 3])]
threshold = statistics.median(scores[i] for i in peaks) if peaks else math.inf
accents = []
for i in sorted(peaks, key=lambda j: scores[j], reverse=True):
    time = i * 0.01
    if scores[i] >= threshold and 0.5 < time < 29.6 and all(abs(time - t) >= 0.85 for t in accents):
        accents.append(round(time, 2))
accents.sort()
moving_windows = [(5.2, 8.4), (10.8, 16.6), (20.1, 23.1), (25.9, 29.6)]
motion = [time for time in accents if any(start <= time < end for start, end in moving_windows)]
split_hits = [time for time in motion if time > 5.5][::2]


def pulse(times, variable, decay=12, length=0.28):
    return "+".join(f"if(between({variable},{t:.2f},{t + length:.2f}),exp(-{decay}*({variable}-{t:.2f})),0)"
                    for t in times) or "0"


def intervals(times, length):
    return "+".join(f"between(t,{t:.2f},{t + length:.2f})" for t in times) or "0"


movement_pulse = pulse(motion, "in_time")
brightness_pulse = pulse(accents, "t", decay=22, length=0.12)
# Crop the existing letterbox first so the black bars stay still during impacts.
# The seven locked-camera shots retain a constant frame; motion accents apply
# only to the orbit, chase, side, shore and launch footage.
filters = [
    "[0:v]crop=1920:900:0:90",
    "eq=contrast=1.065:saturation=1.15:gamma=1.025",
    "colorbalance=rs=-0.018:gs=0.006:bs=0.032:rh=0.028:gh=0.010:bh=-0.015",
    "unsharp=5:5:0.30:3:3:0",
    f"zoompan=z='1.025+0.105*({movement_pulse})':"
    f"x='iw/2-iw/zoom/2+11*sin(in_time*83)*({movement_pulse})':"
    f"y='ih/2-ih/zoom/2+5*cos(in_time*71)*({movement_pulse})':d=1:s=1920x900:fps=30",
    f"tmix=frames=3:weights='0.10 0.20 1':enable='{intervals(motion, 0.15)}'",
    f"rgbashift=rh=7:bh=-7:edge=smear:enable='{intervals(split_hits, 0.09)}'",
    f"eq=brightness='0.037*({brightness_pulse})':eval=frame",
]
graph = ",".join(filters) + "[graded];"
graph += "[graded]split[clean][bloom];[bloom]gblur=sigma=7[soft];"
graph += "[clean][soft]blend=all_mode=screen:all_opacity=0.10,"
graph += "noise=alls=2:allf=t+u,pad=1920:1080:0:90:black,"
graph += "fps=30:start_time=0,tpad=stop_mode=clone:stop_duration=0.10,trim=duration=31,setpts=PTS-STARTPTS,"
graph += "fade=t=out:st=30.4:d=0.6,format=yuv420p[out]"
graph_path = OUTPUT.with_suffix(".filter.txt")
graph_path.write_text(graph + "\n")
print(f"Rendering {len(accents)} music accents, {len(motion)} zoom/shake punches and {len(split_hits)} RGB-split bursts.", flush=True)
run(["ffmpeg", "-hide_banner", "-y", "-filter_complex_threads", "4", "-i", str(SOURCE),
     "-filter_complex_script", str(graph_path), "-map", "[out]", "-map", "0:a:0", "-t", "31",
     "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-r", "30", "-fps_mode", "cfr", "-c:a", "copy",
     "-movflags", "+faststart", "-metadata", "title=Baby Turtle Simulator 2 — effects edit",
     "-metadata", "comment=First 31 seconds of the user-supplied SaWaDiKa X Tokyo Drift. Directed game footage; Ocean Turtle by der_On, CC BY 3.0.",
     str(OUTPUT)])

# Check that remuxing retained the exact encoded audio packets.
def audio_hash(path):
    payload = run(["ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0", "-c:a", "copy", "-f", "adts", "-"])
    return hashlib.sha256(payload).hexdigest()


if audio_hash(SOURCE) != audio_hash(OUTPUT):
    raise RuntimeError("Audio packet verification failed.")
run(["ffmpeg", "-v", "error", "-i", str(OUTPUT), "-f", "null", "-"])
finished = probe(OUTPUT)
if abs(float(finished["format"]["duration"]) - 31) > 0.05:
    raise RuntimeError("The effects export changed the intended duration.")
contact = OUTPUT.with_name(OUTPUT.stem + "-contact.jpg")
run(["ffmpeg", "-v", "error", "-y", "-i", str(OUTPUT), "-vf",
     "fps=1/2,scale=384:216,tile=4x4:padding=4:margin=4:color=black", "-frames:v", "1", "-q:v", "2", str(contact)])
metadata = {
    "source": str(SOURCE), "video": str(OUTPUT), "contactSheet": str(contact),
    "duration": 31, "resolution": "1920x1080", "fps": 30,
    "audio": "Unchanged AAC packets from the original first-31-seconds music edit",
    "audioSha256": audio_hash(OUTPUT), "musicAccentSeconds": accents,
    "zoomShakeSeconds": motion, "rgbSplitSeconds": split_hits,
    "effects": ["music-timed zoom punches", "decaying impact shake", "brief RGB splits",
                "short motion trails", "warm highlights and cool shadows", "soft bloom", "fine grain", "ending fade"],
    "reproduce": "python3 scripts/add-showcase-effects.py",
}
OUTPUT.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
print(json.dumps({"video": str(OUTPUT), "contactSheet": str(contact), "duration": 31,
                  "audioUnchanged": True}, indent=2), flush=True)

"""Prepend the supplied still news photo, floating turtle PNGs and five real voices.

Run: python3 scripts/add-news-intro.py
Uses the already installed FFmpeg and Pillow. All media remains local and outside Git.
"""
from pathlib import Path
import argparse
import array
import json
import math
import shutil
import statistics
import subprocess
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "artifacts/showcase"
ASSETS = DIRECTORY / "news-assets"
ASSETS.mkdir(parents=True, exist_ok=True)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--main", type=Path, default=DIRECTORY / "baby-turtle-edit-effects.mp4")
parser.add_argument("--output", type=Path, default=DIRECTORY / "baby-turtle-edit-news-intro.mp4")
parser.add_argument("--overlap", type=float, default=0.55, help="Seconds of overlap between adjacent trimmed recordings")
args = parser.parse_args()
if not 0.1 <= args.overlap <= 0.8:
    raise SystemExit("Use a short overlap between 0.1 and 0.8 seconds.")


def run(command):
    result = subprocess.run(command, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors="replace")[-12000:])
    return result.stdout


def probe(path):
    return json.loads(run(["ffprobe", "-v", "error", "-show_format", "-show_streams", "-of", "json", str(path)]))


def keep(source, name):
    destination = ASSETS / name
    if source.exists():
        shutil.copy2(source, destination)
    if not destination.exists():
        raise FileNotFoundError(f"Supply the original asset again: {source}")
    return destination


temporary = Path("/var/folders/ql/jd284zdj7c7_5vwxdf7fm3z40000gn/T")
image_ids = ["d7815e54-aae4-4584-8fb3-6c6dbb6e7983", "fa61107a-bef3-454c-9889-d47b151cba4d",
             "b06d13a8-1acc-474c-9f33-dbbdf3735ebd", "ae767265-9fc2-4be2-b080-f05ff5b45f19",
             "4b54a102-9cae-450e-97fe-e62bdab7cfa1"]
images = [keep(temporary / f"codex-clipboard-{identifier}.png", "news.png" if i == 0 else f"turtle-{i}.png")
          for i, identifier in enumerate(image_ids)]
voice_names = [f"Voice 261018_{suffix}.m4a" for suffix in ["093749", "093611", "093332", "093244", "093212"]]
voices = [keep(Path("/Users/leontruong/Downloads") / name, f"voice-{i + 1}.m4a") for i, name in enumerate(voice_names)]


def speech_bounds(path):
    """Conservatively trim only quieter room tone at the edges, with word margins."""
    raw = run(["ffmpeg", "-v", "error", "-i", str(path), "-af", "highpass=f=100,lowpass=f=6000",
               "-ac", "1", "-ar", "16000", "-f", "f32le", "-"])
    pcm = array.array("f")
    pcm.frombytes(raw)
    hop, window = 160, 320
    energy = [math.sqrt(sum(v * v for v in pcm[i:i + window]) / window)
              for i in range(0, len(pcm) - window, hop)]
    ordered = sorted(energy)
    quiet = ordered[int(len(ordered) * 0.1)]
    strong = ordered[int(len(ordered) * 0.9)]
    threshold = max(0.008, min(quiet * 2.5, strong * 0.35), max(energy) * 0.07)
    active = [i for i, energy_value in enumerate(energy) if energy_value > threshold]
    if not active:
        raise RuntimeError(f"No audible content detected in {path.name}")
    start = max(0, active[0] * 0.01 - 0.20)
    end = min(len(pcm) / 16000, active[-1] * 0.01 + 0.30)
    return round(start, 3), round(end, 3)


timeline = []
next_start = 0.15
for index, voice in enumerate(voices):
    trim_start, trim_end = speech_bounds(voice)
    length = trim_end - trim_start
    timeline.append({"voice": voice_names[index], "asset": str(voice), "sourceIn": trim_start,
                     "sourceOut": trim_end, "start": round(next_start, 3), "end": round(next_start + length, 3)})
    next_start += length - args.overlap
intro_duration = math.ceil((timeline[-1]["end"] + 0.35) * 30) / 30
for previous, current in zip(timeline, timeline[1:]):
    if not math.isclose(previous["end"] - current["start"], args.overlap, abs_tol=0.002):
        raise RuntimeError("Voice overlap timing did not match the requested short overlap.")

print(f"Mixing five supplied voices with {args.overlap:.2f}s overlaps; intro {intro_duration:.2f}s.", flush=True)
audio_args = ["ffmpeg", "-hide_banner", "-y"]
for voice in voices:
    audio_args += ["-i", str(voice)]
audio_graph = []
for index, event in enumerate(timeline):
    length = event["sourceOut"] - event["sourceIn"]
    # Small stereo offsets separate the overlapping original voices without changing pitch.
    left, right = [(0.98, 0.88), (0.9, 0.98), (0.97, 0.93), (0.9, 0.99), (0.96, 0.96)][index]
    audio_graph.append(
        f"[{index}:a]atrim=start={event['sourceIn']}:end={event['sourceOut']},asetpts=PTS-STARTPTS,"
        "highpass=f=80,lowpass=f=9000,loudnorm=I=-19:TP=-3:LRA=9,aresample=48000,"
        f"afade=t=in:st=0:d=0.012,afade=t=out:st={max(0, length - 0.035):.3f}:d=0.035,"
        f"pan=stereo|c0={left}*c0|c1={right}*c0,adelay={round(event['start'] * 1000)}:all=1[a{index}]")
audio_graph.append("".join(f"[a{i}]" for i in range(5))
                   + f"amix=inputs=5:normalize=0,alimiter=limit=0.90:level=0:latency=1,"
                   + f"apad=pad_dur={intro_duration},atrim=duration={intro_duration}[voices]")
mixed = DIRECTORY / "news-voices.wav"
audio_args += ["-filter_complex", ";".join(audio_graph), "-map", "[voices]", "-c:a", "pcm_s24le", str(mixed)]
run(audio_args)

# The background is one repeated still frame. Only the provided turtle cutouts
# receive translation and a gentle rotation; the avatar and newsroom never move.
video_args = ["ffmpeg", "-hide_banner", "-y", "-filter_complex_threads", "4"]
for image in images:
    video_args += ["-loop", "1", "-framerate", "30", "-i", str(image)]
video_args += ["-i", str(mixed)]
graph = ["[0:v]scale=1920:1080:flags=lanczos,setsar=1,format=rgba,split=4[plate][redsrc][whitesrc][blacksrc]",
         "[redsrc]crop=402:60:110:810[redbar]", "[whitesrc]crop=730:72:110:868[whitebar]",
         "[blacksrc]crop=1698:48:110:936[blackbar]"]
widths = [360, 300, 300, 330]
for index, path in enumerate(images[1:]):
    with Image.open(path) as image:
        left, top, right, bottom = image.getchannel("A").getbbox()
    phase = index * math.pi / 2
    graph.append(f"[{index + 1}:v]crop={right-left}:{bottom-top}:{left}:{top},"
                 f"scale={widths[index]}:-1:flags=lanczos,format=rgba,"
                 f"rotate=angle='0.055*sin(t*0.65+{phase:.6f})':ow='rotw(0.08)':oh='roth(0.08)':c=none[t{index}]")
    previous = "plate" if index == 0 else f"float{index - 1}"
    graph.append(f"[{previous}][t{index}]overlay=x='960+740*cos(t*0.18+{phase:.6f})-overlay_w/2':"
                 f"y='500+345*sin(t*0.18+{phase:.6f})-overlay_h/2':eval=frame:shortest=1[float{index}]")
# News straps remain in front of the floating stickers, as in a TV broadcast.
graph += ["[float3][redbar]overlay=110:810:shortest=1[strap1]",
          "[strap1][whitebar]overlay=110:868:shortest=1[strap2]",
          "[strap2][blackbar]overlay=110:936:shortest=1[strap3]",
          "[strap3]drawtext=fontfile='/System/Library/Fonts/Supplemental/Arial Bold.ttf':"
          "text='BABY TURTLE SIMULATOR 2':fontsize=43:fontcolor=0x14203a:x=130:y=884,format=yuv420p[intro]"]
graph_path = DIRECTORY / "news-intro.filter.txt"
graph_path.write_text(";".join(graph) + "\n")
intro = DIRECTORY / "news-intro.mp4"
video_args += ["-filter_complex_script", str(graph_path), "-map", "[intro]", "-map", "5:a:0", "-t", str(intro_duration),
               "-r", "30", "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", str(intro)]
run(video_args)
main_duration = float(probe(args.main)["format"]["duration"])
total_duration = intro_duration + main_duration
print(f"Joining the still-photo intro to the existing {main_duration:.0f}s game edit…", flush=True)
join = ("[0:v]fps=30,setpts=PTS-STARTPTS[v0];[1:v]fps=30,setpts=PTS-STARTPTS[v1];"
        "[0:a]aresample=48000,asetpts=PTS-STARTPTS[a0];[1:a]aresample=48000,asetpts=PTS-STARTPTS[a1];"
        "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]")
run(["ffmpeg", "-hide_banner", "-y", "-filter_complex_threads", "4", "-i", str(intro), "-i", str(args.main),
     "-filter_complex", join, "-map", "[v]", "-map", "[a]", "-t", str(total_duration),
     "-c:v", "libx264", "-crf", "17", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", "30",
     "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart",
     "-metadata", "title=Baby Turtle Simulator 2 — news intro and cinematic edit",
     "-metadata", "comment=Five user-supplied voices and image assets. Still Roblox news photo with floating turtle cutouts. Existing 31-second song/game edit follows. Ocean Turtle by der_On, CC BY 3.0.", str(args.output)])
run(["ffmpeg", "-v", "error", "-i", str(args.output), "-f", "null", "-"])
contact = DIRECTORY / "baby-turtle-news-contact.jpg"
run(["ffmpeg", "-v", "error", "-y", "-i", str(args.output), "-vf",
     "fps=1/3,scale=384:216,tile=4x4:padding=4:margin=4:color=black", "-frames:v", "1", "-q:v", "2", str(contact)])
metadata = {"video": str(args.output), "intro": str(intro), "voiceMix": str(mixed), "contactSheet": str(contact),
            "introDuration": intro_duration, "duration": total_duration, "voiceOverlapSeconds": args.overlap,
            "voices": timeline, "background": "The supplied Roblox news image is static throughout the intro",
            "turtles": "All four supplied transparent PNGs float and gently rotate around the news photo",
            "mainEdit": str(args.main), "musicStartInFinal": intro_duration, "songSourceStart": 0,
            "songSourceEnd": 31, "resolution": "1920x1080", "fps": 30,
            "reproduce": "python3 scripts/add-news-intro.py"}
(DIRECTORY / "news-intro.json").write_text(json.dumps(metadata, indent=2) + "\n")
actual = float(probe(args.output)["format"]["duration"])
if abs(actual - total_duration) > 0.05:
    raise RuntimeError("The joined video duration did not match the complete intro plus original edit.")
print(json.dumps({"video": str(args.output), "introSeconds": intro_duration,
                  "totalSeconds": actual, "voiceCount": len(voices), "overlapSeconds": args.overlap}, indent=2), flush=True)

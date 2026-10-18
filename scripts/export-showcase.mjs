/** Free local export: node scripts/export-showcase.mjs recording.webm [song.mp3] [song-start-seconds] */
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [input, music, rawOffset = "0"] = process.argv.slice(2);
if (!input) {
  console.error("Usage: node scripts/export-showcase.mjs recording.webm [song.mp3] [song-start-seconds]");
  process.exit(1);
}
const offset = Number(rawOffset);
if (!Number.isFinite(offset) || offset < 0) throw new Error("Song start must be a nonnegative number of seconds.");
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}
function probe(path) {
  return JSON.parse(run("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-of", "json", resolve(path)]));
}
const source = probe(input);
if (!source.streams.some(stream => stream.codec_type === "video")) throw new Error("The recording has no video stream.");
const withAudio = !!music || source.streams.some(stream => stream.codec_type === "audio");
if (music && Number(probe(music).format.duration) < offset + 32) throw new Error("The supplied song needs at least 32 seconds after the selected start.");
const directory = resolve("artifacts/showcase");
await mkdir(directory, { recursive: true });
const output = resolve(directory, `baby-turtle-edit${withAudio ? "" : "-silent-draft"}.mp4`);
const args = ["-hide_banner", "-y", "-i", resolve(input)];
if (music) args.push("-ss", String(offset), "-i", resolve(music));
args.push("-map", "0:v:0");
if (withAudio) {
  args.push("-map", music ? "1:a:0" : "0:a:0", "-af", "afade=t=in:st=0:d=0.04,afade=t=out:st=31.3:d=0.7", "-c:a", "aac", "-b:a", "256k");
} else args.push("-an");
args.push("-vf", "fps=30,scale=1920:1080:flags=lanczos,setsar=1,eq=contrast=1.035:saturation=1.08", "-t", "32", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
  "-metadata", "title=Baby Turtle Simulator 2 — cinematic edit",
  "-metadata", "comment=Directed in-engine footage. Ocean Turtle by der_On, CC BY 3.0, adapted for the game. Environment and rocket: original project artwork.", output);
run("ffmpeg", args);
const contact = resolve(directory, "contact-sheet.jpg");
run("ffmpeg", ["-hide_banner", "-y", "-i", output, "-vf", "fps=1/2.1,scale=384:216,tile=4x4:padding=4:margin=4:color=black", "-frames:v", "1", "-q:v", "2", contact]);
const inspected = probe(output);
if (Number(inspected.format.duration) < 31.5) throw new Error("The recording is incomplete; record the full 32-second timeline again.");
await writeFile(resolve(directory, "export.json"), JSON.stringify({
  video: output, contactSheet: contact, duration: Number(inspected.format.duration),
  resolution: "1920x1080", fps: 30, audioIncluded: withAudio,
  musicSource: music ? resolve(music) : withAudio ? "Embedded in the user-supplied recording" : null,
  musicOffsetSeconds: music ? offset : null,
  reference: "https://www.youtube.com/watch?v=JrgUCofMUpg",
  requestedSong: "https://open.spotify.com/track/0GFhjEOht8CSXVUZIAjdoe",
  note: withAudio ? "Check the selected track and beat timing before publishing." : "Silent visual draft. The requested song has not been included; supply its audio file to finish.",
}, null, 2) + "\n");
await writeFile(resolve(directory, "CREDITS.txt"), "Baby Turtle Simulator 2 — directed in-engine cinematic edit\nOcean Turtle by der_On, CC BY 3.0. Converted, rigged and animated for this game.\nLicense and adaptation notes: ../../public/credits/ocean-turtle.txt\nEnvironment, item-box artwork and Starship ending: original project artwork.\nReference edit by Swxft: https://www.youtube.com/watch?v=JrgUCofMUpg\nRequested music: SaWaDiKa X Tokyo Drift — NovaX, Sevven.\n" + (withAudio ? "Audio included from the supplied local file/recording.\n" : "No music audio included in this silent draft.\n"));
console.log(JSON.stringify({ output, contact, audioIncluded: withAudio, duration: inspected.format.duration }, null, 2));

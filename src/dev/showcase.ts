import { Engine } from "@babylonjs/core/Engines/engine";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { createBeachScene } from "../scene/createBeachScene";
import { createOceanTurtle } from "../turtle/createOceanTurtle";
import { stepTurtleAnimation } from "../turtle/animateTurtle";
import { createItemBoxes } from "../abilities/createItemBoxes";
import { createSpaceEnding } from "../scene/ending/createSpaceEnding";
import { createEndingState, endingPlan, sampleEnding } from "../game/endingState";
import { createTurtleMotion } from "../movement/stepTurtle";
import { sampleShowcase, showcaseDuration } from "./showcaseTimeline";

const output = document.querySelector<HTMLCanvasElement>("#film")!;
const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const context = output.getContext("2d", { alpha: false })!;
const status = document.querySelector<HTMLElement>("#status")!;
const preview = document.querySelector<HTMLButtonElement>("#preview")!;
const record = document.querySelector<HTMLButtonElement>("#record")!;
const download = document.querySelector<HTMLAnchorElement>("#download")!;
const musicInput = document.querySelector<HTMLInputElement>("#music")!;
const offsetInput = document.querySelector<HTMLInputElement>("#offset")!;
const timeInput = document.querySelector<HTMLInputElement>("#time")!;

const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
engine.setSize(1920, 1080);
const scene = createBeachScene(engine, true);
const camera = new FreeCamera("showcaseCamera", new Vector3(3, 1.2, -20), scene);
camera.minZ = 0.05;
camera.maxZ = 5000;
camera.fov = 0.72;
scene.activeCamera = camera;
const fill = new HemisphericLight("filmBounce", new Vector3(0.3, 0.7, -1), scene);
fill.intensity = 0.45;
fill.diffuse = new Color3(0.86, 0.92, 1);
fill.groundColor = new Color3(0.4, 0.32, 0.22);
const turtle = createOceanTurtle(scene);
const companions = [
  createOceanTurtle(scene, { id: "filmRacerA", tint: new Color3(0.85, 1, 0.9) }),
  createOceanTurtle(scene, { id: "filmRacerB", tint: new Color3(1, 0.89, 0.8) }),
];
const boxes = createItemBoxes(scene);
// Declutter close-ups without changing the playable course.
for (const mesh of scene.meshes) {
  if (/^(routeDash|routePost|startLine|startPad)/.test(mesh.name)) mesh.setEnabled(false);
}
const ending = createSpaceEnding(scene, turtle);
const endingState = createEndingState({ ...createTurtleMotion(), z: 66 });
const launchStart = endingPlan.riseSeconds
  + (endingPlan.hatch.z - 66) / endingPlan.walkingSpeed
  + endingPlan.boardingSeconds + endingPlan.countdownSeconds;
let inEnding = false;
let playing = false;
let started = 0;
let lastShot = -1;
let recorder: MediaRecorder | null = null;
let recordingStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let audioBuffer: AudioBuffer | null = null;
let song: AudioBufferSourceNode | null = null;
let recordingUrl = "";

function pose(x: number, z: number, heading = 0) {
  turtle.root.position.set(x, 0, z);
  turtle.root.rotation.y = heading;
}

function view(eye: number[], target: number[], fov = 0.72, overhead = false) {
  scene.activeCamera = camera;
  camera.upVector.set(0, overhead ? 0 : 1, overhead ? 1 : 0);
  camera.position.set(eye[0], eye[1], eye[2]);
  camera.setTarget(new Vector3(target[0], target[1], target[2]));
  camera.fov = fov;
}

function render(seconds: number) {
  const shot = sampleShowcase(seconds);
  const u = shot.progress;
  const cinematic = shot.index >= 10;
  if (cinematic && !inEnding) { ending.begin(); inEnding = true; }
  if (!cinematic && inEnding) { ending.reset(); inEnding = false; }
  for (const other of companions) {
    other.root.setEnabled(shot.id === "overhead");
    // Ending reset restores individual mesh flags as well as their parent state.
    if (shot.id === "overhead") for (const mesh of other.root.getChildMeshes()) mesh.setEnabled(true);
  }
  const running = ["pass", "chase", "side", "overhead", "shore"].includes(shot.id);
  const pace = running ? 4.2 : 0;
  const animation = { phase: seconds * (1.4 + pace * 1.7) };
  stepTurtleAnimation(animation, turtle.visual, turtle.flippers, pace, 0);
  for (const [index, box] of boxes.entries()) {
    box.rotation.y = seconds * 0.9 + index * 0.65;
    box.position.y = 0.95 + Math.sin(seconds * 2.4 + index) * 0.12;
  }
  pose(0, -24);
  switch (shot.id) {
    case "hero": view([3.1, 1.05, -20.8], [0, 0.38, -24], 0.64); break;
    case "eyes": view([0.54, 0.55, -22.35], [0, 0.32, -23.55], 0.60); break;
    case "shell": view([-1.8, 1.5, -24.7], [0, 0.30, -24], 0.58); break;
    case "orbit": {
      const angle = -0.8 + ease(u) * 3.6;
      view([Math.sin(angle) * 4, 1.3 + Math.sin(u * Math.PI) * 0.3, -24 + Math.cos(angle) * 4], [0, 0.35, -24]);
      break;
    }
    case "pass": pose(-6, -17 + u * 11); view([0, 1.15, -12], [-6, 0.35, -12], 0.62); break;
    case "chase": {
      const z = 5 + (u * 0.5 + u * u * 0.5) * 17;
      pose(-6, z);
      view([-3.8, 1.15, z - 4.7], [-6, 0.4, z + 0.4], 0.68 + 0.12 * u);
      break;
    }
    case "side": {
      const z = 20 + u * 11;
      pose(-5, z); view([0, 0.9, z + 0.5], [-5, 0.3, z], 0.58);
      break;
    }
    case "overhead": {
      pose(-5, 20 + u * 8);
      companions.forEach((other, i) => {
        other.root.position.set(-1 + i * 5, 0, 20 + u * (7.5 + i));
        stepTurtleAnimation({ phase: seconds * 8 + i }, other.visual, other.flippers, 4, 0);
      });
      view([0, 12, 24], [0, 0, 24], 0.9, true);
      break;
    }
    case "item": pose(-8, -16.2); view([-5.1, 1.5, -11.8], [-8, 0.9, -14], 0.64); break;
    case "shore": {
      const z = 40 + u * 13;
      pose(-4, z); view([-0.4, 0.85, z + 3.2], [-4, 0.3, z], 0.72);
      break;
    }
    case "reveal": {
      const frame = sampleEnding({ ...endingState, elapsed: 1.8 + u * 3 });
      ending.update(frame, 1 / 30);
      view([23, 9, 55], [0, 4.5, 82], 0.78);
      break;
    }
    case "launch": {
      scene.activeCamera = scene.getCameraByName("endingCamera");
      const frame = sampleEnding({ ...endingState, elapsed: launchStart + u * 9.8 });
      ending.update(frame, 1 / 30);
      break;
    }
    case "orbit-end": {
      scene.activeCamera = scene.getCameraByName("endingCamera");
      const frame = sampleEnding({ ...endingState, elapsed: launchStart + 10 + u * 3.1 });
      ending.update(frame, 1 / 30);
      break;
    }
  }
  scene.render();
  context.fillStyle = "black";
  context.fillRect(0, 0, 1920, 1080);
  context.drawImage(canvas, 0, 0, 1920, 1080);
  // A subtle vignette and clean letterbox, without capturing any browser/UI pixels.
  const vignette = context.createRadialGradient(960, 500, 300, 960, 500, 1150);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,.28)");
  context.fillStyle = vignette; context.fillRect(0, 0, 1920, 1080);
  context.fillStyle = "black";
  context.fillRect(0, 0, 1920, 90); context.fillRect(0, 990, 1920, 90);
  if (shot.index === 0 && shot.local > 0.35) title("BABY TURTLE SIMULATOR 2", 150, 910, 36, Math.min(1, (shot.local - 0.35) * 3));
  if (shot.id === "orbit-end") title("BABY TURTLE SIMULATOR 2", 960, 920, 56, Math.min(1, shot.local * 2), true);
  if ([3, 5, 9, 11].includes(shot.index) && shot.local < 0.075) {
    context.fillStyle = `rgba(237,250,243,${0.20 * (1 - shot.local / 0.075)})`;
    context.fillRect(0, 90, 1920, 900);
  }
  const fade = seconds < 0.3 ? 1 - seconds / 0.3 : Math.max(0, (seconds - showcaseDuration + 0.8) / 0.8);
  if (fade > 0) { context.fillStyle = `rgba(0,0,0,${fade})`; context.fillRect(0, 0, 1920, 1080); }
  if (shot.index !== lastShot) {
    status.textContent = `${playing ? "Playing" : "Preview"} · ${shot.label} · ${audioBuffer ? "song audio loaded" : "silent visual draft"}`;
    lastShot = shot.index;
  }
}

function title(text: string, x: number, y: number, size: number, alpha: number, center = false) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = "#f5f5ed";
  context.font = `600 ${size}px Arial, sans-serif`;
  context.textAlign = center ? "center" : "left";
  context.shadowColor = "rgba(0,0,0,.6)"; context.shadowBlur = 18;
  context.fillText(text, x, y + (1 - alpha) * 16);
  context.restore();
}
function ease(t: number) { return t * t * (3 - 2 * t); }

function stop() {
  playing = false;
  song?.stop(); song = null;
  if (recorder?.state === "recording") recorder.stop();
  preview.disabled = false; record.disabled = false;
  musicInput.disabled = false; offsetInput.disabled = false;
  status.textContent = recorder ? "Finishing the recording…" : "Preview finished. Ready to record.";
}

async function start(capture: boolean) {
  try {
    if (playing) return;
    if (inEnding) { ending.reset(); inEnding = false; }
    lastShot = -1;
    download.hidden = true;
    const stream = capture ? output.captureStream(30) : null;
    const offset = Math.max(0, Number(offsetInput.value) || 0);
    if (audioBuffer) {
      if (offset + showcaseDuration > audioBuffer.duration) throw new Error("Choose a song start with at least 32 seconds remaining.");
      await audioContext!.resume();
      song = audioContext!.createBufferSource(); song.buffer = audioBuffer;
      song.connect(audioContext!.destination);
      if (stream) {
        const destination = audioContext!.createMediaStreamDestination();
        song.connect(destination);
        destination.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      }
    }
    if (stream) {
      recordingStream = stream;
      const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("This browser cannot record the canvas. Try Chrome or Firefox.");
      const parts: Blob[] = [];
      const withMusic = audioBuffer !== null;
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
      recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      recorder.onerror = () => { status.textContent = "Recording failed; reload this page to retry."; };
      recorder.onstop = () => {
        const blob = new Blob(parts, { type: recorder!.mimeType });
        if (recordingUrl) URL.revokeObjectURL(recordingUrl);
        recordingUrl = URL.createObjectURL(blob);
        download.href = recordingUrl;
        download.download = `baby-turtle-edit-${withMusic ? "music" : "silent"}.${mimeType.includes("mp4") ? "mp4" : "webm"}`;
        download.hidden = false;
        status.textContent = `Recording ready · ${withMusic ? "with supplied song audio" : "silent draft — song file still needed"} · ${(blob.size / 1048576).toFixed(1)} MB`;
        recordingStream?.getTracks().forEach(track => track.stop());
        recordingStream = null; recorder = null;
      };
      recorder.start(1000);
    }
    song?.start(0, offset, showcaseDuration);
    preview.disabled = true; record.disabled = true;
    musicInput.disabled = true; offsetInput.disabled = true;
    playing = true; started = performance.now();
  } catch (error) {
    song?.disconnect(); song = null;
    recordingStream?.getTracks().forEach(track => track.stop()); recordingStream = null;
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

musicInput.addEventListener("change", async () => {
  const file = musicInput.files?.[0];
  audioBuffer = null;
  if (!file) { audioBuffer = null; record.textContent = "Record silent draft"; return; }
  try {
    audioContext ??= new AudioContext();
    audioBuffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    record.textContent = "Record with music";
    status.textContent = `${file.name} loaded locally. Adjust the song start, then preview or record.`;
  } catch { status.textContent = "Unable to decode this file. Choose an MP3 or WAV."; }
});
preview.addEventListener("click", () => { void start(false); });
record.addEventListener("click", () => { void start(true); });
timeInput.addEventListener("input", () => { if (!playing) render(Number(timeInput.value)); });
document.addEventListener("visibilitychange", () => {
  if (document.hidden && playing) status.textContent = "Keep this filming tab visible while recording for smooth frame capture.";
});
await scene.whenReadyAsync();
render(30);
await scene.whenReadyAsync();
render(0.7);
await scene.whenReadyAsync();
preview.disabled = false; record.disabled = false;
status.textContent = "Ready · silent visual draft. Add the song's audio file for the music version.";
engine.runRenderLoop(() => {
  if (!playing) return;
  const elapsed = (performance.now() - started) / 1000;
  render(Math.min(elapsed, showcaseDuration - 0.000001));
  if (elapsed >= showcaseDuration) stop();
});

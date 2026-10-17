import type { TurtleMotion } from "../movement/stepTurtle";

export type EndingPhase = "rising" | "walking" | "boarding" | "countdown" | "launch" | "space";
export interface Position3 { x: number; y: number; z: number }
export interface EndingState {
  elapsed: number;
  start: Position3;
  startHeading: number;
}
export interface EndingFrame {
  phase: EndingPhase;
  phaseTime: number;
  platformOffset: number;
  riseProgress: number;
  walkProgress: number;
  turtle: Position3;
  heading: number;
  speed: number;
  boarded: boolean;
  countdown: number;
  altitude: number;
  spaceBlend: number;
}

// Shared by the route and the 3D dock, so the turtle really follows the boarding ramp.
export const endingPlan = {
  ship: { x: 0, y: 0.24, z: 54 },
  entry: { x: 0, y: 0.2, z: 42 },
  rampFoot: { x: 0, y: 0.2, z: 45 },
  hatch: { x: 0, y: 1.8, z: 52.55 },
  cabin: { x: 0, y: 1.8, z: 54 },
  riseSeconds: 4.8,
  submergedDepth: 18,
  walkingSpeed: 2.6,
  boardingSeconds: 2,
  countdownSeconds: 3,
  launchSeconds: 10,
  orbitAltitude: 360,
} as const;

export function createEndingState(motion: TurtleMotion): EndingState {
  return {
    elapsed: 0,
    start: { x: motion.x, y: 0.2 * clamp01((motion.z - 36) / 6), z: motion.z },
    startHeading: motion.heading,
  };
}

/** The ending uses time and a fixed route, never keyboard/gamepad input. */
export function stepEnding(state: EndingState, dt: number): EndingState {
  const safeDt = Number.isFinite(dt) ? Math.min(0.1, Math.max(0, dt)) : 0;
  return { ...state, elapsed: state.elapsed + safeDt };
}

export function sampleEnding(state: EndingState): EndingFrame {
  const path = [state.start, endingPlan.entry, endingPlan.rampFoot, endingPlan.hatch];
  const totalDistance = path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);
  const walkDuration = totalDistance / endingPlan.walkingSpeed;
  let phaseTime = state.elapsed;
  const base = { platformOffset: 0, riseProgress: 1,
    walkProgress: clamp01((state.elapsed - endingPlan.riseSeconds) / walkDuration), countdown: 0, altitude: 0, spaceBlend: 0 };
  if (phaseTime < endingPlan.riseSeconds) {
    const riseProgress = smooth01(phaseTime / endingPlan.riseSeconds);
    return { ...base, phase: "rising", phaseTime, riseProgress,
      platformOffset: -endingPlan.submergedDepth * (1 - riseProgress),
      turtle: { ...state.start }, heading: state.startHeading, speed: 0, boarded: false };
  }
  phaseTime -= endingPlan.riseSeconds;
  const walked = Math.min(totalDistance, phaseTime * endingPlan.walkingSpeed);
  if (phaseTime < walkDuration) {
    const turtle = alongPath(path, walked);
    const ahead = alongPath(path, Math.min(totalDistance, walked + 0.5));
    const targetHeading = Math.atan2(ahead.x - turtle.x, ahead.z - turtle.z);
    const turn = Math.atan2(Math.sin(targetHeading - state.startHeading), Math.cos(targetHeading - state.startHeading));
    return { ...base, phase: "walking", phaseTime, turtle,
      heading: state.startHeading + turn * smooth01(phaseTime / 0.65),
      speed: endingPlan.walkingSpeed, boarded: false };
  }
  phaseTime -= walkDuration;
  if (phaseTime < endingPlan.boardingSeconds) {
    return { ...base, phase: "boarding", phaseTime,
      turtle: lerpPosition(endingPlan.hatch, endingPlan.cabin, phaseTime / endingPlan.boardingSeconds),
      heading: 0, speed: 0.7, boarded: false };
  }
  phaseTime -= endingPlan.boardingSeconds;
  if (phaseTime < endingPlan.countdownSeconds) {
    return { ...base, phase: "countdown", phaseTime, turtle: { ...endingPlan.cabin },
      heading: 0, speed: 0, boarded: true,
      countdown: Math.ceil(endingPlan.countdownSeconds - phaseTime) };
  }
  phaseTime -= endingPlan.countdownSeconds;
  if (phaseTime < endingPlan.launchSeconds) {
    const p = phaseTime / endingPlan.launchSeconds;
    return { ...base, phase: "launch", phaseTime, turtle: { ...endingPlan.cabin },
      heading: 0, speed: 0, boarded: true,
      altitude: endingPlan.orbitAltitude * p * p, spaceBlend: smooth01((p - 0.28) / 0.57) };
  }
  phaseTime -= endingPlan.launchSeconds;
  return { ...base, phase: "space", phaseTime, turtle: { ...endingPlan.cabin },
    heading: 0, speed: 0, boarded: true, altitude: endingPlan.orbitAltitude, spaceBlend: 1 };
}

function alongPath(path: readonly Position3[], length: number): Position3 {
  for (let i = 1; i < path.length; i++) {
    const segment = distance(path[i - 1], path[i]);
    if (length <= segment) return lerpPosition(path[i - 1], path[i], segment === 0 ? 1 : length / segment);
    length -= segment;
  }
  return { ...path[path.length - 1] };
}
function distance(a: Position3, b: Position3): number { return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z); }
function lerpPosition(a: Position3, b: Position3, t: number): Position3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}
function clamp01(t: number): number { return Math.max(0, Math.min(1, t)); }
function smooth01(t: number): number { const p = clamp01(t); return p * p * (3 - 2 * p); }

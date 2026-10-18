import { clampDt } from "./clock";
import { overlapsObstacle } from "../movement/obstacles";

/**
 * A bubble fired along the camera's ground direction.
 * It travels flat across the sand and pops on the first turtle, seagull, or solid obstacle it meets.
 * A hit holds that racer in place. The shooter is never a target.
 */
export const bubbleRules = {
  speed: 16,
  radius: 0.42,
  /** How far in front of the shell the bubble appears, so it does not spawn inside the shooter. */
  spawnForward: 0.9,
  maxAge: 1.15,
  trapSeconds: 2.4,
  cooldown: 0.55,
  hitRadius: 0.9,
  /** Circling gulls cruise under this, so a flat shot can still catch them. */
  maxTargetHeight: 6.5,
} as const;

export interface BubbleShot {
  x: number;
  z: number;
  dirX: number;
  dirZ: number;
  age: number;
}

export interface BubbleTarget {
  id: string;
  x: number;
  z: number;
  y: number;
}

export function launchBubble(x: number, z: number, dirX: number, dirZ: number): BubbleShot | null {
  const length = Math.hypot(dirX, dirZ);
  if (length < 0.001) {
    return null;
  }
  const nx = dirX / length;
  const nz = dirZ / length;
  return {
    x: x + nx * bubbleRules.spawnForward,
    z: z + nz * bubbleRules.spawnForward,
    dirX: nx,
    dirZ: nz,
    age: 0,
  };
}

/** Moves each bubble and drops any that have flown long enough. */
export function stepBubbleShots(shots: readonly BubbleShot[], dt: number): BubbleShot[] {
  const step = clampDt(dt);
  const next: BubbleShot[] = [];
  for (const shot of shots) {
    const age = shot.age + step;
    if (age >= bubbleRules.maxAge) {
      continue;
    }
    next.push({
      x: shot.x + shot.dirX * bubbleRules.speed * step,
      z: shot.z + shot.dirZ * bubbleRules.speed * step,
      dirX: shot.dirX,
      dirZ: shot.dirZ,
      age,
    });
  }
  return next;
}

/**
 * Each bubble stops on the nearest target in range, or on a rock or log.
 * A target can only be caught once per frame.
 */
export function consumeBubbleHits(
  shots: readonly BubbleShot[],
  targets: readonly BubbleTarget[],
): { shots: BubbleShot[]; hits: string[] } {
  const hits: string[] = [];
  const left: BubbleShot[] = [];
  for (const shot of shots) {
    if (overlapsObstacle(shot.x, shot.z, bubbleRules.radius)) {
      continue;
    }
    let closest: BubbleTarget | null = null;
    let closestDist = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (target.y > bubbleRules.maxTargetHeight || hits.includes(target.id)) {
        continue;
      }
      const dist = Math.hypot(shot.x - target.x, shot.z - target.z);
      if (dist <= bubbleRules.hitRadius && dist < closestDist) {
        closest = target;
        closestDist = dist;
      }
    }
    if (closest) {
      hits.push(closest.id);
      continue;
    }
    left.push(shot);
  }
  return { shots: left, hits };
}

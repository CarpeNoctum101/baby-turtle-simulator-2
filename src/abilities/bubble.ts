import { clampDt } from "./clock";
import { obstacleTop } from "../movement/obstacles";

/**
 * A bubble fired along the camera's look direction, through the center of the screen.
 * It travels in three dimensions and pops on the first turtle, seagull, rock, log, or the sand.
 * A hit holds that racer in place. The shooter is never a target.
 */
export const bubbleRules = {
  speed: 16,
  radius: 0.42,
  /** How far in front of the shell the bubble appears, so it does not spawn inside the shooter. */
  spawnForward: 0.9,
  /** Shell height. The shot starts here, then steps along the aim. */
  spawnHeight: 0.55,
  maxAge: 1.15,
  trapSeconds: 2.4,
  cooldown: 0.55,
  hitRadius: 0.9,
  /** At or below this height the bubble has met the sand. */
  groundY: 0.05,
} as const;

export interface BubbleShot {
  x: number;
  y: number;
  z: number;
  dirX: number;
  dirY: number;
  dirZ: number;
  age: number;
}

export interface BubbleTarget {
  id: string;
  x: number;
  z: number;
  y: number;
}

export function launchBubble(
  x: number,
  y: number,
  z: number,
  dirX: number,
  dirY: number,
  dirZ: number,
): BubbleShot | null {
  const length = Math.hypot(dirX, dirY, dirZ);
  if (length < 0.001) {
    return null;
  }
  const nx = dirX / length;
  const ny = dirY / length;
  const nz = dirZ / length;
  return {
    x: x + nx * bubbleRules.spawnForward,
    y: Math.max(bubbleRules.groundY, y + ny * bubbleRules.spawnForward),
    z: z + nz * bubbleRules.spawnForward,
    dirX: nx,
    dirY: ny,
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
      y: shot.y + shot.dirY * bubbleRules.speed * step,
      z: shot.z + shot.dirZ * bubbleRules.speed * step,
      dirX: shot.dirX,
      dirY: shot.dirY,
      dirZ: shot.dirZ,
      age,
    });
  }
  return next;
}

/**
 * Each bubble stops on the nearest target in range, or on the sand, a rock, or a log.
 * A target can only be caught once per frame. A bubble above an obstacle flies over it.
 */
export function consumeBubbleHits(
  shots: readonly BubbleShot[],
  targets: readonly BubbleTarget[],
): { shots: BubbleShot[]; hits: string[] } {
  const hits: string[] = [];
  const left: BubbleShot[] = [];
  for (const shot of shots) {
    if (shot.y <= bubbleRules.groundY || shot.y <= obstacleTop(shot.x, shot.z, bubbleRules.radius)) {
      continue;
    }
    let closest: BubbleTarget | null = null;
    let closestDist = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (hits.includes(target.id)) {
        continue;
      }
      const dist = Math.hypot(shot.x - target.x, shot.y - target.y, shot.z - target.z);
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

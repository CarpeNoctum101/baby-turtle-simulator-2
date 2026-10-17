import type { CrawlModifiers } from "../movement/stepTurtle";
import { oceanPlan, stepTurtle, type TurtleMotion } from "../movement/stepTurtle";

/** The practice hatchling aims for this spot behind the player, inside the sand-spray box. */
export const rivalFollow = { back: 2, side: -0.6 };

export function rivalAnchor(player: TurtleMotion): { x: number; z: number } {
  const forwardX = Math.sin(player.heading);
  const forwardZ = Math.cos(player.heading);
  const rightX = Math.cos(player.heading);
  const rightZ = -Math.sin(player.heading);
  return {
    x: player.x - forwardX * rivalFollow.back + rightX * rivalFollow.side,
    z: player.z - forwardZ * rivalFollow.back + rightZ * rivalFollow.side,
  };
}

/** Starts the chaser already behind the player so the first frame is not a dash across the nest. */
export function createRivalMotion(player: TurtleMotion): TurtleMotion {
  const anchor = rivalAnchor(player);
  return {
    x: anchor.x,
    z: anchor.z,
    heading: player.heading,
    speed: 0,
    steer: 0,
  };
}

/**
 * A local hatchling that crawls toward the spot behind the player.
 * This is a single-player rival for Sand Spray and bumps, not a networked racer.
 */
export function stepRival(
  rival: TurtleMotion,
  player: TurtleMotion,
  dt: number,
  modifiers: CrawlModifiers = {},
): TurtleMotion {
  const anchor = rivalAnchor(player);
  const dx = anchor.x - rival.x;
  const dz = anchor.z - rival.z;
  if (Math.hypot(dx, dz) < 0.3) {
    return stepTurtle(rival, { throttle: 0, steer: 0, brake: true }, dt, oceanPlan, modifiers);
  }
  const heading = Math.atan2(dx, dz);
  return stepTurtle(
    rival,
    { throttle: 1, steer: 0, brake: false },
    dt,
    { forwardX: Math.sin(heading), forwardZ: Math.cos(heading) },
    modifiers,
  );
}

export function raceStanding(playerZ: number, rivalZ: number): { place: number; field: number } {
  return { place: playerZ + 0.05 >= rivalZ ? 1 : 2, field: 2 };
}

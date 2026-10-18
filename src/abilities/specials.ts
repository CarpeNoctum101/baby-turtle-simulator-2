import { clampDt } from "./clock";

/** The one extra move a turtle type has, on the same button (E, or Y on a pad). */
export type SpecialId = "snap" | "slam" | "spin";

export const specialNames: Record<SpecialId, string> = {
  snap: "Snap",
  slam: "Body slam",
  spin: "Spin dash",
};

/**
 * Leatherback's body slam. The turtle surges forward in a straight line, locked in,
 * and stuns anything it plows into. The cooldown is much longer than the snap's.
 */
export const slamRules = {
  cooldown: 18,
  duration: 0.45,
  speed: 13,
  /** Anything this close to the turtle's shell while it surges gets hit. */
  hitRadius: 1.7,
  /** A gull higher than this is above the slam. */
  gullReachHeight: 2.4,
  stunSeconds: 2.2,
  damage: 10,
} as const;

export interface SlamState {
  cooldownRemaining: number;
  activeRemaining: number;
  /** Unit direction of the surge, fixed when the slam starts. */
  dirX: number;
  dirZ: number;
  /** Ids already hit this slam, so one target is not stunned on every frame. */
  hitIds: readonly string[];
}

export function createSlam(): SlamState {
  return { cooldownRemaining: 0, activeRemaining: 0, dirX: 0, dirZ: 1, hitIds: [] };
}

export function slamReady(state: SlamState): boolean {
  return state.cooldownRemaining <= 0 && state.activeRemaining <= 0;
}

export function slamActive(state: SlamState): boolean {
  return state.activeRemaining > 0;
}

/** Heading 0 faces +Z, like the movement code. */
export function startSlam(state: SlamState, heading: number): SlamState {
  if (!slamReady(state)) {
    return state;
  }
  return {
    cooldownRemaining: slamRules.cooldown,
    activeRemaining: slamRules.duration,
    dirX: Math.sin(heading),
    dirZ: Math.cos(heading),
    hitIds: [],
  };
}

export function stepSlam(state: SlamState, dt: number): SlamState {
  const step = clampDt(dt);
  return {
    ...state,
    cooldownRemaining: Math.max(0, state.cooldownRemaining - step),
    activeRemaining: Math.max(0, state.activeRemaining - step),
  };
}

/** How far the surge carries the turtle this frame. */
export function slamShift(state: SlamState, dt: number): { x: number; z: number } {
  if (!slamActive(state)) {
    return { x: 0, z: 0 };
  }
  const step = Math.min(clampDt(dt), state.activeRemaining);
  return { x: state.dirX * slamRules.speed * step, z: state.dirZ * slamRules.speed * step };
}

/**
 * Kempy's spin dash: a burst of speed in which nothing can hurt it.
 * Its cooldown matches the snap's (a test keeps the two equal). The invincibility lives in `RacerEffects.spinRemaining`.
 */
export const spinRules = {
  cooldown: 8,
  duration: 1.5,
  maxSpeedMultiplier: 1.7,
  accelerationMultiplier: 2.4,
  /** Radians per second the shell turns while spinning. */
  turnsPerSecond: 3.5,
} as const;

export interface SpinState {
  cooldownRemaining: number;
}

export function createSpin(): SpinState {
  return { cooldownRemaining: 0 };
}

export function stepSpin(state: SpinState, dt: number): SpinState {
  return { cooldownRemaining: Math.max(0, state.cooldownRemaining - clampDt(dt)) };
}

export function spinReady(state: SpinState): boolean {
  return state.cooldownRemaining <= 0;
}

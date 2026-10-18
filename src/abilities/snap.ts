import { absorbHit, type RacerEffects } from "./abilityState";
import { collisionSpeedScale } from "./catalog";
import { clampDt } from "./clock";
import { damageRules } from "./health";
import type { TurtleMotion } from "../movement/stepTurtle";

export const snapRules = {
  cooldown: 4,
  /** The neck swivels, so the snap reaches a rival in any direction within this distance. */
  reach: 2.6,
  /** A gull higher than this is out of the neck's reach. */
  gullReachHeight: 2.4,
  lungeDuration: 0.3,
  /** How far the head shoots out at the peak of the lunge, in metres. */
  lungeDistance: 0.7,
} as const;

export interface SnapState {
  cooldownRemaining: number;
  lungeRemaining: number;
}

export function createSnap(): SnapState {
  return { cooldownRemaining: 0, lungeRemaining: 0 };
}

export function stepSnap(state: SnapState, dt: number): SnapState {
  const step = clampDt(dt);
  return {
    cooldownRemaining: Math.max(0, state.cooldownRemaining - step),
    lungeRemaining: Math.max(0, state.lungeRemaining - step),
  };
}

export function snapReady(state: SnapState): boolean {
  return state.cooldownRemaining <= 0;
}

/** Head distance added by the lunge: zero at rest, a peak halfway through. */
export function lungeExtension(state: SnapState): number {
  if (state.lungeRemaining <= 0) {
    return 0;
  }
  const progress = 1 - state.lungeRemaining / snapRules.lungeDuration;
  return Math.sin(Math.PI * Math.min(1, Math.max(0, progress))) * snapRules.lungeDistance;
}

export interface SnapResult {
  state: SnapState;
  started: boolean;
  /** True when the bite landed and hurt. A blocked bite is not a hit. */
  hit: boolean;
  blocked: boolean;
  damage: number;
  target: TurtleMotion;
  targetEffects: RacerEffects;
}

/**
 * The cooldown starts whenever a snap goes out, whether or not it lands.
 * A landed bite costs the target health and knocks its speed down like a collision.
 * Shell Guard stops it, because a bite is an ability hit.
 */
export function trySnap(
  state: SnapState,
  attacker: { x: number; z: number },
  target: TurtleMotion,
  targetEffects: RacerEffects,
): SnapResult {
  if (!snapReady(state)) {
    return { state, started: false, hit: false, blocked: false, damage: 0, target, targetEffects };
  }
  const next: SnapState = { cooldownRemaining: snapRules.cooldown, lungeRemaining: snapRules.lungeDuration };
  const inReach = Math.hypot(target.x - attacker.x, target.z - attacker.z) <= snapRules.reach;
  if (!inReach) {
    return { state: next, started: true, hit: false, blocked: false, damage: 0, target, targetEffects };
  }
  const absorbed = absorbHit(targetEffects, "ability");
  if (absorbed.blocked) {
    return { state: next, started: true, hit: false, blocked: true, damage: 0, target, targetEffects: absorbed.effects };
  }
  return {
    state: next,
    started: true,
    hit: true,
    blocked: false,
    damage: damageRules.snap,
    target: { ...target, speed: target.speed * collisionSpeedScale },
    targetEffects,
  };
}

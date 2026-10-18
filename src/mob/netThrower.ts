import { clampDt } from "../abilities/clock";
import { course } from "../movement/course";
import type { TurtleMotion } from "../movement/stepTurtle";

export const netRules = {
  windupSeconds: 0.85,
  flightSeconds: 1.1,
  groundSeconds: 1.8,
  cooldownSeconds: 5.5,
  slowSeconds: 2.6,
  slowMultiplier: 0.55,
  graceSeconds: 1.2,
  catchRadius: 1.65,
  range: 20,
  alongTrackRange: 9,
} as const;

export interface NetThrowerSpawn { id: string; x: number; z: number; side: 1 | -1 }
export const netThrowerSpawns: readonly NetThrowerSpawn[] = [
  { id: "netter-left", x: -course.halfWidth - 1.8, z: -5, side: -1 },
  { id: "netter-right", x: course.halfWidth + 1.8, z: 18, side: 1 },
];
export type NetRacer = "player" | "rival";
export type NetPhase = "idle" | "aim" | "flight" | "ground" | "rest";
export interface NetThrower extends NetThrowerSpawn {
  phase: NetPhase;
  time: number;
  target: { x: number; z: number };
  hit: Record<NetRacer, boolean>;
}
export interface NetHazards {
  throwers: NetThrower[];
  slow: Record<NetRacer, number>;
  grace: Record<NetRacer, number>;
}
export interface NetTick {
  dt: number;
  racing: boolean;
  player: TurtleMotion;
  rival: TurtleMotion;
  /** No targeting or catching a turtle that is being carried or doing a body slam. */
  playerGrounded: boolean;
}

export function createNetHazards(spawns: readonly NetThrowerSpawn[] = []): NetHazards {
  return { throwers: spawns.map(spawn => ({ ...spawn, phase: "idle", time: 0,
    target: { x: 0, z: spawn.z }, hit: { player: false, rival: false } })),
    slow: { player: 0, rival: 0 }, grace: { player: 0, rival: 0 } };
}

/** Deterministic throws lock their aim at release, giving the racer time to dodge. */
export function stepNetHazards(state: NetHazards, tick: NetTick): { state: NetHazards; hits: NetRacer[] } {
  if (!tick.racing) return { state, hits: [] };
  const dt = clampDt(tick.dt);
  const slow = { player: Math.max(0, state.slow.player - dt), rival: Math.max(0, state.slow.rival - dt) };
  const grace = { player: Math.max(0, state.grace.player - dt), rival: Math.max(0, state.grace.rival - dt) };
  const hits: NetRacer[] = [];
  const throwers = state.throwers.map(thrower => {
    let next: NetThrower = { ...thrower, time: thrower.time + dt, hit: { ...thrower.hit } };
    if (next.phase === "idle") {
      if (tick.playerGrounded && inRange(next, tick.player)) {
        next = { ...next, phase: "aim", time: 0, target: lead(tick.player) };
      }
    } else if (next.phase === "aim") {
      if (!tick.playerGrounded || !inRange(next, tick.player)) {
        next = { ...next, phase: "rest", time: 0 };
      } else {
        next.target = lead(tick.player);
        if (next.time >= netRules.windupSeconds) next = { ...next, phase: "flight", time: 0,
          hit: { player: false, rival: false } };
      }
    } else if (next.phase === "flight") {
      if (next.time >= netRules.flightSeconds) next = { ...next, phase: "ground", time: 0 };
    } else if (next.phase === "ground" && next.time >= netRules.groundSeconds) {
      next = { ...next, phase: "rest", time: 0 };
    } else if (next.phase === "rest" && next.time >= netRules.cooldownSeconds) {
      next = { ...next, phase: "idle", time: 0 };
    }
    if (next.phase === "ground") {
      for (const racer of ["player", "rival"] as const) {
        if ((racer === "player" && !tick.playerGrounded) || next.hit[racer] || grace[racer] > 0 || slow[racer] > 0) continue;
        if (Math.hypot(tick[racer].x - next.target.x, tick[racer].z - next.target.z) <= netRules.catchRadius) {
          next.hit[racer] = true; hits.push(racer);
        }
      }
    }
    return next;
  });
  return { state: { throwers, slow, grace }, hits };
}

export function catchInNet(state: NetHazards, racer: NetRacer): NetHazards {
  return { ...state, slow: { ...state.slow, [racer]: netRules.slowSeconds },
    grace: { ...state.grace, [racer]: netRules.slowSeconds + netRules.graceSeconds } };
}

export function netSpeedScale(state: NetHazards, racer: NetRacer): number {
  return state.slow[racer] > 0 ? netRules.slowMultiplier : 1;
}

function inRange(thrower: NetThrower, racer: TurtleMotion): boolean {
  return Math.abs(racer.z - thrower.z) <= netRules.alongTrackRange
    && Math.hypot(racer.x - thrower.x, racer.z - thrower.z) <= netRules.range;
}

function lead(racer: TurtleMotion): { x: number; z: number } {
  return { x: Math.max(-course.halfWidth + 0.7, Math.min(course.halfWidth - 0.7,
    racer.x + Math.sin(racer.heading) * racer.speed * netRules.flightSeconds)),
    z: racer.z + Math.cos(racer.heading) * racer.speed * netRules.flightSeconds };
}
